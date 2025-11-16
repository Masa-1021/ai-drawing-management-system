"""
FastAPIアプリケーション

CAD図面管理システムのバックエンドAPI
"""

import logging
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.services.ai_analysis_service import AIAnalysisException
from app.services.lock_manager import LockException
from app.services.drawing_service import DrawingServiceException
from app.services.search_service import SearchServiceException
from app.services.websocket_manager import websocket_manager
from app.utils.logging_config import setup_logging

# ロギング設定
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションライフサイクル"""
    logger.info("Application startup")
    yield
    logger.info("Application shutdown")


# FastAPIアプリケーション作成
app = FastAPI(
    title="CAD Drawing Manager API",
    description="AI駆動型CAD図面管理システム",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ミドルウェア: リクエストロギング
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """リクエストロギング"""
    logger.info(f"Request: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response


# エラーハンドラー
@app.exception_handler(AIAnalysisException)
async def ai_analysis_exception_handler(
    request: Request, exc: AIAnalysisException
):
    """AI解析エラーハンドラー"""
    logger.error(f"AI Analysis Error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc)},
    )


@app.exception_handler(LockException)
async def lock_exception_handler(request: Request, exc: LockException):
    """ロックエラーハンドラー"""
    logger.error(f"Lock Error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)}
    )


@app.exception_handler(DrawingServiceException)
async def drawing_service_exception_handler(
    request: Request, exc: DrawingServiceException
):
    """図面サービスエラーハンドラー"""
    logger.error(f"Drawing Service Error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )


@app.exception_handler(SearchServiceException)
async def search_service_exception_handler(
    request: Request, exc: SearchServiceException
):
    """検索サービスエラーハンドラー"""
    logger.error(f"Search Service Error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc)},
    )


# ルートエンドポイント
@app.get("/")
async def root():
    """ルート"""
    return {"message": "CAD Drawing Manager API", "version": "0.1.0"}


@app.get("/health")
async def health():
    """ヘルスチェック"""
    return {"status": "ok"}


# APIルーター
from app.api.v1 import drawings, search, locks, config

app.include_router(
    drawings.router, prefix="/api/v1/drawings", tags=["drawings"]
)
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(locks.router, prefix="/api/v1/locks", tags=["locks"])
app.include_router(config.router, prefix="/api/v1/config", tags=["config"])

# WebSocketをマウント
app.mount("/ws", websocket_manager.get_asgi_app())

# 静的ファイルをマウント（storage/drawings, storage/thumbnails）
storage_path = Path(__file__).parent.parent.parent / "storage"
if storage_path.exists():
    app.mount("/storage", StaticFiles(directory=str(storage_path)), name="storage")
    logger.info(f"Static files mounted: {storage_path}")
else:
    logger.warning(f"Storage directory not found: {storage_path}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"
    )
