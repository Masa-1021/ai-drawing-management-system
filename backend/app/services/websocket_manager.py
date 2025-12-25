"""
WebSocket Manager

編集ロックのリアルタイム通知を管理
"""

import logging
from typing import Dict, Set
import socketio

logger = logging.getLogger(__name__)


class WebSocketManager:
    """WebSocket接続管理"""

    def __init__(self):
        """初期化"""
        # Socket.IOサーバー（ASGIモード）
        self.sio = socketio.AsyncServer(
            async_mode="asgi",
            cors_allowed_origins="*",  # 開発環境用: すべてのOriginを許可
            logger=True,
            engineio_logger=True,
            ping_timeout=120,  # pingタイムアウトを120秒に延長（AI解析に時間がかかるため）
            ping_interval=30,  # ping間隔を30秒に設定
        )

        # 図面IDごとの購読ユーザーを管理
        self._subscriptions: Dict[str, Set[str]] = {}

        # イベントハンドラーを登録
        self._setup_handlers()

    def _setup_handlers(self):
        """イベントハンドラーをセットアップ"""

        @self.sio.event
        async def connect(sid, environ):
            """クライアント接続時"""
            logger.info(f"WebSocket connected: {sid}")

        @self.sio.event
        async def disconnect(sid):
            """クライアント切断時"""
            logger.info(f"WebSocket disconnected: {sid}")
            # 購読を解除
            for drawing_id in list(self._subscriptions.keys()):
                if sid in self._subscriptions[drawing_id]:
                    self._subscriptions[drawing_id].remove(sid)
                    if not self._subscriptions[drawing_id]:
                        del self._subscriptions[drawing_id]

        @self.sio.event
        async def subscribe_drawing(sid, data):
            """図面の購読開始"""
            try:
                drawing_id = str(data.get("drawing_id"))
                logger.info(f"Client {sid} subscribing to drawing {drawing_id}")

                if drawing_id not in self._subscriptions:
                    self._subscriptions[drawing_id] = set()

                self._subscriptions[drawing_id].add(sid)

                await self.sio.emit(
                    "subscribed",
                    {"drawing_id": drawing_id},
                    room=sid,
                )
            except Exception as e:
                logger.error(f"Error subscribing: {e}")
                await self.sio.emit(
                    "error",
                    {"message": str(e)},
                    room=sid,
                )

        @self.sio.event
        async def unsubscribe_drawing(sid, data):
            """図面の購読解除"""
            try:
                drawing_id = str(data.get("drawing_id"))
                logger.info(f"Client {sid} unsubscribing from drawing {drawing_id}")

                if drawing_id in self._subscriptions and sid in self._subscriptions[drawing_id]:
                    self._subscriptions[drawing_id].remove(sid)
                    if not self._subscriptions[drawing_id]:
                        del self._subscriptions[drawing_id]

                await self.sio.emit(
                    "unsubscribed",
                    {"drawing_id": drawing_id},
                    room=sid,
                )
            except Exception as e:
                logger.error(f"Error unsubscribing: {e}")

    async def notify_drawing_locked(self, drawing_id: str, locked_by: str):
        """図面がロックされたことを通知"""
        if drawing_id in self._subscriptions:
            logger.info(f"Notifying lock for drawing {drawing_id} by {locked_by}")
            for sid in self._subscriptions[drawing_id]:
                await self.sio.emit(
                    "drawing_locked",
                    {
                        "drawing_id": drawing_id,
                        "locked_by": locked_by,
                    },
                    room=sid,
                )

    async def notify_drawing_unlocked(self, drawing_id: str):
        """図面のロックが解除されたことを通知"""
        if drawing_id in self._subscriptions:
            logger.info(f"Notifying unlock for drawing {drawing_id}")
            for sid in self._subscriptions[drawing_id]:
                await self.sio.emit(
                    "drawing_unlocked",
                    {"drawing_id": drawing_id},
                    room=sid,
                )

    async def notify_upload_progress(self, message: str, level: str = "info"):
        """アップロード進捗を全クライアントに通知"""
        logger.info(f"Upload progress: {message}")
        await self.sio.emit(
            "upload_progress",
            {
                "message": message,
                "level": level,
            },
        )

    def get_asgi_app(self):
        """ASGIアプリケーションを取得"""
        return socketio.ASGIApp(self.sio)


# グローバルインスタンス
websocket_manager = WebSocketManager()
