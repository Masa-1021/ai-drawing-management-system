"""
テスト用PDFファイルをアップロード
"""
import requests
from pathlib import Path

API_BASE = "http://localhost:8000/api/v1"

def upload_pdf(file_path: str, run_analysis: bool = True):
    """PDFファイルをアップロード"""
    path = Path(file_path)
    if not path.exists():
        print(f"[ERROR] File not found: {file_path}")
        return None

    with open(path, 'rb') as f:
        files = {'file': (path.name, f, 'application/pdf')}
        params = {'run_analysis': run_analysis}

        try:
            response = requests.post(
                f"{API_BASE}/drawings/upload",
                files=files,
                params=params,
                timeout=300  # 5分タイムアウト（AI解析に時間がかかる）
            )

            if response.status_code == 200:
                data = response.json()
                print(f"[OK] Uploaded: {path.name}")
                if isinstance(data, list) and len(data) > 0:
                    drawing = data[0]
                    print(f"     ID: {drawing['id']}")
                    print(f"     Status: {drawing['status']}")
                    if 'classification_confidence' in drawing:
                        print(f"     Confidence: {drawing['classification_confidence']}%")
                return data
            else:
                print(f"[ERROR] Upload failed: {response.status_code}")
                print(f"        Response: {response.text}")
                return None
        except Exception as e:
            print(f"[ERROR] Error uploading {path.name}: {e}")
            return None

if __name__ == "__main__":
    print("Uploading test PDF files...")
    print("=" * 50)

    test_files = [
        "pdf/11160216.pdf",
        "pdf/11160217.pdf",
        "pdf/SM.01.00.00.pdf",
    ]

    for file_path in test_files:
        print(f"\nUploading: {file_path}")
        result = upload_pdf(file_path)
        if result:
            print()

    print("=" * 50)
    print("Upload complete!")
