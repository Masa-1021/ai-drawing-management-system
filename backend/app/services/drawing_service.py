"""
図面サービス

図面のCRUD操作、アップロード、承認、一括操作を提供
"""

import logging
import socket
import re
import time
import asyncio
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.models.drawing import Drawing
from app.models.extracted_field import ExtractedField
from app.models.balloon import Balloon
from app.models.revision import Revision
from app.models.tag import Tag
from app.models.edit_history import EditHistory
from app.utils.file_manager import FileManager
from app.services.ai_analysis_service import AIAnalysisService
from app.services.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)


class DrawingServiceException(Exception):
    """図面サービスエラー"""

    pass


# メインイベントループへの参照（起動時に設定される）
_main_event_loop: asyncio.AbstractEventLoop = None


def set_main_event_loop(loop: asyncio.AbstractEventLoop):
    """メインイベントループを設定（アプリ起動時に呼び出し）"""
    global _main_event_loop
    _main_event_loop = loop
    logger.info("Main event loop registered for progress notifications")


def start_progress_worker():
    """互換性のためのダミー関数"""
    pass


def stop_progress_worker():
    """互換性のためのダミー関数"""
    pass


def _send_progress_sync(message: str, level: str = "info"):
    """
    WebSocket進捗通知を同期的に送信するヘルパー関数

    メインイベントループでWebSocket emitをスケジュールし、
    短い遅延でフラッシュを促す

    Args:
        message: 送信するメッセージ
        level: ログレベル（info, success, error, warning）
    """
    global _main_event_loop

    if _main_event_loop is None:
        logger.warning("Main event loop not available, cannot send progress")
        return

    try:
        # メインイベントループでコルーチンをスケジュール（待機しない）
        asyncio.run_coroutine_threadsafe(
            websocket_manager.notify_upload_progress(message, level),
            _main_event_loop
        )
        # イベントループに処理時間を与える（100ms）
        time.sleep(0.1)
    except Exception as e:
        logger.warning(f"Progress notification failed: {e}")


