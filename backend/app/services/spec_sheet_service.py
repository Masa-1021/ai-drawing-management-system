"""摘要表サービス

摘要表のCRUD操作と設備紐づけ
"""
from typing import List, Optional, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
import uuid
import logging

from ..models.spec_sheet import SpecSheet
from ..models.spec_sheet_revision import SpecSheetRevision
from ..models.spec_sheet_item import SpecSheetItem
from ..models.spec_number import SpecNumber
from ..models.equipment import Equipment
from .excel_parser_service import (
    SpecSheetHeader,
    SpecSheetRevisionRow,
    SpecSheetItemRow,
    SpecNumberRow,
)

logger = logging.getLogger(__name__)


class SpecSheetService:
    """摘要表管理サービス"""

    def __init__(self, db: Session):
        self.db = db

    def create_spec_sheet(
        self,
        header: SpecSheetHeader,
        revisions: List[SpecSheetRevisionRow],
        items: List[SpecSheetItemRow],
        file_path: str,
        original_filename: str,
        equipment_id: Optional[str] = None
    ) -> SpecSheet:
        """摘要表を作成

        Args:
            header: ヘッダー情報
            revisions: 改定履歴リスト
            items: 部品リスト
            file_path: アップロードファイルパス
            original_filename: 元のファイル名
            equipment_id: 設備ID（紐づけ済みの場合）

        Returns:
            作成された摘要表
        """
        logger.info(f"摘要表作成開始: {header.spec_number}")

        # 最新の改定記号を取得
        current_revision = revisions[0].revision_symbol if revisions else None

        # 摘要表本体を作成
        spec_sheet = SpecSheet(
            id=str(uuid.uuid4()),
            equipment_id=equipment_id,
            spec_number=header.spec_number,
            equipment_name=header.equipment_name,
            line_name=header.line_name,
            model_name=header.model_name,
            order_number=header.order_number,
            created_by=header.created_by,
            checked_by=header.checked_by,
            designed_by=header.designed_by,
            approved_by=header.approved_by,
            current_revision=current_revision,
            file_path=file_path,
            original_filename=original_filename,
            status="linked" if equipment_id else "draft"
        )
        self.db.add(spec_sheet)
        self.db.flush()  # IDを取得

        # 改定履歴を作成
        for rev in revisions:
            revision = SpecSheetRevision(
                id=str(uuid.uuid4()),
                spec_sheet_id=spec_sheet.id,
                revision_symbol=rev.revision_symbol,
                revision_date=rev.revision_date,
                description=rev.description,
                created_by=rev.created_by,
                checked_by=rev.checked_by,
                approved_by=rev.approved_by,
                remarks=rev.remarks,
            )
            self.db.add(revision)

        # 部品リストを作成
        item_map: Dict[int, SpecSheetItem] = {}  # row_number -> SpecSheetItem
        for item_row in items:
            item = SpecSheetItem(
                id=str(uuid.uuid4()),
                spec_sheet_id=spec_sheet.id,
                row_number=item_row.row_number,
                part_name=item_row.part_name,
                drawing_number=item_row.drawing_number,
                sub_number=item_row.sub_number,
                item_number=item_row.item_number,
                material=item_row.material,
                heat_treatment=item_row.heat_treatment,
                surface_treatment=item_row.surface_treatment,
                quantity_per_set=item_row.quantity_per_set,
                required_quantity=item_row.required_quantity,
                revision=item_row.revision,
                part_type=item_row.part_type,
                parent_name=item_row.parent_name,
            )
            self.db.add(item)
            item_map[item_row.row_number] = item

        self.db.flush()

        # 親子関係を設定
        self._resolve_parent_relations(item_map, items)

        self.db.commit()
        self.db.refresh(spec_sheet)

        logger.info(f"摘要表作成完了: {spec_sheet.id}, 部品数: {len(items)}")
        return spec_sheet

    def _resolve_parent_relations(
        self,
        item_map: Dict[int, SpecSheetItem],
        items: List[SpecSheetItemRow]
    ):
        """親子関係を解決

        parent_nameをもとに親アイテムを特定し、parent_item_idを設定
        """
        # 品名 -> アイテムのマッピング
        name_to_item: Dict[str, SpecSheetItem] = {}
        for item in item_map.values():
            if item.part_name:
                # 同名の部品がある場合は最初のものを採用
                if item.part_name not in name_to_item:
                    name_to_item[item.part_name] = item

        for item_row in items:
            if item_row.parent_name and item_row.parent_name != "組図":
                item = item_map.get(item_row.row_number)
                parent = name_to_item.get(item_row.parent_name)
                if item and parent and item.id != parent.id:
                    item.parent_item_id = parent.id
                    logger.debug(f"親子関係設定: {item.part_name} -> {parent.part_name}")

    def link_to_equipment(
        self,
        spec_sheet_id: str,
        equipment_id: str
    ) -> SpecSheet:
        """摘要表を設備に紐づけ

        Args:
            spec_sheet_id: 摘要表ID
            equipment_id: 設備ID

        Returns:
            更新された摘要表

        Raises:
            ValueError: 摘要表または設備が見つからない場合
        """
        spec_sheet = self.db.query(SpecSheet).filter(
            SpecSheet.id == spec_sheet_id
        ).first()

        if not spec_sheet:
            raise ValueError(f"SpecSheet not found: {spec_sheet_id}")

        equipment = self.db.query(Equipment).filter(
            Equipment.id == equipment_id
        ).first()

        if not equipment:
            raise ValueError(f"Equipment not found: {equipment_id}")

        spec_sheet.equipment_id = equipment_id
        spec_sheet.status = "linked"

        self.db.commit()
        self.db.refresh(spec_sheet)

        logger.info(f"摘要表紐づけ完了: {spec_sheet_id} -> {equipment.name}")
        return spec_sheet

    def get_spec_sheet(self, spec_sheet_id: str) -> Optional[SpecSheet]:
        """摘要表詳細取得

        Args:
            spec_sheet_id: 摘要表ID

        Returns:
            摘要表（存在しない場合None）
        """
        return self.db.query(SpecSheet).filter(
            SpecSheet.id == spec_sheet_id
        ).first()

    def list_spec_sheets(
        self,
        page: int = 1,
        per_page: int = 50,
        line_name: Optional[str] = None,
        equipment_name: Optional[str] = None,
        spec_number: Optional[str] = None,
        model_name: Optional[str] = None,
        created_by: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        sort_by: str = "spec_number",
        sort_order: str = "asc"
    ) -> Tuple[List[SpecSheet], int]:
        """摘要表一覧取得

        Returns:
            (摘要表リスト, 総件数)
        """
        query = self.db.query(SpecSheet)

        # フィルタ
        if line_name:
            query = query.filter(SpecSheet.line_name.ilike(f"%{line_name}%"))
        if equipment_name:
            query = query.filter(SpecSheet.equipment_name.ilike(f"%{equipment_name}%"))
        if spec_number:
            query = query.filter(SpecSheet.spec_number.ilike(f"%{spec_number}%"))
        if model_name:
            query = query.filter(SpecSheet.model_name.ilike(f"%{model_name}%"))
        if created_by:
            query = query.filter(SpecSheet.created_by.ilike(f"%{created_by}%"))
        if status:
            query = query.filter(SpecSheet.status == status)
        if date_from:
            query = query.filter(SpecSheet.created_at >= date_from)
        if date_to:
            query = query.filter(SpecSheet.created_at <= date_to)

        # 総件数
        total = query.count()

        # ソート
        sort_column = getattr(SpecSheet, sort_by, SpecSheet.spec_number)
        if sort_order == "desc":
            sort_column = sort_column.desc()
        query = query.order_by(sort_column)

        # ページネーション
        offset = (page - 1) * per_page
        items = query.offset(offset).limit(per_page).all()

        return items, total

    def update_spec_sheet(
        self,
        spec_sheet_id: str,
        **kwargs
    ) -> SpecSheet:
        """摘要表更新

        Args:
            spec_sheet_id: 摘要表ID
            **kwargs: 更新フィールド

        Returns:
            更新された摘要表
        """
        spec_sheet = self.db.query(SpecSheet).filter(
            SpecSheet.id == spec_sheet_id
        ).first()

        if not spec_sheet:
            raise ValueError(f"SpecSheet not found: {spec_sheet_id}")

        for key, value in kwargs.items():
            if value is not None and hasattr(spec_sheet, key):
                setattr(spec_sheet, key, value)

        self.db.commit()
        self.db.refresh(spec_sheet)
        return spec_sheet

    def delete_spec_sheet(self, spec_sheet_id: str) -> bool:
        """摘要表削除

        Args:
            spec_sheet_id: 摘要表ID

        Returns:
            削除成功の場合True
        """
        spec_sheet = self.db.query(SpecSheet).filter(
            SpecSheet.id == spec_sheet_id
        ).first()

        if not spec_sheet:
            return False

        self.db.delete(spec_sheet)
        self.db.commit()

        logger.info(f"摘要表削除完了: {spec_sheet_id}")
        return True

    def update_item_parent(
        self,
        spec_sheet_id: str,
        item_id: str,
        parent_item_id: str
    ) -> SpecSheetItem:
        """部品の親を更新

        Args:
            spec_sheet_id: 摘要表ID
            item_id: 部品ID
            parent_item_id: 親部品ID

        Returns:
            更新された部品

        Raises:
            ValueError: 摘要表または部品が見つからない場合、
                       または無効な親子関係の場合
        """
        # 摘要表の存在確認
        spec_sheet = self.db.query(SpecSheet).filter(
            SpecSheet.id == spec_sheet_id
        ).first()
        if not spec_sheet:
            raise ValueError(f"SpecSheet not found: {spec_sheet_id}")

        # 部品の存在確認
        item = self.db.query(SpecSheetItem).filter(
            SpecSheetItem.id == item_id,
            SpecSheetItem.spec_sheet_id == spec_sheet_id
        ).first()
        if not item:
            raise ValueError(f"SpecSheetItem not found: {item_id}")

        # 親部品の存在確認
        parent_item = self.db.query(SpecSheetItem).filter(
            SpecSheetItem.id == parent_item_id,
            SpecSheetItem.spec_sheet_id == spec_sheet_id
        ).first()
        if not parent_item:
            raise ValueError(f"Parent SpecSheetItem not found: {parent_item_id}")

        # 自己参照チェック
        if item_id == parent_item_id:
            raise ValueError("Item cannot be its own parent")

        # 親子関係のバリデーション
        # 組図は親を持てない
        if item.part_type == "assembly":
            raise ValueError("Assembly cannot have a parent")

        # ユニット図の親は組図のみ
        if item.part_type == "unit" and parent_item.part_type != "assembly":
            raise ValueError("Unit's parent must be an assembly")

        # 部品図・購入品の親はユニット図か組図
        if item.part_type in ("part", "purchased"):
            if parent_item.part_type not in ("assembly", "unit"):
                raise ValueError("Part's parent must be an assembly or unit")

        # 更新
        item.parent_item_id = parent_item_id
        # parent_nameも更新（親の品名を設定）
        item.parent_name = parent_item.part_name

        self.db.commit()
        self.db.refresh(item)

        logger.info(f"部品親更新: {item.part_name} -> {parent_item.part_name}")
        return item

    def bulk_update_part_type(
        self,
        spec_sheet_id: str,
        item_ids: List[str],
        part_type: str
    ) -> Tuple[int, List[str]]:
        """部品種別を一括更新

        Args:
            spec_sheet_id: 摘要表ID
            item_ids: 更新対象部品IDリスト
            part_type: 新しい部品種別

        Returns:
            (更新件数, エラーメッセージリスト)
        """
        # 摘要表の存在確認
        spec_sheet = self.db.query(SpecSheet).filter(
            SpecSheet.id == spec_sheet_id
        ).first()
        if not spec_sheet:
            raise ValueError(f"SpecSheet not found: {spec_sheet_id}")

        # 有効な部品種別か確認
        valid_types = ["assembly", "unit", "part", "purchased"]
        if part_type not in valid_types:
            raise ValueError(f"Invalid part_type: {part_type}")

        updated_count = 0
        errors: List[str] = []

        for item_id in item_ids:
            item = self.db.query(SpecSheetItem).filter(
                SpecSheetItem.id == item_id,
                SpecSheetItem.spec_sheet_id == spec_sheet_id
            ).first()

            if not item:
                errors.append(f"部品が見つかりません: {item_id}")
                continue

            item.part_type = part_type
            updated_count += 1

        self.db.commit()
        logger.info(f"部品種別一括更新: {updated_count}件更新, {len(errors)}件エラー")
        return updated_count, errors

    def suggest_equipment(
        self,
        line_name: Optional[str],
        equipment_name: Optional[str]
    ) -> Optional[Dict]:
        """設備サジェスト

        摘要表のライン名・設備名から既存設備を検索してサジェスト

        Args:
            line_name: ライン名
            equipment_name: 設備名

        Returns:
            サジェスト情報（一致度含む）
        """
        if not line_name and not equipment_name:
            return None

        query = self.db.query(Equipment)

        # ライン名と設備名の両方で検索
        if line_name and equipment_name:
            # 完全一致
            equipment = query.join(Equipment.line).filter(
                and_(
                    Equipment.line.has(name=line_name),
                    Equipment.name == equipment_name
                )
            ).first()
            if equipment:
                return {
                    "equipment_id": equipment.id,
                    "equipment_name": equipment.name,
                    "line_name": equipment.line.name if equipment.line else None,
                    "confidence": 1.0
                }

            # 部分一致
            equipment = query.join(Equipment.line).filter(
                or_(
                    Equipment.name.ilike(f"%{equipment_name}%"),
                    Equipment.line.has(name=line_name)
                )
            ).first()
            if equipment:
                confidence = 0.7 if equipment.name == equipment_name else 0.5
                return {
                    "equipment_id": equipment.id,
                    "equipment_name": equipment.name,
                    "line_name": equipment.line.name if equipment.line else None,
                    "confidence": confidence
                }

        return None


