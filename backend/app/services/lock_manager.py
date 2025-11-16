"""
ロック管理サービス

図面編集時の排他制御を提供
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.models.lock import Lock

logger = logging.getLogger(__name__)


class LockException(Exception):
    """ロックエラー"""

    pass


class LockManager:
    """ロック管理クラス"""

    def __init__(self, db: Session, lock_timeout: int = 300, websocket_manager=None):
        """
        初期化

        Args:
            db: データベースセッション
            lock_timeout: ロックタイムアウト（秒）
            websocket_manager: WebSocketマネージャー（オプション）
        """
        self.db = db
        self.lock_timeout = lock_timeout
        self.websocket_manager = websocket_manager

    async def acquire_lock(self, drawing_id: str, user_id: str) -> Lock:
        """
        ロックを取得

        Args:
            drawing_id: 図面ID
            user_id: ユーザーID

        Returns:
            Lockオブジェクト

        Raises:
            LockException: ロック取得失敗
        """
        # 既存ロックを確認
        existing_lock = self.check_lock(drawing_id)

        if existing_lock:
            if existing_lock.user_id == user_id:
                # 同じユーザーの場合は更新（タイムスタンプと有効期限を延長）
                now = datetime.utcnow()
                existing_lock.acquired_at = now
                existing_lock.expires_at = now + timedelta(seconds=self.lock_timeout)
                self.db.commit()
                logger.info(f"Lock renewed: drawing={drawing_id}, user={user_id}")
                return existing_lock
            else:
                raise LockException(
                    f"図面はすでに {existing_lock.user_id} によってロックされています"
                )

        # 新規ロック作成
        expires_at = datetime.utcnow() + timedelta(seconds=self.lock_timeout)
        lock = Lock(drawing_id=drawing_id, user_id=user_id, expires_at=expires_at)
        self.db.add(lock)
        self.db.commit()

        logger.info(f"Lock acquired: drawing={drawing_id}, user={user_id}")

        # WebSocket通知
        if self.websocket_manager:
            await self.websocket_manager.notify_drawing_locked(drawing_id, user_id)

        return lock

    async def release_lock(self, drawing_id: str, user_id: str) -> bool:
        """
        ロックを解放

        Args:
            drawing_id: 図面ID
            user_id: ユーザーID

        Returns:
            解放成功ならTrue

        Raises:
            LockException: ロック解放失敗
        """
        lock = self.check_lock(drawing_id)

        if not lock:
            return True

        if lock.user_id != user_id:
            raise LockException(
                f"ロックを解放できません。別のユーザー ({lock.user_id}) がロックしています"
            )

        self.db.delete(lock)
        self.db.commit()

        logger.info(f"Lock released: drawing={drawing_id}, user={user_id}")

        # WebSocket通知
        if self.websocket_manager:
            await self.websocket_manager.notify_drawing_unlocked(drawing_id)

        return True

    def check_lock(self, drawing_id: str) -> Optional[Lock]:
        """
        ロック状態を確認

        Args:
            drawing_id: 図面ID

        Returns:
            Lockオブジェクト（ロックされていない場合はNone）
        """
        # 期限切れロックを削除
        self.cleanup_expired_locks()

        lock = (
            self.db.query(Lock)
            .filter(Lock.drawing_id == drawing_id)
            .first()
        )

        return lock

    def cleanup_expired_locks(self) -> int:
        """
        期限切れロックを削除

        Returns:
            削除件数
        """
        now = datetime.utcnow()

        deleted_count = (
            self.db.query(Lock)
            .filter(Lock.expires_at < now)
            .delete()
        )

        if deleted_count > 0:
            self.db.commit()
            logger.info(f"Cleaned up {deleted_count} expired locks")

        return deleted_count
