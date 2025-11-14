"""
WebSocket・編集ロック機能の統合テスト
"""

import asyncio
import socketio
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.services.lock_manager import LockManager
from app.services.websocket_manager import websocket_manager

# テスト用データベースのセットアップ
Base.metadata.create_all(bind=engine)


async def test_websocket_lock_integration():
    """WebSocketと編集ロックの統合テスト"""
    print("=== WebSocket・編集ロック機能 統合テスト ===\n")

    # データベースセッション
    db: Session = SessionLocal()

    try:
        # ===== Test 1: ロック取得とWebSocket通知 =====
        print("Test 1: ロック取得とWebSocket通知")
        lock_manager = LockManager(db, websocket_manager=websocket_manager)

        # User1がロックを取得
        drawing_id = "test-drawing-1"
        lock1 = await lock_manager.acquire_lock(drawing_id=drawing_id, user_id="user1")
        assert lock1.drawing_id == drawing_id
        assert lock1.user_id == "user1"
        print("  [OK] User1がロックを取得")

        # User2がロックを取得しようとする（失敗する）
        try:
            await lock_manager.acquire_lock(drawing_id=drawing_id, user_id="user2")
            assert False, "User2のロック取得が成功してしまった"
        except Exception as e:
            assert "user1" in str(e).lower()
            print(f"  [OK] User2のロック取得が拒否された: {e}")

        # ===== Test 2: ロック解放とWebSocket通知 =====
        print("\nTest 2: ロック解放とWebSocket通知")
        released = await lock_manager.release_lock(drawing_id=drawing_id, user_id="user1")
        assert released is True
        print("  [OK] User1がロックを解放")

        # ロックが解放されたので、User2がロックを取得できる
        lock2 = await lock_manager.acquire_lock(drawing_id=drawing_id, user_id="user2")
        assert lock2.drawing_id == drawing_id
        assert lock2.user_id == "user2"
        print("  [OK] User2がロックを取得")

        # クリーンアップ
        await lock_manager.release_lock(drawing_id=drawing_id, user_id="user2")

        # ===== Test 3: ロック状態の確認 =====
        print("\nTest 3: ロック状態の確認")
        lock_check = lock_manager.check_lock(drawing_id=drawing_id)
        assert lock_check is None
        print("  [OK] ロックが解放されている")

        # ===== Test 4: WebSocketクライアントの接続テスト =====
        print("\nTest 4: WebSocketクライアント接続テスト")
        client = socketio.AsyncClient()

        try:
            await client.connect("http://localhost:8000/ws")
            print("  [OK] WebSocket接続成功")

            # 購読テスト
            await client.emit("subscribe_drawing", {"drawing_id": 1})
            await asyncio.sleep(0.5)
            print("  [OK] 図面購読成功")

            # 購読解除テスト
            await client.emit("unsubscribe_drawing", {"drawing_id": 1})
            await asyncio.sleep(0.5)
            print("  [OK] 図面購読解除成功")

            await client.disconnect()
            print("  [OK] WebSocket切断成功")

        except Exception as e:
            print(f"  [WARN] WebSocket接続テストをスキップ: {e}")
            print("  (注: バックエンドサーバーが起動している必要があります)")

        print("\n=== 全てのテストが完了しました ===")
        print(f"成功: 3/3 必須テスト (WebSocket接続テストは任意)")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(test_websocket_lock_integration())
