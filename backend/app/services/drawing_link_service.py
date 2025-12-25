"""図面紐づけサービス

図面と摘要表部品の紐づけ処理
"""
import re
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import or_
import logging

from ..models.drawing import Drawing
from ..models.spec_sheet import SpecSheet
from ..models.spec_sheet_item import SpecSheetItem
from ..models.extracted_field import ExtractedField

logger = logging.getLogger(__name__)


class DrawingLinkService:
    """図面紐づけサービス"""

    def __init__(self, db: Session):
        self.db = db

    def extract_spec_number(self, drawing_number: str) -> Optional[str]:
        """図番から摘番を抽出

        パターン: ○○X○○NNN○ → XNNN
        例: NAST3840A → S840 (3文字目 + 6,7,8文字目)

        Args:
            drawing_number: 図面番号

        Returns:
            摘番（抽出できない場合None）
        """
        if not drawing_number or len(drawing_number) < 8:
            return None

        try:
            # 3文字目
            char_3 = drawing_number[2]
            # 6,7,8文字目（インデックス5,6,7）
            char_678 = drawing_number[5:8]
            spec_number = char_3 + char_678

            # 有効性チェック（1文字 + 3桁数字）
            if re.match(r"^[A-Z]\d{3}$", spec_number):
                return spec_number
        except IndexError:
            pass

        return None

    def find_unlinked_drawings(
        self,
        page: int = 1,
        per_page: int = 50,
        search: Optional[str] = None
    ) -> tuple[List[Drawing], int]:
        """宙に浮いた図面（摘要表に紐づいていない図面）を取得

        Args:
            page: ページ番号
            per_page: 1ページあたりの件数
            search: 検索キーワード（ファイル名で部分一致）

        Returns:
            (図面リスト, 総件数)
        """
        query = self.db.query(Drawing).filter(
            Drawing.spec_sheet_item_id.is_(None)
        )

        if search:
            query = query.filter(Drawing.pdf_filename.ilike(f"%{search}%"))

        total = query.count()

        offset = (page - 1) * per_page
        drawings = query.order_by(Drawing.upload_date.desc()).offset(offset).limit(per_page).all()

        return drawings, total

    def find_matching_drawings(
        self,
        spec_sheet_id: str
    ) -> List[Dict]:
        """摘要表の図面番号と一致する宙に浮いた図面を検索

        Args:
            spec_sheet_id: 摘要表ID

        Returns:
            紐づけ候補リスト
        """
        # 摘要表の部品リストを取得
        items = self.db.query(SpecSheetItem).filter(
            SpecSheetItem.spec_sheet_id == spec_sheet_id,
            SpecSheetItem.drawing_number.isnot(None)
        ).all()

        if not items:
            return []

        # 宙に浮いている図面を取得
        unlinked_drawings = self.db.query(Drawing).filter(
            Drawing.spec_sheet_item_id.is_(None)
        ).all()

        # 図番マッピング（図面の図番 -> Drawing）
        drawing_map: Dict[str, Drawing] = {}
        for drawing in unlinked_drawings:
            drawing_number = self._get_drawing_number(drawing)
            if drawing_number:
                drawing_map[drawing_number] = drawing

        results = []
        for item in items:
            if item.drawing_number in drawing_map:
                drawing = drawing_map[item.drawing_number]
                results.append({
                    "spec_sheet_item_id": item.id,
                    "spec_sheet_item_row": item.row_number,
                    "spec_sheet_item_name": item.part_name,
                    "spec_sheet_item_drawing_number": item.drawing_number,
                    "drawing_id": drawing.id,
                    "drawing_filename": drawing.pdf_filename,
                    "drawing_thumbnail": drawing.thumbnail_path,
                    "extracted_drawing_number": self._get_drawing_number(drawing),
                    "confidence": 1.0
                })

        logger.info(f"紐づけ候補検索完了: {len(results)}件")
        return results

    def link_drawing_to_item(
        self,
        drawing_id: str,
        spec_sheet_item_id: str
    ) -> Drawing:
        """図面を摘要表部品に紐づけ

        Args:
            drawing_id: 図面ID
            spec_sheet_item_id: 摘要表部品ID

        Returns:
            更新された図面

        Raises:
            ValueError: 図面または部品が見つからない場合
        """
        drawing = self.db.query(Drawing).filter(
            Drawing.id == drawing_id
        ).first()

        if not drawing:
            raise ValueError(f"Drawing not found: {drawing_id}")

        item = self.db.query(SpecSheetItem).filter(
            SpecSheetItem.id == spec_sheet_item_id
        ).first()

        if not item:
            raise ValueError(f"SpecSheetItem not found: {spec_sheet_item_id}")

        drawing.spec_sheet_item_id = spec_sheet_item_id

        # 摘要表から摘番を取得して設定
        spec_sheet = self.db.query(SpecSheet).filter(
            SpecSheet.id == item.spec_sheet_id
        ).first()
        if spec_sheet:
            drawing.spec_number = spec_sheet.spec_number

        self.db.commit()
        self.db.refresh(drawing)

        logger.info(f"図面紐づけ完了: {drawing_id} -> {spec_sheet_item_id}")
        return drawing

    def link_drawings_batch(
        self,
        links: List[Dict]
    ) -> tuple[int, List[str]]:
        """図面を一括紐づけ

        Args:
            links: 紐づけ情報リスト [{spec_sheet_item_id, drawing_id}, ...]

        Returns:
            (成功件数, エラーメッセージリスト)
        """
        linked_count = 0
        errors = []

        for link in links:
            try:
                drawing_id = link.get("drawing_id")
                spec_sheet_item_id = link.get("spec_sheet_item_id")

                if not drawing_id or not spec_sheet_item_id:
                    errors.append("drawing_id または spec_sheet_item_id が不足")
                    continue

                self.link_drawing_to_item(drawing_id, spec_sheet_item_id)
                linked_count += 1

            except Exception as e:
                errors.append(str(e))

        logger.info(f"一括紐づけ完了: {linked_count}件成功, {len(errors)}件エラー")
        return linked_count, errors

    def unlink_drawing(self, drawing_id: str) -> Drawing:
        """図面の紐づけを解除

        Args:
            drawing_id: 図面ID

        Returns:
            更新された図面

        Raises:
            ValueError: 図面が見つからない場合
        """
        drawing = self.db.query(Drawing).filter(
            Drawing.id == drawing_id
        ).first()

        if not drawing:
            raise ValueError(f"Drawing not found: {drawing_id}")

        drawing.spec_sheet_item_id = None
        drawing.spec_number = None

        self.db.commit()
        self.db.refresh(drawing)

        logger.info(f"図面紐づけ解除: {drawing_id}")
        return drawing

    def get_drawing_with_spec_info(self, drawing_id: str) -> Optional[Dict]:
        """図面と紐づき摘要表情報を取得

        Args:
            drawing_id: 図面ID

        Returns:
            図面情報と摘要表情報
        """
        drawing = self.db.query(Drawing).filter(
            Drawing.id == drawing_id
        ).first()

        if not drawing:
            return None

        result = {
            "drawing": drawing,
            "spec_sheet_item": None,
            "spec_sheet": None
        }

        if drawing.spec_sheet_item_id:
            item = self.db.query(SpecSheetItem).filter(
                SpecSheetItem.id == drawing.spec_sheet_item_id
            ).first()
            if item:
                result["spec_sheet_item"] = item
                result["spec_sheet"] = item.spec_sheet

        return result

    def _get_drawing_number(self, drawing: Drawing) -> Optional[str]:
        """図面から図番を取得

        extracted_fieldsから「図番」フィールドの値を取得

        Args:
            drawing: 図面モデル

        Returns:
            図番（取得できない場合None）
        """
        for field in drawing.extracted_fields:
            if field.field_name == "図番":
                return field.field_value
        return None

    def auto_extract_and_set_spec_number(self, drawing_id: str) -> Optional[str]:
        """図面の図番から摘番を自動抽出して設定

        Args:
            drawing_id: 図面ID

        Returns:
            抽出された摘番（抽出できない場合None）
        """
        drawing = self.db.query(Drawing).filter(
            Drawing.id == drawing_id
        ).first()

        if not drawing:
            return None

        drawing_number = self._get_drawing_number(drawing)
        if not drawing_number:
            return None

        spec_number = self.extract_spec_number(drawing_number)
        if spec_number:
            drawing.spec_number = spec_number
            self.db.commit()
            logger.info(f"摘番自動設定: {drawing_id} -> {spec_number}")

        return spec_number
