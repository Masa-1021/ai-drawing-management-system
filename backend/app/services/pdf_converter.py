"""
PDF → 画像変換サービス

PyMuPDFを使用してPDFを高品質な画像に変換する
TIFファイルをPDFに変換する機能も提供
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


class TIFConversionError(Exception):
    """TIF変換エラー"""

    pass


class PDFConverter:
    """PDF → 画像変換クラス"""

    def __init__(self, dpi: int = 300, image_format: str = "PNG", max_size_mb: int = 5):
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

                # PDFメタデータの回転情報を常に無視する（AIの回転検出のみを使用）
                pdf_rotation = page.rotation
                if pdf_rotation != 0:
                    logger.info(f"Page {page_num + 1}: Ignoring PDF metadata rotation: {pdf_rotation} degrees")
                    page.set_rotation(0)

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

            logger.info(f"PDF conversion complete: {len(images)} images generated")

            return images

        except Exception as e:
            logger.error(f"PDF conversion error: {str(e)}")
            raise PDFConversionError(f"PDF変換エラー: {str(e)}") from e

    def pdf_page_to_image(
        self,
        pdf_path: str | Path,
        page_num: int = 0,
        ignore_rotation: bool = False,
        rotation_angle: int = 0,
    ) -> bytes:
        """
        PDFの指定ページを画像に変換

        Args:
            pdf_path: PDFファイルパス
            page_num: ページ番号（0始まり）
            ignore_rotation: PDFの回転情報を無視するか（AI回転検出用）
            rotation_angle: 追加で適用する回転角度（0, 90, 180, 270）

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
                raise PDFConversionError(f"ページ番号が範囲外です: {page_num} (総ページ数: {doc.page_count})")

            # 指定ページを取得
            page = doc[page_num]

            # Matrixで拡大率を設定
            mat = fitz.Matrix(self.zoom, self.zoom)

            # ignore_rotation=True の場合、PDFメタデータの回転を無視
            # ignore_rotation=False（デフォルト）の場合、PDFの回転情報をそのまま使用
            pdf_rotation = page.rotation
            if ignore_rotation and pdf_rotation != 0:
                logger.info(f"[pdf_page_to_image] Ignoring PDF metadata rotation: {pdf_rotation} degrees")
                page.set_rotation(0)
            else:
                logger.info(f"[pdf_page_to_image] Using PDF metadata rotation: {pdf_rotation} degrees")

            # ページをPixmapに変換
            pix = page.get_pixmap(matrix=mat, alpha=False)

            # PNGとしてバイト列に変換
            img_data = pix.tobytes(output=self.image_format.lower())

            # 追加の回転を適用
            if rotation_angle != 0 and rotation_angle in [90, 180, 270]:
                from PIL import Image
                import io

                # バイトデータをPIL Imageに変換
                img = Image.open(io.BytesIO(img_data))

                # 回転を適用
                # AIが返す角度は「時計回りに回転させると正しい向きになる角度」
                # PIL.rotate()は反時計回りに回転するため、負の角度を指定して時計回りにする
                # 例: AI=90度(時計回り) → PIL.rotate(-90) = 時計回りに90度
                img = img.rotate(-rotation_angle, expand=True)

                # 再度バイトデータに変換
                output = io.BytesIO()
                img.save(output, format="PNG")
                img_data = output.getvalue()

            # サイズチェック
            if len(img_data) > self.max_size_bytes:
                # サイズオーバーの場合は圧縮
                img_data = self._compress_image(img_data, page_num)

            doc.close()

            logger.info(
                f"Page {page_num + 1} of {pdf_path.name} converted: "
                f"{len(img_data) / 1024:.1f} KB (ignore_rotation={ignore_rotation})"
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
            raise PDFConversionError(f"PDFページ数取得エラー: {str(e)}") from e

    def get_page_dimensions(self, pdf_path: str | Path, page_num: int = 0) -> Tuple[float, float]:
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
                raise PDFConversionError(f"ページ番号が範囲外です: {page_num} (総ページ数: {doc.page_count})")

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
            raise PDFConversionError(f"ページサイズ取得エラー: {str(e)}") from e

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

    @staticmethod
    def tif_to_pdf(tif_path: str | Path, output_pdf_path: str | Path | None = None) -> Path:
        """
        TIFファイルをPDFに変換

        Args:
            tif_path: TIFファイルパス
            output_pdf_path: 出力PDFファイルパス（指定しない場合は同じディレクトリに.pdfで保存）

        Returns:
            変換後のPDFファイルパス

        Raises:
            TIFConversionError: 変換エラー
        """
        tif_path = Path(tif_path)

        if not tif_path.exists():
            raise TIFConversionError(f"TIFファイルが見つかりません: {tif_path}")

        # 出力パスが指定されていない場合は同じディレクトリに.pdfで保存
        if output_pdf_path is None:
            output_pdf_path = tif_path.with_suffix(".pdf")
        else:
            output_pdf_path = Path(output_pdf_path)

        try:
            logger.info(f"Converting TIF to PDF: {tif_path} -> {output_pdf_path}")

            # TIFファイルを開く
            img = Image.open(tif_path)

            # RGBモードに変換（PDFに保存するため）
            if img.mode != "RGB":
                img = img.convert("RGB")

            # PDFとして保存
            img.save(output_pdf_path, "PDF", resolution=100.0)

            logger.info(f"TIF to PDF conversion complete: {output_pdf_path}")

            return output_pdf_path

        except Exception as e:
            logger.error(f"TIF to PDF conversion error: {str(e)}")
            raise TIFConversionError(f"TIF→PDF変換エラー: {str(e)}") from e

    def rotate_pdf(self, pdf_path: str | Path, page_num: int, rotation: int) -> str:
        """
        PDFの特定ページを回転させた一時ファイルを作成

        Args:
            pdf_path: 元のPDFファイルパス
            page_num: ページ番号（0始まり）
            rotation: 回転角度（90, 180, 270）

        Returns:
            回転後のPDFファイルパス

        Raises:
            PDFConversionError: 変換エラー
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise PDFConversionError(f"PDFファイルが見つかりません: {pdf_path}")

        if rotation not in [90, 180, 270]:
            raise PDFConversionError(f"無効な回転角度: {rotation}")

        try:
            # 一時ファイルパスを生成
            temp_path = pdf_path.parent / f"{pdf_path.stem}_rotated_{rotation}{pdf_path.suffix}"

            # PDFを開く
            doc = fitz.open(pdf_path)

            if page_num >= doc.page_count:
                raise PDFConversionError(f"ページ番号が範囲外です: {page_num} (総ページ数: {doc.page_count})")

            # ページを回転
            page = doc[page_num]
            page.set_rotation(rotation)

            # 新しいPDFとして保存
            doc.save(str(temp_path))
            doc.close()

            logger.info(
                f"PDF rotated: {pdf_path} page {page_num} -> {temp_path} ({rotation} degrees)"
            )

            return str(temp_path)

        except PDFConversionError:
            raise
        except Exception as e:
            logger.error(f"PDF rotation error: {str(e)}")
            raise PDFConversionError(f"PDF回転エラー: {str(e)}") from e
