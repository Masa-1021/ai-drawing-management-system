"""
統合テスト

バックエンドAPIの統合テスト
"""

import sys
import time
import requests
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

API_BASE_URL = "http://localhost:8000"

print("=" * 60)
print("統合テスト開始")
print("=" * 60)

# サーバー起動待機
print("\n[準備] サーバー起動を待機中...")
for i in range(10):
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=2)
        if response.status_code == 200:
            print("OK - サーバー起動確認")
            break
    except:
        time.sleep(1)
else:
    print("FAILED - サーバーが起動していません")
    sys.exit(1)

# Test 1: ヘルスチェック
print("\n[Test 1] ヘルスチェック")
try:
    response = requests.get(f"{API_BASE_URL}/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    print("OK - ヘルスチェック成功")
except Exception as e:
    print(f"FAILED - {e}")
    sys.exit(1)

# Test 2: 設定API
print("\n[Test 2] 設定API")
try:
    response = requests.get(f"{API_BASE_URL}/api/v1/config/settings")
    assert response.status_code == 200
    data = response.json()
    assert "extraction_fields" in data
    assert "confidence_threshold" in data
    assert data["confidence_threshold"] == 70
    print(f"OK - 設定取得成功 ({len(data['extraction_fields'])}フィールド)")
except Exception as e:
    print(f"FAILED - {e}")
    sys.exit(1)

# Test 3: 図面リスト取得（空）
print("\n[Test 3] 図面リスト取得")
try:
    response = requests.get(f"{API_BASE_URL}/api/v1/drawings/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    print(f"OK - 図面リスト取得成功 ({data['total']}件)")
except Exception as e:
    print(f"FAILED - {e}")
    sys.exit(1)

# Test 4: ロック確認API
print("\n[Test 4] ロック確認API")
try:
    response = requests.get(f"{API_BASE_URL}/api/v1/locks/999")
    assert response.status_code == 200
    # ロックが存在しない場合はnullが返る
    print("OK - ロック確認API成功")
except Exception as e:
    print(f"FAILED - {e}")
    sys.exit(1)

# Test 5: OpenAPI (Swagger) ドキュメント
print("\n[Test 5] OpenAPI ドキュメント")
try:
    response = requests.get(f"{API_BASE_URL}/docs")
    assert response.status_code == 200
    print("OK - Swagger UI利用可能")
except Exception as e:
    print(f"FAILED - {e}")
    sys.exit(1)

# Test 6: CORS確認
print("\n[Test 6] CORS設定")
try:
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
    }
    response = requests.options(f"{API_BASE_URL}/api/v1/drawings/upload", headers=headers)
    assert response.status_code in [200, 204]
    print("OK - CORS設定確認")
except Exception as e:
    print(f"FAILED - {e}")
    sys.exit(1)

# Test 7: エラーハンドリング（存在しない図面）
print("\n[Test 7] エラーハンドリング")
try:
    response = requests.get(f"{API_BASE_URL}/api/v1/drawings/99999")
    assert response.status_code == 404
    assert "detail" in response.json()
    print("OK - 404エラーハンドリング成功")
except Exception as e:
    print(f"FAILED - {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("すべての統合テスト成功！")
print("=" * 60)
print("\n✓ API稼働中: http://localhost:8000")
print("✓ Swagger UI: http://localhost:8000/docs")
print("✓ フロントエンド: http://localhost:5173")