def _correct_drawing_number(value: str) -> str:
    """
    図番のパターンを補正する

    NAから始まる場合は「NA〇T〇〇〇〇〇」パターンに補正
    - NAと4文字目のTは確定
    - 例: NAXT3722D, NAX13722D → 正しく認識

    Args:
        value: 抽出された図番

    Returns:
        補正後の図番
    """
    if not value or not isinstance(value, str):
        return value

    # NAから始まる9文字以上の文字列の場合
    if value.upper().startswith("NA") and len(value) >= 9:
        # 4文字目がTでない場合、Tに補正
        chars = list(value)
        if len(chars) >= 4 and chars[3].upper() != "T":
            original = value
            chars[3] = "T"
            corrected = "".join(chars)
            logger.info(f"図番パターン補正: {original} → {corrected}")
            return corrected

    return value


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
            ai_service: AI解析サービス（Noneの場合は必要時に初期化）
        """
        self.db = db
        self.file_manager = file_manager or FileManager()
        self._ai_service = ai_service  # 遅延初期化用

    def create_drawing(
        self,
        pdf_data: bytes,
        filename: str,
        run_analysis: bool = True,
    ) -> List[Drawing]:
        """
        図面を作成（PDFまたはTIFアップロード）
        TIFファイルの場合は自動的にPDFに変換してから処理

        Args:
            pdf_data: PDFまたはTIFファイルデータ
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

            # 処理開始時間
            upload_start_time = time.time()

            # 現在のユーザー名を取得（ホスト名/ユーザー名）
            hostname = socket.gethostname()
            created_by = hostname

            # TIFファイルの場合はPDFに変換
            if filename.lower().endswith((".tif", ".tiff")):
                logger.info(f"TIF file detected: {filename}, converting to PDF...")
                _send_progress_sync("TIFファイルをPDFに変換中...")
                pdf_data, filename = self._convert_tif_to_pdf(pdf_data, filename)

            # PDFを保存（回転修正は行わない）
            _send_progress_sync("PDFファイルを保存中...")
            pdf_save_start = time.time()
            new_filename, save_path = self.file_manager.save_pdf(
                pdf_data, filename, auto_rotate=False
            )
            # PDF保存後ファイル存在チェック
            if not save_path or not Path(save_path).exists():
                logger.error(f"[ERROR] PDF保存失敗: {save_path}")
                raise DrawingServiceException(f"PDF保存失敗: {save_path}")
            pdf_save_time = time.time() - pdf_save_start
            _send_progress_sync(f"PDF保存完了 ({pdf_save_time:.1f}秒)", "success")

            # ページ数を取得
            from app.services.pdf_converter import PDFConverter

            converter = PDFConverter()
            page_count = converter.get_page_count(save_path)
            if not isinstance(page_count, int) or page_count <= 0:
                logger.error(f"[ERROR] PDFページ数取得失敗: {page_count}")
                raise DrawingServiceException(f"PDFページ数取得失敗: {page_count}")

            logger.info(f"PDF saved: {save_path} ({page_count} pages)")

            # 各ページごとにDrawingレコードを作成
            # 注意: サムネイルはAI解析後（回転補正後）に生成するため、ここでは仮の値を設定
            drawings: List[Drawing] = []

            for page_num in range(page_count):
                # Drawingレコード作成（サムネイルは後で生成）
                initial_status = "pending" if run_analysis else "unapproved"
                drawing = Drawing(
                    original_filename=filename,  # 元のファイル名を保存
                    pdf_filename=new_filename,
                    pdf_path=save_path,  # 必須項目
                    page_number=page_num,
                    thumbnail_path="pending.png",  # 仮の値（後で更新）
                    status=initial_status,
                    created_by=created_by,
                )
                # 必須フィールドチェック
                if not drawing.pdf_filename:
                    logger.error(f"[ERROR] Drawing生成パラメータ不備: {drawing}")
                    raise DrawingServiceException("Drawing生成パラメータ不備")

                self.db.add(drawing)
                self.db.flush()  # IDを取得

                drawings.append(drawing)

                logger.info(f"Drawing created: ID={drawing.id}, page={page_num + 1}/{page_count}")

            self.db.commit()

            # AI解析を実行（バックグラウンド）
            if run_analysis:
                # AI解析サービスを初期化（接続テストも実行される）
                try:
                    if self._ai_service is None:
                        self._ai_service = AIAnalysisService()
                    logger.info("AI connection verified before analysis")
                except Exception as e:
                    error_msg = f"AI接続に失敗しました。アップロードを中止します: {str(e)}"
                    logger.error(error_msg)
                    # 作成した図面を削除
                    for drawing in drawings:
                        try:
                            self.file_manager.delete_pdf(drawing.pdf_filename)
                            if drawing.thumbnail_path:
                                self.file_manager.delete_thumbnail(drawing.thumbnail_path)
                        except Exception as cleanup_error:
                            logger.warning(
                                f"Failed to cleanup drawing {drawing.id}: {cleanup_error}"
                            )
                        self.db.delete(drawing)
                    self.db.commit()
                    raise DrawingServiceException(error_msg)

                # AI接続が確認できたので解析を実行
                for drawing in drawings:
                    try:
                        self._run_analysis(drawing)
                    except Exception as e:
                        logger.error(f"Analysis failed for drawing {drawing.id}: {e}")
                        drawing.status = "failed"
                        self.db.commit()
            else:
                # マニュアルアップロード（AI解析スキップ）の場合はサムネイルのみ生成
                _send_progress_sync("サムネイル生成中（マニュアルアップロード）...")
                for drawing in drawings:
                    try:
                        thumbnail_path = self.file_manager.generate_thumbnail(
                            save_path, drawing.page_number, rotation=0
                        )
                        drawing.thumbnail_path = Path(thumbnail_path).name
                        drawing.rotation = 0
                        self.db.commit()
                        logger.info(f"Thumbnail generated for manual upload: {thumbnail_path}")
                    except Exception as e:
                        logger.warning(f"Failed to generate thumbnail for drawing {drawing.id}: {e}")
                        _send_progress_sync(f"サムネイル生成に失敗しました: {str(e)}", "warning")
                _send_progress_sync("マニュアルアップロード完了", "success")

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
        AI解析を実行（各ステップの処理時間を計測してWebSocket通知）

        Args:
            drawing: Drawingオブジェクト
        """
        try:
            logger.info(f"Starting analysis for drawing {drawing.id}")
            total_start = time.time()

            # ステータス更新
            drawing.status = "analyzing"
            self.db.commit()

            # PDFパスを取得
            pdf_path = self.file_manager.get_pdf_path(drawing.pdf_filename)
            logger.info(f"[DEBUG] PDF path for analysis: {pdf_path}")
            logger.info(f"[DEBUG] PDF exists: {Path(pdf_path).exists() if pdf_path else False}")

            # AI解析実行
            if self._ai_service is None:
                self._ai_service = AIAnalysisService()

            # ========== Step 0: PDFサイズ確認（メタデータは使用しない） ==========
            _send_progress_sync("PDF前処理中...")
            try:
                import fitz
                doc = fitz.open(pdf_path)
                page = doc[0]
                # デバッグ用: PDFの物理サイズを取得（メタデータ回転は無視）
                pdf_width = page.rect.width
                pdf_height = page.rect.height
                metadata_rotation = page.rotation  # 参考情報のみ（処理には使用しない）
                doc.close()

                _send_progress_sync(f"【DEBUG】PDFサイズ: {pdf_width:.0f}x{pdf_height:.0f} (メタデータ回転={metadata_rotation}度 ※処理には使用しない)")
                logger.info(f"[DEBUG] PDF size: {pdf_width}x{pdf_height}, metadata_rotation={metadata_rotation} (ignored)")
            except Exception as e:
                logger.warning(f"PDF info read failed: {e}")
                _send_progress_sync("PDF情報読み取りエラー", "warning")

            # ========== Step 1: AI回転検出 ==========
            # PDFをそのままAI解析に渡し、コンテンツの向きを判定
            # メタデータは一切使用せず、AIの判断のみで回転を決定
            _send_progress_sync("[1/6] AI回転検出を開始...")
            _send_progress_sync("【DEBUG】※PDFメタデータは使用せず、AIのみでコンテンツの向きを判定します")
            step_start = time.time()

            try:
                rotation_result = self._ai_service.detect_rotation(pdf_path, drawing.page_number)
                detected_rotation = rotation_result.get("rotation", 0)
                rotation_confidence = rotation_result.get("confidence", 0)
                original_orientation = rotation_result.get("original_orientation", "不明")

                logger.info(f"AI detected rotation: {detected_rotation} degrees (confidence: {rotation_confidence}%)")
                _send_progress_sync(f"【DEBUG】AI判定結果: 現在の向き={original_orientation}, 必要な回転={detected_rotation}度, 信頼度={rotation_confidence}%")

                # 回転が必要な場合、PDFコンテンツを回転
                if detected_rotation != 0 and rotation_confidence >= 70:
                    # 回転前のサイズを取得
                    doc = fitz.open(pdf_path)
                    before_width = doc[0].rect.width
                    before_height = doc[0].rect.height
                    doc.close()

                    _send_progress_sync(f"【DEBUG】回転前サイズ: {before_width:.0f}x{before_height:.0f}")
                    _send_progress_sync(f"コンテンツを{detected_rotation}度回転補正中...")

                    self.file_manager.rotate_pdf_content(pdf_path, detected_rotation)

                    # 回転後のサイズを取得
                    doc = fitz.open(pdf_path)
                    after_width = doc[0].rect.width
                    after_height = doc[0].rect.height
                    doc.close()

                    logger.info(f"PDF content rotated by {detected_rotation} degrees: {before_width}x{before_height} -> {after_width}x{after_height}")
                    _send_progress_sync(f"【DEBUG】回転後サイズ: {after_width:.0f}x{after_height:.0f}")
                    _send_progress_sync(f"回転補正完了（{detected_rotation}度）", "success")
                else:
                    _send_progress_sync(f"【DEBUG】回転不要（検出={detected_rotation}度, 信頼度={rotation_confidence}%）")

                drawing.rotation = 0  # 補正後は常に0
            except Exception as e:
                logger.warning(f"AI rotation detection failed: {e}")
                _send_progress_sync(f"【DEBUG】AI回転検出エラー: {str(e)}", "warning")
                detected_rotation = 0
                drawing.rotation = 0

            step_time = time.time() - step_start
            _send_progress_sync(f"[1/6] 回転検出完了 ({step_time:.1f}秒) - {detected_rotation}度補正", "success")

            # サムネイル生成（回転補正済みPDFから生成）
            _send_progress_sync("サムネイル生成中...")
            thumb_start = time.time()
            try:
                thumbnail_path = self.file_manager.generate_thumbnail(
                    pdf_path, drawing.page_number, rotation=0
                )
                drawing.thumbnail_path = Path(thumbnail_path).name
                self.db.commit()
                thumb_time = time.time() - thumb_start
                logger.info(f"Thumbnail generated from corrected PDF: {thumbnail_path}")
                _send_progress_sync(f"サムネイル生成完了 ({thumb_time:.1f}秒)", "success")
            except Exception as e:
                logger.warning(f"Failed to generate thumbnail: {e}")
                _send_progress_sync("サムネイル生成失敗", "warning")

            # 以降の解析は回転補正済みのPDFを使用

            # ========== Step 2: 図枠情報抽出 ==========
            _send_progress_sync("[2/6] 図枠情報抽出を開始...")
            step_start = time.time()

            fields_result = self._ai_service.analyze_drawing(pdf_path, drawing.page_number)

            step_time = time.time() - step_start
            field_count = len(fields_result.get("fields", []))
            _send_progress_sync(f"[2/6] 図枠情報抽出完了 ({step_time:.1f}秒) - {field_count}項目抽出", "success")

            # ========== Step 3: 分類 ==========
            _send_progress_sync("[3/6] 図面分類を開始...")
            step_start = time.time()

            classification_result = self._ai_service.classify_drawing(pdf_path, drawing.page_number)

            step_time = time.time() - step_start
            category = classification_result.get("category", "不明")
            _send_progress_sync(f"[3/6] 図面分類完了 ({step_time:.1f}秒) - {category}", "success")

            # ========== Step 4: 風船抽出 ==========
            _send_progress_sync("[4/6] 風船情報抽出を開始...")
            step_start = time.time()

            # PDFは既に回転補正済みなので、rotation_angle=0で呼び出す
            balloons_result = self._ai_service.extract_balloons(
                pdf_path, drawing.page_number, rotation_angle=0
            )

            step_time = time.time() - step_start
            balloon_count = len(balloons_result.get("balloons", []))
            _send_progress_sync(f"[4/6] 風船情報抽出完了 ({step_time:.1f}秒) - {balloon_count}個検出", "success")

            # ========== Step 5: 改訂履歴抽出 ==========
            _send_progress_sync("[5/6] 改訂履歴抽出を開始...")
            step_start = time.time()

            revisions_result = self._ai_service.extract_revisions(pdf_path, drawing.page_number)

            step_time = time.time() - step_start
            revision_count = len(revisions_result.get("revisions", []))
            _send_progress_sync(f"[5/6] 改訂履歴抽出完了 ({step_time:.1f}秒) - {revision_count}件検出", "success")

            # ========== Step 6: 要約生成 ==========
            _send_progress_sync("[6/6] 要約生成を開始...")
            step_start = time.time()

            summary_result = self._ai_service.generate_summary(pdf_path, drawing.page_number)

            step_time = time.time() - step_start
            _send_progress_sync(f"[6/6] 要約生成完了 ({step_time:.1f}秒)", "success")

            # ========== 結果の保存 ==========
            # 図枠情報を保存（図番の補正を適用）
            for field_data in fields_result.get("fields", []):
                coordinates = field_data.get("coordinates", {})
                field_name = field_data.get("name", "")
                field_value = field_data.get("value", "")

                # 図番の場合、パターン補正を適用
                if field_name == "図番" and field_value:
                    field_value = _correct_drawing_number(field_value)

                extracted_field = ExtractedField(
                    drawing_id=drawing.id,
                    field_name=field_name,
                    field_value=field_value,
                    confidence=field_data.get("confidence", 0),
                    coordinates=coordinates,
                )
                self.db.add(extracted_field)

            # 分類情報を保存
            drawing.classification = classification_result.get("category")
            drawing.classification_confidence = classification_result.get("confidence")

            # 風船情報を保存
            for balloon_data in balloons_result.get("balloons", []):
                coordinates = balloon_data.get("coordinates", {})
                balloon = Balloon(
                    drawing_id=drawing.id,
                    balloon_number=balloon_data.get("balloon_number", ""),
                    part_name=balloon_data.get("part_name", ""),
                    quantity=balloon_data.get("quantity"),
                    upper_text=balloon_data.get("upper_text", ""),
                    lower_text=balloon_data.get("lower_text", ""),
                    confidence=balloon_data.get("confidence", 0),
                    x=coordinates.get("x", balloon_data.get("x", 0)),
                    y=coordinates.get("y", balloon_data.get("y", 0)),
                )
                self.db.add(balloon)

            # 改訂履歴を保存
            for revision_data in revisions_result.get("revisions", []):
                revision_date = None
                if revision_data.get("revision_date"):
                    try:
                        revision_date = datetime.strptime(
                            revision_data["revision_date"], "%Y-%m-%d"
                        ).date()
                    except (ValueError, TypeError):
                        logger.warning(
                            f"Invalid revision date format: {revision_data.get('revision_date')}"
                        )

                revision = Revision(
                    drawing_id=drawing.id,
                    revision_number=revision_data.get("revision_number", ""),
                    revision_date=revision_date,
                    revision_content=revision_data.get(
                        "description", revision_data.get("revision_content", "")
                    ),
                    reviser=revision_data.get("author", revision_data.get("reviser", "")),
                    confidence=revision_data.get("confidence", 0),
                )
                self.db.add(revision)

            # 要約・形状特徴を保存
            drawing.summary = summary_result.get("summary", "")
            drawing.shape_features = summary_result.get("shape_features", {})

            # ステータス更新
            drawing.status = "unapproved"
            drawing.analyzed_at = datetime.utcnow()

            self.db.commit()

            # 合計時間の通知
            total_time = time.time() - total_start
            _send_progress_sync(f"AI解析完了 (合計 {total_time:.1f}秒)", "success")
            logger.info(f"AI解析完了 (合計 {total_time:.1f}秒)")

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
                old_thumbnail_path = (
                    Path(self.file_manager.thumbnails_path) / drawing.thumbnail_path
                )
                if old_thumbnail_path.exists():
                    # サムネイルファイル名を新しいPDFファイル名に基づいて生成
                    # generate_thumbnailと同じロジックを使用
                    new_filename_stem = Path(new_filename).stem
                    if drawing.page_number > 0:
                        new_thumbnail_filename = (
                            f"{new_filename_stem}_page{drawing.page_number}.png"
                        )
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
                f"Renamed file for drawing {drawing.id}: " f"{old_filename} -> {new_filename}"
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
        from app.models.spec_sheet_item import SpecSheetItem

        return (
            self.db.query(Drawing)
            .options(
                joinedload(Drawing.spec_sheet_item).joinedload(SpecSheetItem.spec_sheet)
            )
            .filter(Drawing.id == drawing_id)
            .first()
        )

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
        from app.models.spec_sheet_item import SpecSheetItem
        from app.models.spec_sheet import SpecSheet

        query = self.db.query(Drawing).options(
            joinedload(Drawing.spec_sheet_item).joinedload(SpecSheetItem.spec_sheet)
        )

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
                    Drawing.original_filename.ilike(search_pattern),
                )
            )
        if tags:
            # タグフィルタ（いずれかのタグを持つ図面）
            query = query.join(Tag).filter(Tag.tag_name.in_(tags))

        # ページネーション
        query = query.order_by(Drawing.upload_date.desc())
        query = query.offset(skip).limit(limit)

        return query.all()

    def update_drawing(self, drawing_id: str, updates: Dict[str, Any]) -> Optional[Drawing]:
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
                        self.file_manager.delete_thumbnail(Path(drawing.thumbnail_path).name)

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
        return self.update_drawing(drawing_id, {"status": "unapproved", "approved_date": None})

    def _convert_tif_to_pdf(self, tif_data: bytes, filename: str) -> tuple[bytes, str]:
        """
        TIFファイルをPDFに変換

        Args:
            tif_data: TIFファイルデータ
            filename: TIFファイル名

        Returns:
            (PDFデータ, PDFファイル名)

        Raises:
            DrawingServiceException: 変換エラー
        """
        import tempfile
        from app.services.pdf_converter import PDFConverter, TIFConversionError

        try:
            # 一時ファイルにTIFを保存
            with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as temp_tif:
                temp_tif.write(tif_data)
                temp_tif_path = Path(temp_tif.name)

            # PDFに変換
            temp_pdf_path = temp_tif_path.with_suffix(".pdf")
            PDFConverter.tif_to_pdf(temp_tif_path, temp_pdf_path)

            # 変換されたPDFを読み込み
            with open(temp_pdf_path, "rb") as f:
                pdf_data = f.read()

            # 元のファイル名をPDF拡張子に変更
            pdf_filename = Path(filename).with_suffix(".pdf").name

            # 一時ファイルを削除
            temp_tif_path.unlink()
            temp_pdf_path.unlink()

            logger.info(f"TIF to PDF conversion successful: {filename} -> {pdf_filename}")

            return pdf_data, pdf_filename

        except TIFConversionError as e:
            raise DrawingServiceException(f"TIF変換エラー: {str(e)}")
        except Exception as e:
            logger.error(f"TIF conversion error: {str(e)}")
            raise DrawingServiceException(f"TIF変換エラー: {str(e)}")

    def link_to_spec_sheet_item(
        self,
        drawing_id: str,
        spec_sheet_item_id: str,
        spec_number: str
    ) -> Drawing:
        """
        図面を摘要表部品に紐づける

        Args:
            drawing_id: 図面ID
            spec_sheet_item_id: 摘要表部品ID
            spec_number: 摘番

        Returns:
            更新された図面

        Raises:
            DrawingServiceException: 図面が見つからない場合
        """
        drawing = self.get_drawing(drawing_id)
        if not drawing:
            raise DrawingServiceException(f"図面が見つかりません: {drawing_id}")

        drawing.spec_sheet_item_id = spec_sheet_item_id
        drawing.spec_number = spec_number

        self.db.commit()
        self.db.refresh(drawing)

        logger.info(f"図面を摘要表部品に紐づけ: {drawing_id} -> {spec_sheet_item_id}")
        return drawing

    def unlink_from_spec_sheet_item(self, drawing_id: str) -> Drawing:
        """
        図面の摘要表紐づけを解除する

        Args:
            drawing_id: 図面ID

        Returns:
            更新された図面

        Raises:
            DrawingServiceException: 図面が見つからない場合
        """
        drawing = self.get_drawing(drawing_id)
        if not drawing:
            raise DrawingServiceException(f"図面が見つかりません: {drawing_id}")

        drawing.spec_sheet_item_id = None
        drawing.spec_number = None

        self.db.commit()
        self.db.refresh(drawing)

        logger.info(f"図面の摘要表紐づけを解除: {drawing_id}")
        return drawing
