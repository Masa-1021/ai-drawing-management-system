import requests

# アップロードテスト
url = "http://localhost:8000/api/v1/drawings/upload?run_analysis=false"

# テストPDFファイル
test_pdf = "pdf/11160217.pdf"

with open(test_pdf, "rb") as f:
    files = {"file": ("test-debug-upload.pdf", f, "application/pdf")}
    response = requests.post(url, files=files)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
