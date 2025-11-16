"""
回転したPDFをアップロードして自動修正機能をテストするスクリプト
"""
import httpx
from pathlib import Path
import json

def upload_rotated_pdfs():
    """回転したPDFをアップロードしてテスト"""

    api_url = "http://localhost:8000/api/v1/drawings/upload"

    # プロジェクトルートからの相対パス
    rotated_dir = Path(__file__).parent / "pdf" / "rotated"
    test_files = [
        rotated_dir / "11160216_rotated_90.pdf",
        rotated_dir / "11160216_rotated_180.pdf",
        rotated_dir / "11160216_rotated_270.pdf",
    ]

    print("回転PDFアップロードテスト")
    print("=" * 50)
    print()

    for pdf_path in test_files:
        if not pdf_path.exists():
            print(f"[ERROR] ファイルが見つかりません: {pdf_path}")
            continue

        rotation = pdf_path.stem.split("_")[-1]  # e.g., "90", "180", "270"

        print(f"アップロード中: {pdf_path.name} ({rotation}度回転)")

        # ファイルをアップロード
        with open(pdf_path, "rb") as f:
            files = {"file": (pdf_path.name, f, "application/pdf")}
            params = {"run_analysis": "false"}  # AI解析はスキップして高速化

            try:
                with httpx.Client(timeout=30) as client:
                    response = client.post(api_url, files=files, params=params)

                if response.status_code == 200:
                    data = response.json()
                    drawing_id = data[0]["id"] if isinstance(data, list) else data["id"]
                    status = data[0]["status"] if isinstance(data, list) else data["status"]

                    print(f"[OK] アップロード成功")
                    print(f"     ID: {drawing_id}")
                    print(f"     Status: {status}")
                    print(f"     元の回転: {rotation}度")
                    print(f"     → システムが自動的に0度に修正")
                else:
                    print(f"[ERROR] アップロード失敗: {response.status_code}")
                    print(f"     {response.text}")

            except Exception as e:
                print(f"[ERROR] エラー発生: {e}")

        print()

    print("=" * 50)
    print("テスト完了!")
    print()
    print("確認:")
    print("  1. http://localhost:5173/list で図面一覧を開く")
    print("  2. サムネイルが正しい向き（0度）で表示されることを確認")
    print("  3. 各図面をクリックして詳細を確認")
    print("  4. PDFプレビューも正しい向きで表示されることを確認")

if __name__ == "__main__":
    upload_rotated_pdfs()
