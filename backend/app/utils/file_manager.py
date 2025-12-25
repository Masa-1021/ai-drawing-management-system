"""
ファイル管理マネージャー

PDF保存、削除、サムネイル生成などのファイル操作を管理
"""

import shutil
import uuid
import re
import logging
from pathlib import Path
from typing import Optional, Tuple, Any
from datetime import datetime
import fitz  # PyMuPDF
from PIL import Image
from io import BytesIO

logger = logging.getLogger(__name__)


class FileManager:
    """ファイル管理クラス"""

    def __init__(self, storage_path: Optional[str] = None):
        """
        初期化

        Args:
            storage_path: ストレージディレクトリのパス。Noneの場合はデフォルトパス
        """
        if storage_path:
            self.storage_path = Path(storage_path)
        else:
            # /app/app/utils/file_manager.py から /app/storage への相対パス
            # parent.parent.parent = /app
            project_root = Path(__file__).parent.parent.parent
            self.storage_path = project_root / "storage"

        self.drawings_path = self.storage_path / "drawings"
        self.thumbnails_path = self.storage_path / "thumbnails"

        # ディレクトリを作成
        self.drawings_path.mkdir(parents=True, exist_ok=True)
        self.thumbnails_path.mkdir(parents=True, exist_ok=True)

    def detect_rotation(self, pdf_path: str, page_num: int = 0) -> int:
        """
        PDFページの回転角度を検出

        Args:
            pdf_path: PDFファイルのパス
            page_num: ページ番号（0始まり）

        Returns:
            回転角度（0, 90, 180, 270）
        """
        doc = fitz.open(pdf_path)
        page = doc[page_num]
        rotation = page.rotation
        doc.close()
        return rotation

    def flatten_pdf(self, pdf_path: str) -> None:
        """
        PDFのメタデータ回転を視覚的に適用してフラット化する

        メタデータの回転（page.rotation）を実際のコンテンツに適用し、
        回転メタデータを0にリセットする。これにより、
        表示される内容と物理的なページサイズが一致する。

        Args:
            pdf_path: PDFファイルのパス
        """
        import tempfile
        import os
        import shutil

        src_doc = None
        try:
            src_doc = fitz.open(pdf_path)
            first_page = src_doc[0]
            metadata_rotation = first_page.rotation

            if metadata_rotation == 0:
                logger.info("PDF already flattened (rotation=0), skipping")
                src_doc.close()
                return

            src_doc.close()
            src_doc = None

            logger.info(f"Flattening PDF with metadata rotation {metadata_rotation}")

        except Exception as e:
            if src_doc is not None:
                src_doc.close()
            logger.error(f"Failed to check PDF rotation: {e}")
            raise e

        # フラット化処理（rotate=0でshow_pdf_page）
        temp_fd, temp_path = tempfile.mkstemp(suffix=".pdf")
        os.close(temp_fd)

        src_doc = None
        dst_doc = None
        try:
            src_doc = fitz.open(pdf_path)
            dst_doc = fitz.open()

            for page_num in range(src_doc.page_count):
                src_page = src_doc[page_num]
                src_rotation = src_page.rotation

                # page.rectは物理的なサイズ（回転なし）
                # 90度/270度回転の場合、表示サイズは幅と高さが入れ替わる
                physical_rect = src_page.rect
                if src_rotation in [90, 270]:
                    new_width = physical_rect.height
                    new_height = physical_rect.width
                else:
                    new_width = physical_rect.width
                    new_height = physical_rect.height

                # 新しいページを作成（回転後の表示サイズで）
                dst_page = dst_doc.new_page(width=new_width, height=new_height)

                # show_pdf_pageでコンテンツを描画
                # rotate=src_rotationを指定して、元のPDFの回転を適用してコンテンツを埋め込む
                dst_page.show_pdf_page(
                    dst_page.rect,
                    src_doc,
                    page_num,
                    rotate=src_rotation,
                )

                logger.debug(
                    f"Page {page_num + 1}: flattened from rotation {src_rotation}, "
                    f"size {new_width}x{new_height}"
                )

            # 一時ファイルに保存
            dst_doc.ez_save(temp_path)
            dst_doc.close()
            dst_doc = None
            src_doc.close()
            src_doc = None

            # Windowsでの問題を避けるため、少し待つ
            import time
            time.sleep(0.1)

            # 元のファイルを削除してから一時ファイルを移動
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
            shutil.move(temp_path, pdf_path)

            logger.info(f"PDF flattened: {pdf_path}")

        except Exception as e:
            if dst_doc is not None:
                try:
                    dst_doc.close()
                except Exception:
                    pass
            if src_doc is not None:
                try:
                    src_doc.close()
                except Exception:
                    pass
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception:
                pass
            logger.error(f"PDF flattening failed: {e}")
            raise e

    def rotate_pdf_content(self, pdf_path: str, rotation_angle: int) -> None:
        """
        PDFの全ページのコンテンツ自体を指定角度だけ回転して保存

        まずPDFをフラット化（メタデータ回転を適用）してから、
        指定された回転角度を追加で適用する。

        Args:
            pdf_path: PDFファイルのパス
            rotation_angle: 回転角度（90, 180, 270）時計回り
        """
        import tempfile
        import os
        import shutil

        # 回転角度を正規化（0, 90, 180, 270）
        rotation_angle = rotation_angle % 360

        # まずPDFをフラット化（メタデータ回転を適用）
        self.flatten_pdf(pdf_path)

        if rotation_angle == 0:
            logger.info("Rotation angle is 0, only flattening was applied")
            return

        # 一時ファイルを作成
        temp_fd, temp_path = tempfile.mkstemp(suffix=".pdf")
        os.close(temp_fd)

        src_doc = None
        dst_doc = None
        try:
            # フラット化されたPDFを開く
            src_doc = fitz.open(pdf_path)
            # 新しいPDFを作成
            dst_doc = fitz.open()

            for page_num in range(src_doc.page_count):
                src_page = src_doc[page_num]

                # フラット化後はrectがそのまま物理サイズ
                src_rect = src_page.rect
                w, h = src_rect.width, src_rect.height

                # 90度または270度回転の場合、幅と高さを入れ替える
                if rotation_angle in [90, 270]:
                    new_width, new_height = h, w
                else:
                    new_width, new_height = w, h

                # 新しいページを作成
                dst_page = dst_doc.new_page(width=new_width, height=new_height)

                # show_pdf_page()で回転を適用してコンテンツを埋め込む
                dst_page.show_pdf_page(
                    dst_page.rect,
                    src_doc,
                    page_num,
                    rotate=rotation_angle,
                )

                logger.debug(
                    f"Page {page_num + 1}: rotated {rotation_angle} degrees, "
                    f"size {w}x{h} -> {new_width}x{new_height}"
                )

            # 一時ファイルに保存
            dst_doc.ez_save(temp_path)
            dst_doc.close()
            dst_doc = None
            src_doc.close()
            src_doc = None

            # Windowsでの問題を避けるため、少し待つ
            import time
            time.sleep(0.1)

            # 元のファイルを削除してから一時ファイルを移動
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
            shutil.move(temp_path, pdf_path)

            logger.info(f"PDF content rotated {rotation_angle} degrees: {pdf_path}")

        except Exception as e:
            # ドキュメントが開いていたら閉じる
            if dst_doc is not None:
                try:
                    dst_doc.close()
                except Exception:
                    pass
            if src_doc is not None:
                try:
                    src_doc.close()
                except Exception:
                    pass

            # 一時ファイルを削除
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception:
                pass
            logger.error(f"PDF rotation failed: {e}")
            raise e

    def rotate_pdf(self, pdf_path: str, rotation_angle: int) -> None:
        """
        PDFの全ページを指定角度だけ回転して保存（コンテンツ回転版）

        後方互換性のためのエイリアス。rotate_pdf_content()を呼び出す。

        Args:
            pdf_path: PDFファイルのパス
            rotation_angle: 回転角度（90, 180, 270）時計回り
        """
        self.rotate_pdf_content(pdf_path, rotation_angle)

    def auto_correct_rotation(self, pdf_path: str, ai_service: Optional[Any] = None) -> int:
        """
        PDFの回転を自動検出して0度に修正

        検出方法:
        1. PDFメタデータの回転情報を確認
        2. AIによる画像内容解析（オプション、ai_serviceが提供された場合）

        Args:
            pdf_path: PDFファイルのパス
            ai_service: AI解析サービス（オプション、画像内容解析に使用）

        Returns:
            修正した角度（元の回転角度）
        """
        # 1. PDFメタデータから回転角度を取得
        metadata_rotation = self.detect_rotation(pdf_path, 0)

        # 2. AIによる画像内容解析（ai_serviceが提供された場合）
        ai_rotation = None
        ai_confidence = 0

        if ai_service:
            try:
                from pathlib import Path

                ai_result = ai_service.detect_rotation(Path(pdf_path), 0)
                ai_rotation = ai_result.get("rotation", 0)
                ai_confidence = ai_result.get("confidence", 0)

                logger.info(
                    f"AI rotation detection: {ai_rotation} degrees "
                    f"(confidence: {ai_confidence}%)"
                )
            except Exception as e:
                logger.warning(f"AI rotation detection failed: {e}")
                # AI検出失敗時はメタデータのみを使用

        # 3. 回転角度を決定
        # AI検出の信頼度が70%以上の場合、AIの結果を優先
        # それ以外はメタデータを優先
        if ai_service and ai_rotation is not None and ai_confidence >= 70:
            final_rotation = ai_rotation
            logger.info(
                f"Using AI detection result: {final_rotation} degrees "
                f"(confidence: {ai_confidence}%)"
            )
        else:
            final_rotation = metadata_rotation
            if ai_service and ai_rotation is not None:
                logger.info(
                    f"Using metadata rotation: {final_rotation} degrees "
                    f"(AI confidence too low: {ai_confidence}%)"
                )
            else:
                logger.info(f"Using metadata rotation: {final_rotation} degrees")

        # 4. 回転を修正
        if final_rotation != 0:
            # 0度に戻すための角度を計算（反対方向に回転）
            correction_angle = -final_rotation
            self.rotate_pdf(pdf_path, correction_angle)
            logger.info(f"PDF rotation corrected: {final_rotation} degrees → 0 degrees")
            return final_rotation

        return 0

    def save_pdf(
        self,
        pdf_bytes: bytes,
        original_filename: str,
        auto_rotate: bool = True,
        ai_service: Optional[Any] = None,
    ) -> Tuple[str, str]:
        """
        PDFファイルを保存（オプションで自動回転修正）

        Args:
            pdf_bytes: PDFのバイトデータ
            original_filename: 元のファイル名
            auto_rotate: 自動回転修正を行うか（デフォルト: True）
            ai_service: AI解析サービス（オプション、画像内容解析に使用）

        Returns:
            (保存したファイル名, 保存先の絶対パス)
        """
        # UUIDでファイル名を生成
        file_id = str(uuid.uuid4())
        # 拡張子は常に.pdfとする（TIFから変換された場合も対応）
        new_filename = f"{file_id}.pdf"

        # 保存先パス
        save_path = self.drawings_path / new_filename

        # ファイルを保存
        with open(save_path, "wb") as f:
            f.write(pdf_bytes)

        # 自動回転修正
        if auto_rotate:
            original_rotation = self.auto_correct_rotation(str(save_path), ai_service=ai_service)
            if original_rotation != 0:
                logger.info(f"PDF回転を検出: {original_rotation}度 → 0度に修正しました")

        return new_filename, str(save_path)

    def delete_pdf(self, filename: str) -> bool:
        """
        PDFファイルを削除

        Args:
            filename: ファイル名

        Returns:
            削除成功: True, ファイルが存在しない: False
        """
        file_path = self.drawings_path / filename

        if file_path.exists():
            file_path.unlink()
            return True
        return False

    def generate_thumbnail(
        self,
        pdf_path: str,
        page_num: int = 0,
        max_size: Tuple[int, int] = (200, 300),
        rotation: int = 0,
    ) -> str:
        """
        PDFのサムネイルを生成

        Args:
            pdf_path: PDFファイルのパス
            page_num: ページ番号（0始まり）
            max_size: サムネイルの最大サイズ (width, height)
            rotation: AIで検出された回転角度 (0, 90, 180, 270)

        Returns:
            サムネイルファイルのパス
        """
        pdf_path = Path(pdf_path)

        # サムネイルファイル名（ページ番号を含む）
        if page_num > 0:
            thumbnail_filename = f"{pdf_path.stem}_page{page_num}.png"
        else:
            thumbnail_filename = f"{pdf_path.stem}.png"
        thumbnail_path = self.thumbnails_path / thumbnail_filename

        # PDFを開く
        doc = fitz.open(pdf_path)
        page = doc[page_num]  # 指定されたページ

        # PDFメタデータの回転情報を無視する（AIの回転検出結果のみを使用）
        pdf_rotation = page.rotation
        if pdf_rotation != 0:
            logger.info(f"Ignoring PDF metadata rotation for thumbnail: {pdf_rotation} degrees")
            page.set_rotation(0)

        # 50%のサイズで画像化
        zoom = 0.5
        mat = fitz.Matrix(zoom, zoom)

        # pixmapを取得（PDFメタデータの回転は無視された状態）
        pix = page.get_pixmap(matrix=mat)

        # PIL Imageに変換
        img_bytes = pix.tobytes("png")
        img = Image.open(BytesIO(img_bytes))

        # rotationパラメータに基づいて画像を回転
        # このrotationはAI解析や他の処理から渡される補正角度
        # PIL.Image.rotateは反時計回りが正なので、時計回りの回転には負の角度を指定
        if rotation == 90:
            img = img.rotate(-90, expand=True)
        elif rotation == 180:
            img = img.rotate(180, expand=True)
        elif rotation == 270:
            img = img.rotate(-270, expand=True)

        # サムネイルサイズに縮小
        img.thumbnail(max_size, Image.Resampling.LANCZOS)

        # 保存
        img.save(thumbnail_path, "PNG")

        doc.close()

        return str(thumbnail_path)

    def delete_thumbnail(self, filename: str) -> bool:
        """
        サムネイルファイルを削除

        Args:
            filename: サムネイルファイル名

        Returns:
            削除成功: True, ファイルが存在しない: False
        """
        thumbnail_path = self.thumbnails_path / filename

        if thumbnail_path.exists():
            thumbnail_path.unlink()
            return True
        return False

    def get_pdf_path(self, filename: str) -> Optional[str]:
        """
        PDFファイルの絶対パスを取得

        Args:
            filename: ファイル名

        Returns:
            絶対パス。ファイルが存在しない場合はNone
        """
        file_path = self.drawings_path / filename

        if file_path.exists():
            return str(file_path)
        return None

    def get_thumbnail_path(self, filename: str) -> Optional[str]:
        """
        サムネイルファイルの絶対パスを取得

        Args:
            filename: サムネイルファイル名

        Returns:
            絶対パス。ファイルが存在しない場合はNone
        """
        thumbnail_path = self.thumbnails_path / filename

        if thumbnail_path.exists():
            return str(thumbnail_path)
        return None

    def sanitize_filename(self, text: str) -> str:
        """
        ファイル名に使えない文字を置換

        Args:
            text: 元のテキスト

        Returns:
            サニタイズされたテキスト
        """
        # Windows/Linuxで使えない文字を置換
        invalid_chars = r'[<>:"/\\|?*\x00-\x1f]'
        sanitized = re.sub(invalid_chars, "_", text)
        # 連続するアンダースコアを1つに
        sanitized = re.sub(r"_+", "_", sanitized)
        # 先頭・末尾のアンダースコアを削除
        sanitized = sanitized.strip("_")
        # 空文字列の場合は"unknown"に
        if not sanitized:
            sanitized = "unknown"
        return sanitized

    def generate_drawing_filename(
        self,
        timestamp: datetime,
        classification: Optional[str],
        drawing_number: Optional[str],
        created_by: str,
    ) -> str:
        """
        図面ファイル名を生成

        形式: タイムスタンプ_分類_図番_作成者.pdf

        Args:
            timestamp: アップロード日時
            classification: 分類（部品図、ユニット図、組図）
            drawing_number: 図番
            created_by: 作成者

        Returns:
            生成されたファイル名
        """
        # タイムスタンプ（YYYYMMDDHHmmss形式）
        timestamp_str = timestamp.strftime("%Y%m%d%H%M%S")

        # 分類（空の場合は"未分類"）
        classification_str = self.sanitize_filename(classification or "未分類")

        # 図番（空の場合は"図番不明"）
        drawing_number_str = self.sanitize_filename(drawing_number or "図番不明")

        # 作成者（空の場合は"不明"）
        created_by_str = self.sanitize_filename(created_by or "不明")

        # ファイル名を組み立て
        filename = f"{timestamp_str}_{classification_str}_{drawing_number_str}_{created_by_str}.pdf"

        return filename

    def rename_pdf(self, old_filename: str, new_filename: str) -> Tuple[str, str]:
        """
        PDFファイルをリネーム

        Args:
            old_filename: 現在のファイル名
            new_filename: 新しいファイル名

        Returns:
            (新しいファイル名, 新しいファイルパス)

        Raises:
            FileNotFoundError: 元のファイルが存在しない場合
            FileExistsError: 新しいファイル名が既に存在する場合
        """
        old_path = self.drawings_path / old_filename
        new_path = self.drawings_path / new_filename

        if not old_path.exists():
            raise FileNotFoundError(f"ファイルが見つかりません: {old_filename}")

        if new_path.exists() and old_path != new_path:
            raise FileExistsError(f"ファイルが既に存在します: {new_filename}")

        # ファイルをリネーム
        old_path.rename(new_path)

        return new_filename, str(new_path)

    def check_disk_space(self) -> dict:
        """
        ディスク容量を確認

        Returns:
            {"total": 総容量, "used": 使用量, "free": 空き容量} (bytes)
        """
        stat = shutil.disk_usage(self.storage_path)
        return {"total": stat.total, "used": stat.used, "free": stat.free}

    def __repr__(self):
        return f"<FileManager(storage_path={self.storage_path})>"
