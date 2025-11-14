"""
ロック管理API
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.services.lock_manager import LockManager, LockException
from app.services.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter()


class AcquireLockRequest(BaseModel):
    """ロック取得リクエスト"""

    drawing_id: int
    user_id: str


class ReleaseLockRequest(BaseModel):
    """ロック解放リクエスト"""

    drawing_id: int
    user_id: str


class LockResponse(BaseModel):
    """ロックレスポンス"""

    drawing_id: int
    user_id: str
    acquired_at: str


@router.post("/acquire", response_model=LockResponse)
async def acquire_lock(request: AcquireLockRequest, db: Session = Depends(get_db)):
    """
    ロックを取得

    - **drawing_id**: 図面ID
    - **user_id**: ユーザーID
    """
    try:
        manager = LockManager(db, websocket_manager=websocket_manager)
        lock = await manager.acquire_lock(request.drawing_id, request.user_id)

        return {
            "drawing_id": lock.drawing_id,
            "user_id": lock.user_id,
            "acquired_at": lock.acquired_at.isoformat(),
        }

    except LockException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/release")
async def release_lock(request: ReleaseLockRequest, db: Session = Depends(get_db)):
    """
    ロックを解放

    - **drawing_id**: 図面ID
    - **user_id**: ユーザーID
    """
    try:
        manager = LockManager(db, websocket_manager=websocket_manager)
        await manager.release_lock(request.drawing_id, request.user_id)

        return {"status": "released"}

    except LockException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/{drawing_id}", response_model=LockResponse | None)
def check_lock(drawing_id: int, db: Session = Depends(get_db)):
    """
    ロック状態を確認

    - **drawing_id**: 図面ID
    """
    manager = LockManager(db)
    lock = manager.check_lock(drawing_id)

    if lock:
        return {
            "drawing_id": lock.drawing_id,
            "user_id": lock.user_id,
            "acquired_at": lock.acquired_at.isoformat(),
        }

    return None
