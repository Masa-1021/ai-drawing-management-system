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
            # プロジェクトルート/storage
            project_root = Path(__file__).parent.parent.parent.parent
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

    def rotate_pdf(self, pdf_path: str, rotation_angle: int) -> None:
        """
        PDFの全ページを指定角度だけ回転して保存

        Args:
            pdf_path: PDFファイルのパス
            rotation_angle: 回転角度（90, 180, 270, -90など）
        """
        import tempfile
        import os
        import shutil

        # 一時ファイルを作成
        temp_fd, temp_path = tempfile.mkstemp(suffix='.pdf')
        os.close(temp_fd)  # 即座に閉じる

        doc = None
        try:
            # 元のPDFを開く
            doc = fitz.open(pdf_path)

            # 全ページを回転
            for page in doc:
                # 現在の回転角度を取得
                current_rotation = page.rotation
                # 新しい回転角度を計算（累積ではなく絶対値）
                new_rotation = (current_rotation + rotation_angle) % 360
                page.set_rotation(new_rotation)

            # 一時ファイルに保存
            doc.save(temp_path, garbage=4, deflate=True, clean=True)
            doc.close()
            doc = None

            # Windowsでの問題を避けるため、少し待つ
            import time
            time.sleep(0.1)

            # 元のファイルを削除してから一時ファイルを移動
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
            shutil.move(temp_path, pdf_path)

        except Exception as e:
            # ドキュメントが開いていたら閉じる
            if doc is not None:
                try:
                    doc.close()
                except:
                    pass

            # 一時ファイルを削除
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except:
                pass
            raise e

    def auto_correct_rotation(
        self, pdf_path: str, ai_service: Optional[Any] = None
    ) -> int:
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
            logger.info(
                f"PDF rotation corrected: {final_rotation} degrees → 0 degrees"
            )
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
        file_extension = Path(original_filename).suffix
        new_filename = f"{file_id}{file_extension}"

        # 保存先パス
        save_path = self.drawings_path / new_filename

        # ファイルを保存
        with open(save_path, "wb") as f:
            f.write(pdf_bytes)

        # 自動回転修正
        if auto_rotate:
            original_rotation = self.auto_correct_rotation(
                str(save_path), ai_service=ai_service
            )
            if original_rotation != 0:
                logger.info(
                    f"PDF回転を検出: {original_rotation}度 → 0度に修正しました"
                )

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
        self, pdf_path: str, page_num: int = 0, max_size: Tuple[int, int] = (200, 300)
    ) -> str:
        """
        PDFのサムネイルを生成

        Args:
            pdf_path: PDFファイルのパス
            page_num: ページ番号（0始まり）
            max_size: サムネイルの最大サイズ (width, height)

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

        # 50%のサイズで画像化
        mat = fitz.Matrix(0.5, 0.5)
        pix = page.get_pixmap(matrix=mat)

        # PIL Imageに変換
        img_bytes = pix.tobytes("png")
        img = Image.open(BytesIO(img_bytes))

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
        sanitized = re.sub(invalid_chars, '_', text)
        # 連続するアンダースコアを1つに
        sanitized = re.sub(r'_+', '_', sanitized)
        # 先頭・末尾のアンダースコアを削除
        sanitized = sanitized.strip('_')
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
