"""
ファイル管理マネージャー

PDF保存、削除、サムネイル生成などのファイル操作を管理
"""

import shutil
import uuid
from pathlib import Path
from typing import Optional, Tuple
import fitz  # PyMuPDF
from PIL import Image
from io import BytesIO


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

    def auto_correct_rotation(self, pdf_path: str) -> int:
        """
        PDFの回転を自動検出して0度に修正

        Args:
            pdf_path: PDFファイルのパス

        Returns:
            修正した角度（元の回転角度）
        """
        rotation = self.detect_rotation(pdf_path, 0)

        if rotation != 0:
            # 0度に戻すための角度を計算（反対方向に回転）
            correction_angle = -rotation
            self.rotate_pdf(pdf_path, correction_angle)
            return rotation

        return 0

    def save_pdf(self, pdf_bytes: bytes, original_filename: str, auto_rotate: bool = True) -> Tuple[str, str]:
        """
        PDFファイルを保存（オプションで自動回転修正）

        Args:
            pdf_bytes: PDFのバイトデータ
            original_filename: 元のファイル名
            auto_rotate: 自動回転修正を行うか（デフォルト: True）

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
            original_rotation = self.auto_correct_rotation(str(save_path))
            if original_rotation != 0:
                print(f"[INFO] PDF回転を検出: {original_rotation}度 → 0度に修正しました")

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