class SpecNumberService:
    """摘番マスタサービス"""

    def __init__(self, db: Session):
        self.db = db

    def import_spec_numbers(
        self,
        rows: List[SpecNumberRow],
        batch_size: int = 500
    ) -> Tuple[int, int, List[str]]:
        """摘番マスタをバッチインポート

        Args:
            rows: 摘番マスタ行リスト
            batch_size: バッチサイズ

        Returns:
            (インポート成功件数, スキップ件数, エラーメッセージリスト)
        """
        imported = 0
        skipped = 0
        errors = []

        # 処理済み摘番を追跡（Excel内の重複対策）
        processed_spec_numbers: set = set()

        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            for row in batch:
                try:
                    # Excel内の重複チェック
                    if row.spec_number in processed_spec_numbers:
                        skipped += 1
                        continue

                    # DB内の重複チェック
                    existing = self.db.query(SpecNumber).filter(
                        SpecNumber.spec_number == row.spec_number
                    ).first()

                    if existing:
                        processed_spec_numbers.add(row.spec_number)
                        skipped += 1
                        continue

                    spec_number = SpecNumber(
                        id=str(uuid.uuid4()),
                        spec_number=row.spec_number,
                        title=row.title,
                        model_name=row.model_name,
                        material_code=row.material_code,
                        usage_location=row.usage_location,
                        line_name=row.line_name,
                        equipment_name=row.equipment_name,
                        design_date=row.design_date,
                        designer=row.designer,
                        reference_drawing=row.reference_drawing,
                        remarks=row.remarks,
                    )
                    self.db.add(spec_number)
                    processed_spec_numbers.add(row.spec_number)
                    imported += 1

                except Exception as e:
                    errors.append(f"摘番 {row.spec_number}: {str(e)}")

            self.db.flush()

        self.db.commit()

        logger.info(f"摘番マスタインポート完了: {imported}件成功, {skipped}件スキップ")
        return imported, skipped, errors

    def get_spec_number(self, spec_number_id: str) -> Optional[SpecNumber]:
        """摘番マスタ取得"""
        return self.db.query(SpecNumber).filter(
            SpecNumber.id == spec_number_id
        ).first()

    def get_by_spec_number(self, spec_number: str) -> Optional[SpecNumber]:
        """摘番で検索"""
        return self.db.query(SpecNumber).filter(
            SpecNumber.spec_number == spec_number
        ).first()

    def list_spec_numbers(
        self,
        page: int = 1,
        per_page: int = 50,
        spec_number: Optional[str] = None,
        title: Optional[str] = None,
        line_name: Optional[str] = None,
        equipment_name: Optional[str] = None,
        sort_by: str = "spec_number",
        sort_order: str = "asc"
    ) -> Tuple[List[SpecNumber], int]:
        """摘番マスタ一覧取得"""
        query = self.db.query(SpecNumber)

        if spec_number:
            query = query.filter(SpecNumber.spec_number.ilike(f"%{spec_number}%"))
        if title:
            query = query.filter(SpecNumber.title.ilike(f"%{title}%"))
        if line_name:
            query = query.filter(SpecNumber.line_name.ilike(f"%{line_name}%"))
        if equipment_name:
            query = query.filter(SpecNumber.equipment_name.ilike(f"%{equipment_name}%"))

        total = query.count()

        sort_column = getattr(SpecNumber, sort_by, SpecNumber.spec_number)
        if sort_order == "desc":
            sort_column = sort_column.desc()
        query = query.order_by(sort_column)

        offset = (page - 1) * per_page
        items = query.offset(offset).limit(per_page).all()

        return items, total

    def create_spec_number(self, **kwargs) -> SpecNumber:
        """摘番マスタ作成"""
        spec_number = SpecNumber(
            id=str(uuid.uuid4()),
            **kwargs
        )
        self.db.add(spec_number)
        self.db.commit()
        self.db.refresh(spec_number)
        return spec_number

    def update_spec_number(self, spec_number_id: str, **kwargs) -> SpecNumber:
        """摘番マスタ更新"""
        spec_number = self.get_spec_number(spec_number_id)
        if not spec_number:
            raise ValueError(f"SpecNumber not found: {spec_number_id}")

        for key, value in kwargs.items():
            if value is not None and hasattr(spec_number, key):
                setattr(spec_number, key, value)

        self.db.commit()
        self.db.refresh(spec_number)
        return spec_number

    def delete_spec_number(self, spec_number_id: str) -> bool:
        """摘番マスタ削除"""
        spec_number = self.get_spec_number(spec_number_id)
        if not spec_number:
            return False

        self.db.delete(spec_number)
        self.db.commit()
        return True

    def get_prefixes(self) -> List[str]:
        """摘番プレフィックス一覧取得

        摘番の先頭1文字（アルファベット）の一覧を取得

        Returns:
            プレフィックス一覧（ソート済み）
        """
        from sqlalchemy import func

        results = self.db.query(
            func.substr(SpecNumber.spec_number, 1, 1)
        ).distinct().all()

        prefixes = [r[0] for r in results if r[0] and r[0].isalpha()]
        return sorted(prefixes)

    def get_next_spec_number(self, prefix: str) -> Tuple[str, int]:
        """次の摘番を取得

        指定プレフィックスで「使用中」の最大番号+1を返す
        名称（title）が空白またはハイフンのみの摘番は「未使用」として扱う

        Args:
            prefix: プレフィックス（A, B, L等）

        Returns:
            (次の摘番, 現在の最大番号)
        """
        import re

        # 指定プレフィックスで始まる全摘番を取得
        spec_numbers = self.db.query(SpecNumber.spec_number, SpecNumber.title).filter(
            SpecNumber.spec_number.like(f"{prefix}%")
        ).all()

        max_number = 0
        for spec_num, title in spec_numbers:
            # titleがNULL、空文字、空白のみ、またはハイフンのみの場合は未使用とみなす
            if title is None:
                continue
            trimmed_title = title.strip()
            if trimmed_title == "" or trimmed_title == "-" or trimmed_title == "－":
                continue

            # プレフィックス以降の数字を抽出
            match = re.match(rf"^{re.escape(prefix)}(\d+)", spec_num)
            if match:
                number = int(match.group(1))
                if number > max_number:
                    max_number = number

        next_number = max_number + 1
        # 元の桁数を維持（最低3桁）
        digit_count = max(3, len(str(max_number)))
        next_spec_number = f"{prefix}{next_number:0{digit_count}d}"

        return next_spec_number, max_number

    def get_filter_options(self) -> Tuple[List[str], List[str], List[str]]:
        """フィルタオプション取得

        Returns:
            (プレフィックス一覧, ライン名一覧, 使用場所一覧)
        """
        from sqlalchemy import func

        # プレフィックス
        prefixes = self.get_prefixes()

        # ライン名
        line_results = self.db.query(SpecNumber.line_name).filter(
            SpecNumber.line_name.isnot(None),
            SpecNumber.line_name != ""
        ).distinct().all()
        line_names = sorted([r[0] for r in line_results if r[0]])

        # 使用場所
        location_results = self.db.query(SpecNumber.usage_location).filter(
            SpecNumber.usage_location.isnot(None),
            SpecNumber.usage_location != ""
        ).distinct().all()
        usage_locations = sorted([r[0] for r in location_results if r[0]])

        return prefixes, line_names, usage_locations

    def list_spec_numbers_with_prefix(
        self,
        page: int = 1,
        per_page: int = 50,
        prefix: Optional[str] = None,
        spec_number: Optional[str] = None,
        title: Optional[str] = None,
        line_name: Optional[str] = None,
        equipment_name: Optional[str] = None,
        usage_location: Optional[str] = None,
        sort_by: str = "spec_number",
        sort_order: str = "asc"
    ) -> Tuple[List[SpecNumber], int]:
        """摘番マスタ一覧取得（プレフィックスフィルタ付き）"""
        query = self.db.query(SpecNumber)

        # プレフィックスフィルタ
        if prefix:
            query = query.filter(SpecNumber.spec_number.like(f"{prefix}%"))

        if spec_number:
            query = query.filter(SpecNumber.spec_number.ilike(f"%{spec_number}%"))
        if title:
            query = query.filter(SpecNumber.title.ilike(f"%{title}%"))
        if line_name:
            query = query.filter(SpecNumber.line_name.ilike(f"%{line_name}%"))
        if equipment_name:
            query = query.filter(SpecNumber.equipment_name.ilike(f"%{equipment_name}%"))
        if usage_location:
            query = query.filter(SpecNumber.usage_location.ilike(f"%{usage_location}%"))

        total = query.count()

        sort_column = getattr(SpecNumber, sort_by, SpecNumber.spec_number)
        if sort_order == "desc":
            sort_column = sort_column.desc()
        query = query.order_by(sort_column)

        offset = (page - 1) * per_page
        items = query.offset(offset).limit(per_page).all()

        return items, total
