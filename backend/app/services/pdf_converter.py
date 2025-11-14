"""
PDF → 画像変換サービス

PyMuPDFを使用してPDFを高品質な画像に変換する
"""

import logging
from pathlib import Path
from typing import List, Tuple
import fitz  # PyMuPDF
from PIL import Image
import io

logger = logging.getLogger(__name__)


class PDFConversionError(Exception):
    """PDF変換エラー"""

    pass


class PDFConverter:
    """PDF → 画像変換クラス"""

    def __init__(
        self, dpi: int = 300, image_format: str = "PNG", max_size_mb: int = 5
    ):
        """
        初期化

        Args:
            dpi: 解像度（デフォルト: 300）
            image_format: 出力画像フォーマット（PNG, JPEG）
            max_size_mb: 最大画像サイズ（MB）
        """
        self.dpi = dpi
        self.image_format = image_format.upper()
        self.max_size_bytes = max_size_mb * 1024 * 1024

        # DPIからzoom factorを計算（72 DPI = 1.0）
        self.zoom = dpi / 72.0

        logger.info(
            f"PDFConverter initialized: dpi={dpi}, format={image_format}, max_size={max_size_mb}MB"
        )

    def pdf_to_images(self, pdf_path: str | Path) -> List[bytes]:
        """
        PDFを画像リストに変換（全ページ）

        Args:
            pdf_path: PDFファイルパス

        Returns:
            画像データのリスト（各ページ1画像）

        Raises:
            PDFConversionError: 変換エラー
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise PDFConversionError(f"PDFファイルが見つかりません: {pdf_path}")

        try:
            images: List[bytes] = []

            # PDFを開く
            doc = fitz.open(pdf_path)

            logger.info(f"Converting PDF to images: {pdf_path} ({doc.page_count} pages)")

            # 各ページを画像化
            for page_num in range(doc.page_count):
                page = doc[page_num]

                # Matrixで拡大率を設定
                mat = fitz.Matrix(self.zoom, self.zoom)

                # ページをPixmapに変換
                pix = page.get_pixmap(matrix=mat, alpha=False)

                # PNGとしてバイト列に変換
                img_data = pix.tobytes(output=self.image_format.lower())

                # サイズチェック
                if len(img_data) > self.max_size_bytes:
                    # サイズオーバーの場合は圧縮
                    img_data = self._compress_image(img_data, page_num)

                images.append(img_data)

                logger.debug(
                    f"Page {page_num + 1}/{doc.page_count} converted: "
                    f"{len(img_data) / 1024:.1f} KB"
                )

            doc.close()

            logger.info(
                f"PDF conversion complete: {len(images)} images generated"
            )

            return images

        except Exception as e:
            logger.error(f"PDF conversion error: {str(e)}")
            raise PDFConversionError(f"PDF変換エラー: {str(e)}") from e

    def pdf_page_to_image(
        self, pdf_path: str | Path, page_num: int = 0
    ) -> bytes:
        """
        PDFの指定ページを画像に変換

        Args:
            pdf_path: PDFファイルパス
            page_num: ページ番号（0始まり）

        Returns:
            画像データ（バイト）

        Raises:
            PDFConversionError: 変換エラー
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise PDFConversionError(f"PDFファイルが見つかりません: {pdf_path}")

        try:
            # PDFを開く
            doc = fitz.open(pdf_path)

            if page_num >= doc.page_count:
                raise PDFConversionError(
                    f"ページ番号が範囲外です: {page_num} (総ページ数: {doc.page_count})"
                )

            # 指定ページを取得
            page = doc[page_num]

            # Matrixで拡大率を設定
            mat = fitz.Matrix(self.zoom, self.zoom)

            # ページをPixmapに変換
            pix = page.get_pixmap(matrix=mat, alpha=False)

            # PNGとしてバイト列に変換
            img_data = pix.tobytes(output=self.image_format.lower())

            # サイズチェック
            if len(img_data) > self.max_size_bytes:
                # サイズオーバーの場合は圧縮
                img_data = self._compress_image(img_data, page_num)

            doc.close()

            logger.info(
                f"Page {page_num + 1} of {pdf_path.name} converted: "
                f"{len(img_data) / 1024:.1f} KB"
            )

            return img_data

        except PDFConversionError:
            raise
        except Exception as e:
            logger.error(f"PDF page conversion error: {str(e)}")
            raise PDFConversionError(f"PDF変換エラー: {str(e)}") from e

    def get_page_count(self, pdf_path: str | Path) -> int:
        """
        PDFのページ数を取得

        Args:
            pdf_path: PDFファイルパス

        Returns:
            ページ数

        Raises:
            PDFConversionError: エラー
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise PDFConversionError(f"PDFファイルが見つかりません: {pdf_path}")

        try:
            doc = fitz.open(pdf_path)
            page_count = doc.page_count
            doc.close()
            return page_count

        except Exception as e:
            logger.error(f"Error reading PDF page count: {str(e)}")
            raise PDFConversionError(
                f"PDFページ数取得エラー: {str(e)}"
            ) from e

    def get_page_dimensions(
        self, pdf_path: str | Path, page_num: int = 0
    ) -> Tuple[float, float]:
        """
        ページのサイズ（幅、高さ）を取得

        Args:
            pdf_path: PDFファイルパス
            page_num: ページ番号（0始まり）

        Returns:
            (width, height) in points

        Raises:
            PDFConversionError: エラー
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise PDFConversionError(f"PDFファイルが見つかりません: {pdf_path}")

        try:
            doc = fitz.open(pdf_path)

            if page_num >= doc.page_count:
                raise PDFConversionError(
                    f"ページ番号が範囲外です: {page_num} (総ページ数: {doc.page_count})"
                )

            page = doc[page_num]
            rect = page.rect
            width = rect.width
            height = rect.height

            doc.close()

            return (width, height)

        except PDFConversionError:
            raise
        except Exception as e:
            logger.error(f"Error reading page dimensions: {str(e)}")
            raise PDFConversionError(
                f"ページサイズ取得エラー: {str(e)}"
            ) from e

    def _compress_image(self, img_data: bytes, page_num: int) -> bytes:
        """
        画像を圧縮してサイズを削減

        Args:
            img_data: 元画像データ
            page_num: ページ番号（ログ用）

        Returns:
            圧縮後の画像データ
        """
        try:
            # バイト列からPIL Imageに変換
            img = Image.open(io.BytesIO(img_data))

            # JPEG品質を下げて圧縮
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=85, optimize=True)
            compressed_data = output.getvalue()

            logger.warning(
                f"Page {page_num + 1} compressed: "
                f"{len(img_data) / 1024:.1f} KB → {len(compressed_data) / 1024:.1f} KB"
            )

            return compressed_data

        except Exception as e:
            logger.error(f"Image compression error: {str(e)}")
            # 圧縮失敗の場合は元データを返す
            return img_data
