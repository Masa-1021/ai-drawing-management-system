"""
フロントエンド・バックエンド統合確認

両方のサーバーが正常に動作しているか確認
"""

import requests
import time

print("=" * 60)
print("Frontend & Backend Integration Check")
print("=" * 60)

# Test 1: Backend Health Check
print("\n[Test 1] Backend Health Check")
try:
    response = requests.get("http://localhost:8000/health", timeout=5)
    if response.status_code == 200:
        print("OK - Backend is running on http://localhost:8000")
        print(f"    Status: {response.json()}")
    else:
        print(f"FAILED - Backend returned {response.status_code}")
except Exception as e:
    print(f"FAILED - Backend not accessible: {e}")

# Test 2: Backend API Endpoints
print("\n[Test 2] Backend API Endpoints")
try:
    response = requests.get("http://localhost:8000/api/v1/config/settings", timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"OK - Config API working")
        print(f"    Extraction fields: {len(data['extraction_fields'])}")
        print(f"    Confidence threshold: {data['confidence_threshold']}%")
    else:
        print(f"FAILED - Config API returned {response.status_code}")
except Exception as e:
    print(f"FAILED - Config API error: {e}")

# Test 3: Backend Swagger UI
print("\n[Test 3] Backend Swagger UI")
try:
    response = requests.get("http://localhost:8000/docs", timeout=5)
    if response.status_code == 200:
        print("OK - Swagger UI accessible at http://localhost:8000/docs")
    else:
        print(f"FAILED - Swagger UI returned {response.status_code}")
except Exception as e:
    print(f"FAILED - Swagger UI error: {e}")

# Test 4: Frontend Server
print("\n[Test 4] Frontend Server")
try:
    response = requests.get("http://localhost:5173", timeout=5)
    if response.status_code == 200:
        print("OK - Frontend is running on http://localhost:5173")
    else:
        print(f"FAILED - Frontend returned {response.status_code}")
except Exception as e:
    print(f"FAILED - Frontend not accessible: {e}")

# Test 5: CORS Configuration
print("\n[Test 5] CORS Configuration")
try:
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    }
    response = requests.options(
        "http://localhost:8000/api/v1/drawings/",
        headers=headers,
        timeout=5
    )
    if response.status_code in [200, 204]:
        cors_headers = response.headers.get("Access-Control-Allow-Origin")
        print(f"OK - CORS configured")
        print(f"    Allow-Origin: {cors_headers}")
    else:
        print(f"WARNING - CORS check returned {response.status_code}")
except Exception as e:
    print(f"FAILED - CORS check error: {e}")

print("\n" + "=" * 60)
print("Integration Check Complete")
print("=" * 60)
print("\nServices:")
print("  Backend API:  http://localhost:8000")
print("  Swagger UI:   http://localhost:8000/docs")
print("  Frontend:     http://localhost:5173")
print("\nYou can now:")
print("  1. Open http://localhost:5173 in your browser")
print("  2. Test file upload functionality")
print("  3. View API documentation at http://localhost:8000/docs")
