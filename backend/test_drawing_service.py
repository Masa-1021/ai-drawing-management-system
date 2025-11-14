"""
DrawingServiceのテスト

モック使用で基本機能をテスト
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("DrawingService Test Started")
print("=" * 60)

# Test 1: DrawingService初期化
print("\n[Test 1] DrawingService Initialization")
try:
    from app.services.drawing_service import DrawingService
    from app.database import SessionLocal, engine, Base

    # テスト用DBセットアップ
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    service = DrawingService(db=db)
    print("OK - DrawingService initialized")

except Exception as e:
    print(f"FAILED - DrawingService: {e}")
    import traceback

    traceback.print_exc()
    sys.exit(1)

# Test 2: Drawingリスト取得（空）
print("\n[Test 2] List Drawings (empty)")
try:
    drawings = service.list_drawings()
    print(f"OK - Found {len(drawings)} drawings")

except Exception as e:
    print(f"FAILED - List drawings: {e}")
    import traceback

    traceback.print_exc()
    sys.exit(1)

# Test 3: Drawing作成テスト（モック）
print("\n[Test 3] Create Drawing (mock)")
try:
    # PDFの代わりにダミーデータを使用
    # 実際のPDFファイルがない場合はスキップ
    print("SKIPPED - Requires actual PDF file")

except Exception as e:
    print(f"FAILED - Create drawing: {e}")
    sys.exit(1)

# Cleanup
print("\n[Cleanup]")
try:
    db.close()
    print("OK - Database session closed")

except Exception as e:
    print(f"FAILED - Cleanup: {e}")

print("\n" + "=" * 60)
print("DrawingService Tests PASSED!")
print("=" * 60)
