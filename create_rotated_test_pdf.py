"""
回転したテストPDFを作成するスクリプト
"""
import fitz  # PyMuPDF
from pathlib import Path

def create_rotated_pdfs():
    """既存のPDFを90, 180, 270度回転したバージョンを作成"""

    # プロジェクトルートからの相対パス
    source_pdf = Path(__file__).parent / "pdf" / "11160216.pdf"

    if not source_pdf.exists():
        print(f"[ERROR] ソースPDFが見つかりません: {source_pdf}")
        return

    # 出力ディレクトリ
    output_dir = Path(__file__).parent / "pdf" / "rotated"
    output_dir.mkdir(exist_ok=True)

    rotations = [90, 180, 270]

    for rotation in rotations:
        # PDFを開く
        doc = fitz.open(source_pdf)

        # 全ページを回転
        for page in doc:
            page.set_rotation(rotation)

        # 保存
        output_path = output_dir / f"11160216_rotated_{rotation}.pdf"
        doc.save(str(output_path))
        doc.close()

        print(f"[OK] 作成完了: {output_path} ({rotation}度回転)")

    print("\n全ての回転PDFを作成しました:")
    print(f"  - pdf/rotated/11160216_rotated_90.pdf")
    print(f"  - pdf/rotated/11160216_rotated_180.pdf")
    print(f"  - pdf/rotated/11160216_rotated_270.pdf")

if __name__ == "__main__":
    create_rotated_pdfs()
