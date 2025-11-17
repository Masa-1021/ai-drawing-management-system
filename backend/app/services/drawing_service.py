"""
図面サービス

図面のCRUD操作、アップロード、承認、一括操作を提供
"""

import logging
import socket
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.drawing import Drawing
from app.models.extracted_field import ExtractedField
from app.models.balloon import Balloon
from app.models.revision import Revision
from app.models.tag import Tag
from app.models.edit_history import EditHistory
from app.utils.file_manager import FileManager
from app.services.ai_analysis_service import AIAnalysisService

logger = logging.getLogger(__name__)


class DrawingServiceException(Exception):
    """図面サービスエラー"""

    pass


class DrawingService:
    """図面サービスクラス"""

    def __init__(
        self,
        db: Session,
        file_manager: Optional[FileManager] = None,
        ai_service: Optional[AIAnalysisService] = None,
    ):
        """
        初期化

        Args:
            db: データベースセッション
            file_manager: ファイルマネージャー
            ai_service: AI解析サービス
        """
        self.db = db
        self.file_manager = file_manager or FileManager()
        self.ai_service = ai_service or AIAnalysisService()

    def create_drawing(
        self,
        pdf_data: bytes,
        filename: str,
        run_analysis: bool = True,
    ) -> List[Drawing]:
        """
        図面を作成（PDFアップロード）

        Args:
            pdf_data: PDFファイルデータ
            filename: ファイル名
            run_analysis: AI解析を実行するか

        Returns:
            作成されたDrawingのリスト（各ページ1つ）

        Raises:
            DrawingServiceException: 作成エラー
        """
        try:
            logger.info(f"[DEBUG] create_drawing called with filename: '{filename}'")
            logger.info(f"Creating drawing: {filename}")

            # 現在のユーザー名を取得（ホスト名/ユーザー名）
            hostname = socket.gethostname()
            created_by = hostname

            # PDFを保存（AIサービスを渡して画像内容解析による回転検出を有効化）
            new_filename, save_path = self.file_manager.save_pdf(
                pdf_data, filename, auto_rotate=True, ai_service=self.ai_service
            )
            # PDF保存後ファイル存在チェック
            if not save_path or not Path(save_path).exists():
                logger.error(f"[ERROR] PDF保存失敗: {save_path}")
                raise DrawingServiceException(f"PDF保存失敗: {save_path}")

            # ページ数を取得
            from app.services.pdf_converter import PDFConverter

            converter = PDFConverter()
            page_count = converter.get_page_count(save_path)
            if not isinstance(page_count, int) or page_count <= 0:
                logger.error(f"[ERROR] PDFページ数取得失敗: {page_count}")
                raise DrawingServiceException(f"PDFページ数取得失敗: {page_count}")

            logger.info(f"PDF saved: {save_path} ({page_count} pages)")

            # 各ページごとにDrawingレコードを作成
            drawings: List[Drawing] = []

            for page_num in range(page_count):
                # サムネイル生成
                thumbnail_path = self.file_manager.generate_thumbnail(
                    save_path, page_num
                )
                if not thumbnail_path or not Path(thumbnail_path).exists():
                    logger.error(f"[ERROR] サムネイル生成失敗: {thumbnail_path}")
                    raise DrawingServiceException(f"サムネイル生成失敗: {thumbnail_path}")

                # サムネイルのファイル名のみを取得（相対パス）
                thumbnail_filename = Path(thumbnail_path).name

                # Drawingレコード作成
                logger.info(f"[DEBUG] Creating Drawing record with original_filename='{filename}', pdf_filename='{new_filename}'")
                drawing = Drawing(
                    original_filename=filename,  # 元のファイル名を保存
                    pdf_filename=new_filename,
                    pdf_path=save_path,  # 必須項目
                    page_number=page_num,
                    thumbnail_path=thumbnail_filename,  # ファイル名のみ
                    status="pending" if run_analysis else "unapproved",
                    created_by=created_by,
                )
                logger.info(f"[DEBUG] Drawing object created: original_filename={drawing.original_filename}, pdf_filename={drawing.pdf_filename}")
                # 必須フィールドチェック
                if not drawing.pdf_filename or not drawing.thumbnail_path:
                    logger.error(f"[ERROR] Drawing生成パラメータ不備: {drawing}")
                    raise DrawingServiceException("Drawing生成パラメータ不備")

                self.db.add(drawing)
                self.db.flush()  # IDを取得

                drawings.append(drawing)

                logger.info(
                    f"Drawing created: ID={drawing.id}, page={page_num + 1}/{page_count}"
                )

            self.db.commit()

            # AI解析を実行（バックグラウンド）
            if run_analysis:
                for drawing in drawings:
                    try:
                        self._run_analysis(drawing)
                    except Exception as e:
                        logger.error(
                            f"Analysis failed for drawing {drawing.id}: {e}"
                        )
                        drawing.status = "failed"
                        self.db.commit()

            # 必ずDrawing型リストのみ返却
            return drawings

        except Exception as e:
            self.db.rollback()
            import traceback
            logger.error(f"Failed to create drawing: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise DrawingServiceException(f"図面作成エラー: {str(e)}")

    def _run_analysis(self, drawing: Drawing) -> None:
        """
        AI解析を実行

        Args:
            drawing: Drawingオブジェクト
        """
        try:
            logger.info(f"Starting analysis for drawing {drawing.id}")

            # ステータス更新
            drawing.status = "analyzing"
            self.db.commit()

            # PDFパスを取得
            pdf_path = self.file_manager.get_pdf_path(drawing.pdf_filename)

            # AI解析実行
            result = self.ai_service.analyze_drawing_full(
                pdf_path, drawing.page_number
            )

            # 図枠情報を保存
            for field_data in result.get("fields", []):
                coordinates = field_data.get("coordinates", {})
                extracted_field = ExtractedField(
                    drawing_id=drawing.id,
                    field_name=field_data.get("name", ""),
                    field_value=field_data.get("value", ""),
                    confidence=field_data.get("confidence", 0),
                    x=coordinates.get("x", 0),
                    y=coordinates.get("y", 0),
                    width=coordinates.get("width", 0),
                    height=coordinates.get("height", 0),
                )
                self.db.add(extracted_field)

            # 分類情報を保存
            classification = result.get("classification", {})
            drawing.classification = classification.get("category")
            drawing.classification_confidence = classification.get("confidence")

            # 風船情報を保存
            for balloon_data in result.get("balloons", []):
                coordinates = balloon_data.get("coordinates", {})
                balloon = Balloon(
                    drawing_id=drawing.id,
                    balloon_number=balloon_data.get("balloon_number", ""),
                    part_name=balloon_data.get("part_name", ""),
                    quantity=balloon_data.get("quantity", 1),
                    confidence=balloon_data.get("confidence", 0),
                    x=coordinates.get("x", 0),
                    y=coordinates.get("y", 0),
                )
                self.db.add(balloon)

            # 改訂履歴を保存
            for revision_data in result.get("revisions", []):
                revision_date = None
                if revision_data.get("revision_date"):
                    try:
                        revision_date = datetime.strptime(
                            revision_data["revision_date"], "%Y-%m-%d"
                        ).date()
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid revision date format: {revision_data.get('revision_date')}")

                revision = Revision(
                    drawing_id=drawing.id,
                    revision_number=revision_data.get("revision_number", ""),
                    revision_date=revision_date,
                    revision_content=revision_data.get("description", revision_data.get("revision_content", "")),
                    reviser=revision_data.get("author", revision_data.get("reviser", "")),
                    confidence=revision_data.get("confidence", 0),
                )
                self.db.add(revision)

            # 要約・形状特徴を保存
            drawing.summary = result.get("summary", "")
            drawing.shape_features = result.get("shape_features", {})

            # ステータス更新
            drawing.status = "unapproved"
            drawing.analyzed_at = datetime.utcnow()

            self.db.commit()

            # ファイル名を解析結果に基づいてリネーム
            try:
                self._rename_drawing_file(drawing)
            except Exception as e:
                logger.warning(f"Failed to rename file for drawing {drawing.id}: {e}")
                # ファイル名変更失敗は警告のみ（処理は続行）

            logger.info(f"Analysis completed for drawing {drawing.id}")

        except Exception as e:
            logger.error(f"Analysis error for drawing {drawing.id}: {e}")
            drawing.status = "failed"
            self.db.commit()
            raise

    def _rename_drawing_file(self, drawing: Drawing) -> None:
        """
        図面ファイルを解析結果に基づいてリネーム

        形式: タイムスタンプ_分類_図番_作成者.pdf

        Args:
            drawing: Drawingオブジェクト
        """
        try:
            # リレーションシップを確実に読み込む
            self.db.refresh(drawing, ["extracted_fields"])
            
            # 図番を抽出フィールドから取得
            drawing_number = None
            for field in drawing.extracted_fields:
                if field.field_name == "図番" and field.field_value:
                    drawing_number = field.field_value
                    break

            # ファイル名を生成
            new_filename = self.file_manager.generate_drawing_filename(
                timestamp=drawing.upload_date or datetime.utcnow(),
                classification=drawing.classification,
                drawing_number=drawing_number,
                created_by=drawing.created_by,
            )

            # ファイルが既に正しい名前の場合はスキップ
            if drawing.pdf_filename == new_filename:
                logger.info(f"File already has correct name: {new_filename}")
                return

            # ファイルをリネーム
            new_filename, new_path = self.file_manager.rename_pdf(
                drawing.pdf_filename, new_filename
            )

            # データベースを更新
            old_filename = drawing.pdf_filename
            drawing.pdf_filename = new_filename
            drawing.pdf_path = new_path

            # サムネイルもリネーム（古いファイル名ベースのサムネイルを新しい名前に）
            if drawing.thumbnail_path:
                old_thumbnail_path = Path(self.file_manager.thumbnails_path) / drawing.thumbnail_path
                if old_thumbnail_path.exists():
                    # サムネイルファイル名を新しいPDFファイル名に基づいて生成
                    # generate_thumbnailと同じロジックを使用
                    new_filename_stem = Path(new_filename).stem
                    if drawing.page_number > 0:
                        new_thumbnail_filename = f"{new_filename_stem}_page{drawing.page_number}.png"
                    else:
                        new_thumbnail_filename = f"{new_filename_stem}.png"
                    
                    new_thumbnail_path = self.file_manager.thumbnails_path / new_thumbnail_filename
                    # 既に存在する場合はスキップ
                    if not new_thumbnail_path.exists():
                        old_thumbnail_path.rename(new_thumbnail_path)
                        drawing.thumbnail_path = new_thumbnail_filename
                    else:
                        logger.warning(f"Thumbnail already exists: {new_thumbnail_filename}")

            self.db.commit()

            logger.info(
                f"Renamed file for drawing {drawing.id}: "
                f"{old_filename} -> {new_filename}"
            )

        except FileNotFoundError as e:
            logger.warning(f"File not found for renaming: {e}")
        except FileExistsError as e:
            logger.warning(f"Target filename already exists: {e}")
        except Exception as e:
            logger.error(f"Error renaming file for drawing {drawing.id}: {e}")
            raise

    def get_drawing(self, drawing_id: str) -> Optional[Drawing]:
        """
        図面を取得

        Args:
            drawing_id: 図面ID

        Returns:
            Drawingオブジェクト（存在しない場合はNone）
        """
        return self.db.query(Drawing).filter(Drawing.id == drawing_id).first()

    def list_drawings(
        self,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        classification: Optional[str] = None,
        search: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> List[Drawing]:
        """
        図面リストを取得

        Args:
            skip: スキップ件数
            limit: 取得件数
            status: ステータスフィルタ
            classification: 分類フィルタ
            search: ファイル名検索（部分一致）
            tags: タグフィルタ

        Returns:
            Drawingリスト
        """
        query = self.db.query(Drawing)

        # フィルタ適用
        if status:
            query = query.filter(Drawing.status == status)
        if classification:
            query = query.filter(Drawing.classification == classification)
        if search:
            # ファイル名検索（部分一致、大文字小文字無視）
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Drawing.pdf_filename.ilike(search_pattern),
                    Drawing.original_filename.ilike(search_pattern)
                )
            )
        if tags:
            # タグフィルタ（いずれかのタグを持つ図面）
            query = query.join(Tag).filter(Tag.tag_name.in_(tags))

        # ページネーション
        query = query.order_by(Drawing.upload_date.desc())
        query = query.offset(skip).limit(limit)

        return query.all()

    def update_drawing(
        self, drawing_id: str, updates: Dict[str, Any]
    ) -> Optional[Drawing]:
        """
        図面を更新

        Args:
            drawing_id: 図面ID
            updates: 更新内容

        Returns:
            更新されたDrawingオブジェクト

        Raises:
            DrawingServiceException: 更新エラー
        """
        try:
            drawing = self.get_drawing(drawing_id)

            if not drawing:
                raise DrawingServiceException(f"図面が見つかりません: {drawing_id}")

            # 更新前の値を記録し、編集履歴を作成
            user_id = socket.gethostname()

            for key, value in updates.items():
                if hasattr(drawing, key):
                    old_value = getattr(drawing, key)
                    setattr(drawing, key, value)

                    # 各フィールドごとに編集履歴を記録
                    history = EditHistory(
                        drawing_id=drawing_id,
                        user_id=user_id,
                        field_name=key,
                        old_value=str(old_value) if old_value is not None else None,
                        new_value=str(value) if value is not None else None,
                    )
                    self.db.add(history)

            self.db.commit()

            logger.info(f"Drawing {drawing_id} updated: {updates}")

            return drawing

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update drawing {drawing_id}: {e}")
            raise DrawingServiceException(f"図面更新エラー: {str(e)}") from e

    def delete_drawings(self, drawing_ids: List[str]) -> int:
        """
        図面を削除（一括）

        Args:
            drawing_ids: 図面IDリスト

        Returns:
            削除件数

        Raises:
            DrawingServiceException: 削除エラー
        """
        try:
            deleted_count = 0

            for drawing_id in drawing_ids:
                drawing = self.get_drawing(drawing_id)

                if drawing:
                    # PDFとサムネイルを削除
                    self.file_manager.delete_pdf(drawing.pdf_filename)
                    if drawing.thumbnail_path:
                        self.file_manager.delete_thumbnail(
                            Path(drawing.thumbnail_path).name
                        )

                    # DB削除（カスケード）
                    self.db.delete(drawing)
                    deleted_count += 1

            self.db.commit()

            logger.info(f"Deleted {deleted_count} drawings")

            return deleted_count

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete drawings: {e}")
            raise DrawingServiceException(f"図面削除エラー: {str(e)}") from e

    def approve_drawing(self, drawing_id: str) -> Optional[Drawing]:
        """
        図面を承認

        Args:
            drawing_id: 図面ID

        Returns:
            承認されたDrawingオブジェクト
        """
        return self.update_drawing(
            drawing_id,
            {"status": "approved", "approved_date": datetime.utcnow()},
        )

    def unapprove_drawing(self, drawing_id: str) -> Optional[Drawing]:
        """
        図面の承認を取り消し

        Args:
            drawing_id: 図面ID

        Returns:
            Drawingオブジェクト
        """
        return self.update_drawing(
            drawing_id, {"status": "unapproved", "approved_date": None}
        )
