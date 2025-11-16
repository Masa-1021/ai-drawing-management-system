#!/usr/bin/env python3
"""
PDFアップロード機能のテスト
"""

import requests
import sys
from pathlib import Path


def test_upload_pdf(pdf_path: str, run_analysis: bool = False):
    """
    PDFをバックエンドにアップロードしてテスト

    Args:
        pdf_path: PDFファイルパス
        run_analysis: AI解析を実行するか
    """
    url = "http://localhost:8000/api/v1/drawings/upload"

    # PDFファイルを読み込み
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        print(f"Error: PDF file not found: {pdf_path}")
        sys.exit(1)

    print(f"Uploading PDF: {pdf_path}")
    print(f"AI Analysis: {'Enabled' if run_analysis else 'Disabled'}")

    with open(pdf_file, 'rb') as f:
        files = {'file': (pdf_file.name, f, 'application/pdf')}
        params = {'run_analysis': 'true' if run_analysis else 'false'}

        try:
            response = requests.post(url, files=files, params=params, timeout=60)

            print(f"\nStatus Code: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                print(f"✅ Upload successful!")
                print(f"Number of drawings created: {len(data)}")

                for i, drawing in enumerate(data, 1):
                    print(f"\n--- Drawing {i} ---")
                    print(f"ID: {drawing.get('id')}")
                    print(f"Filename: {drawing.get('pdf_filename')}")
                    print(f"Page: {drawing.get('page_number', 0) + 1}")
                    print(f"Status: {drawing.get('status')}")
                    print(f"Thumbnail: {drawing.get('thumbnail_path')}")

                return data
            else:
                print(f"❌ Upload failed!")
                print(f"Response: {response.text}")
                return None

        except requests.exceptions.RequestException as e:
            print(f"❌ Request error: {e}")
            return None


def test_get_drawings():
    """
    図面リストを取得
    """
    url = "http://localhost:8000/api/v1/drawings/"

    try:
        response = requests.get(url, timeout=10)

        print(f"\n=== Drawing List ===")
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"Total: {data.get('total', 0)}")

            for drawing in data.get('items', []):
                print(f"\nID: {drawing.get('id')}, "
                      f"File: {drawing.get('pdf_filename')}, "
                      f"Status: {drawing.get('status')}")

            return data
        else:
            print(f"Response: {response.text}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
        return None


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_upload_pdf.py <pdf_file> [--with-analysis]")
        sys.exit(1)

    pdf_file = sys.argv[1]
    run_analysis = "--with-analysis" in sys.argv

    # アップロードテスト
    result = test_upload_pdf(pdf_file, run_analysis)

    if result:
        # 図面リスト取得テスト
        test_get_drawings()
