#!/usr/bin/env python3
"""
DXFファイルをPDFに変換するスクリプト
"""

import sys
import ezdxf
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages


def dxf_to_pdf(dxf_path: str, pdf_path: str):
    """
    DXFファイルをPDFに変換

    Args:
        dxf_path: DXFファイルパス
        pdf_path: 出力PDFファイルパス
    """
    print(f"Loading DXF file: {dxf_path}")

    # DXFファイルを読み込み
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()

    # レンダリング設定
    fig = plt.figure(figsize=(11.69, 8.27))  # A4サイズ (横向き)
    ax = fig.add_axes([0, 0, 1, 1])
    ctx = RenderContext(doc)
    out = MatplotlibBackend(ax)

    # フロントエンドでレンダリング
    Frontend(ctx, out).draw_layout(msp, finalize=True)

    # PDFに保存
    print(f"Saving PDF file: {pdf_path}")
    with PdfPages(pdf_path) as pdf:
        pdf.savefig(fig, bbox_inches='tight')

    plt.close(fig)
    print(f"Conversion completed: {pdf_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python convert_dxf_to_pdf.py <input.dxf> <output.pdf>")
        sys.exit(1)

    dxf_file = sys.argv[1]
    pdf_file = sys.argv[2]

    try:
        dxf_to_pdf(dxf_file, pdf_file)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
