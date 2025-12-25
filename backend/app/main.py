"""
FastAPIアプリケーション

CAD図面管理システムのバックエンドAPI
"""

import logging
from pathlib import Path
from fastapi import FastAPI, Request, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import socketio

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
    import asyncio
    logger.info("Application startup")

    # メインイベントループを登録（WebSocket進捗通知用）
    try:
        from app.services.drawing_service import set_main_event_loop
        main_loop = asyncio.get_running_loop()
        set_main_event_loop(main_loop)
    except Exception as e:
        logger.warning(f"Failed to register main event loop: {e}")

    # OracleServiceを初期化
    try:
        from app.api.v1 import oracle

        oracle.initialize_oracle_service()
    except Exception as e:
        logger.warning(f"Oracle service initialization failed: {e}")

    yield

    # OracleServiceをクローズ
    try:
        from app.api.v1 import oracle

        oracle.close_oracle_service()
    except Exception as e:
        logger.warning(f"Oracle service cleanup failed: {e}")

    logger.info("Application shutdown")


# FastAPIアプリケーション作成
app = FastAPI(
    title="CAD Drawing Manager API",
    description="AI駆動型CAD図面管理システム",
    version="0.1.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発環境用: すべてのOriginを許可
    allow_credentials=False,  # allow_origins=["*"]の場合はFalseにする必要がある
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
async def ai_analysis_exception_handler(request: Request, exc: AIAnalysisException):
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
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)})


@app.exception_handler(DrawingServiceException)
async def drawing_service_exception_handler(request: Request, exc: DrawingServiceException):
    """図面サービスエラーハンドラー"""
    logger.error(f"Drawing Service Error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )


@app.exception_handler(SearchServiceException)
async def search_service_exception_handler(request: Request, exc: SearchServiceException):
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


@app.get("/api/v1/test-websocket")
async def test_websocket():
    """WebSocket通信テスト"""
    await websocket_manager.notify_upload_progress("テストメッセージ: WebSocket通信テスト", "info")
    await websocket_manager.notify_upload_progress("テストメッセージ: 成功！", "success")
    return {"status": "ok", "message": "WebSocket test messages sent"}


@app.get("/api/v1/ai-status")
async def check_ai_status():
    """
    AI接続状態をチェック

    Returns:
        - status: "ok" | "error"
        - message: ステータスメッセージ
        - error_type: エラーの種類（"aws_auth" | "connection" | null）
        - command: 実行すべきコマンド（エラー時のみ）
        - sso_url: AWS SSO ログインURL（設定されている場合）
    """
    import os
    import traceback

    try:
        from app.services.claude_client import ClaudeClient, AWSAuthenticationError, ClaudeClientError
    except ImportError as e:
        logger.error(f"Failed to import claude_client: {e}")
        return {
            "status": "error",
            "message": "AI機能のモジュール読み込みに失敗しました",
            "error_type": "unknown",
            "command": None,
            "sso_url": None,
            "detail": f"Import error: {str(e)}",
        }

    # AWS SSO Start URLを環境変数から取得
    sso_url = os.getenv("AWS_SSO_START_URL")

    try:
        # 設定を取得
        region = os.getenv("AWS_REGION", "us-west-2")
        model_id = os.getenv("MODEL_ID", "us.anthropic.claude-sonnet-4-5-20250929-v1:0")
        profile = os.getenv("AWS_PROFILE")

        # ClaudeClientの初期化（接続テストを含む）
        client = ClaudeClient(
            region=region,
            model_id=model_id,
            aws_profile=profile,
        )

        return {
            "status": "ok",
            "message": "AI接続は正常です",
            "error_type": None,
            "command": None,
            "sso_url": sso_url,
        }

    except AWSAuthenticationError as e:
        profile_name = os.getenv("AWS_PROFILE", "default")
        return {
            "status": "error",
            "message": "AWS認証の有効期限が切れています",
            "error_type": "aws_auth",
            "command": f"aws sso login --profile {profile_name}",
            "sso_url": sso_url,
            "detail": str(e),
        }

    except ClaudeClientError as e:
        return {
            "status": "error",
            "message": "AI接続に失敗しました",
            "error_type": "connection",
            "command": None,
            "sso_url": sso_url,
            "detail": str(e),
        }

    except Exception as e:
        logger.error(f"Unexpected error in check_ai_status: {e}\n{traceback.format_exc()}")
        return {
            "status": "error",
            "message": f"予期せぬエラー: {str(e)}",
            "error_type": "unknown",
            "command": None,
            "sso_url": sso_url,
            "detail": str(e),
        }


@app.post("/api/v1/aws-sso/start-auth")
async def start_aws_sso_auth():
    """
    AWS SSOデバイス認証を開始

    Returns:
        - verification_uri: 認証URL
        - user_code: 8文字の認証コード
        - device_code: デバイスコード（トークン取得用）
        - expires_in: 有効期限（秒）
    """
    import os
    import boto3

    try:
        sso_start_url = os.getenv("AWS_SSO_START_URL", "https://d-95675e32fe.awsapps.com/start/#")
        sso_region = os.getenv("AWS_SSO_REGION", "ap-northeast-1")

        client = boto3.client("sso-oidc", region_name=sso_region)

        # クライアント登録
        register_response = client.register_client(
            clientName="cad-drawing-manager",
            clientType="public",
        )

        client_id = register_response["clientId"]
        client_secret = register_response["clientSecret"]

        # デバイス認証開始
        auth_response = client.start_device_authorization(
            clientId=client_id,
            clientSecret=client_secret,
            startUrl=sso_start_url,
        )

        return {
            "status": "ok",
            "verification_uri": auth_response["verificationUriComplete"],
            "user_code": auth_response["userCode"],
            "device_code": auth_response["deviceCode"],
            "client_id": client_id,
            "client_secret": client_secret,
            "expires_in": auth_response["expiresIn"],
        }

    except Exception as e:
        logger.error(f"Failed to start SSO auth: {e}")
        return {
            "status": "error",
            "message": str(e),
        }


@app.post("/api/v1/aws-sso/complete-auth")
async def complete_aws_sso_auth(
    device_code: str = Form(...),
    client_id: str = Form(...),
    client_secret: str = Form(...),
):
    """
    AWS SSOデバイス認証を完了してトークンを取得・保存

    Args:
        device_code: start-authで取得したデバイスコード
        client_id: start-authで取得したクライアントID
        client_secret: start-authで取得したクライアントシークレット

    Returns:
        - status: "ok" | "error" | "pending"
        - message: ステータスメッセージ
    """
    import os
    import json
    import hashlib
    import boto3
    from pathlib import Path
    from datetime import datetime, timezone

    try:
        sso_region = os.getenv("AWS_SSO_REGION", "ap-northeast-1")
        sso_start_url = os.getenv("AWS_SSO_START_URL", "https://d-95675e32fe.awsapps.com/start/#")

        client = boto3.client("sso-oidc", region_name=sso_region)

        # トークン取得を試行
        try:
            token_response = client.create_token(
                clientId=client_id,
                clientSecret=client_secret,
                grantType="urn:ietf:params:oauth:grant-type:device_code",
                deviceCode=device_code,
            )
        except client.exceptions.AuthorizationPendingException:
            return {
                "status": "pending",
                "message": "認証待ち中です。ブラウザで認証を完了してください。",
            }
        except client.exceptions.SlowDownException:
            return {
                "status": "pending",
                "message": "リクエストが多すぎます。少し待ってから再試行してください。",
            }
        except client.exceptions.ExpiredTokenException:
            return {
                "status": "error",
                "message": "認証の有効期限が切れました。再度「aws sso login」をクリックしてください。",
            }

        # トークンをSSO cacheに保存
        access_token = token_response["accessToken"]
        expires_in = token_response.get("expiresIn", 28800)

        # キャッシュファイル名を生成（botocore SSOTokenLoaderと同じ方式）
        # boto3は sha1(start_url) を直接使用する（JSONではなく）
        cache_file_name = hashlib.sha1(sso_start_url.encode("utf-8")).hexdigest() + ".json"

        # キャッシュディレクトリ
        home_dir = Path.home()
        sso_cache_dir = home_dir / ".aws" / "sso" / "cache"
        sso_cache_dir.mkdir(parents=True, exist_ok=True)

        # トークンデータ
        expires_at = datetime.now(timezone.utc).timestamp() + expires_in
        expires_at_str = datetime.fromtimestamp(expires_at, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # registrationExpiresAtを計算（クライアント登録は90日間有効）
        registration_expires_at = datetime.now(timezone.utc).timestamp() + (90 * 24 * 60 * 60)
        registration_expires_at_str = datetime.fromtimestamp(registration_expires_at, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        cache_data = {
            "startUrl": sso_start_url,
            "region": sso_region,
            "accessToken": access_token,
            "expiresAt": expires_at_str,
            "clientId": client_id,
            "clientSecret": client_secret,
            "registrationExpiresAt": registration_expires_at_str,
        }

        # キャッシュファイルに保存
        cache_file_path = sso_cache_dir / cache_file_name
        with open(cache_file_path, "w") as f:
            json.dump(cache_data, f, indent=2)

        logger.info(f"SSO token saved to {cache_file_path}")

        return {
            "status": "ok",
            "message": "認証が完了しました。",
            "expires_at": expires_at_str,
        }

    except Exception as e:
        logger.error(f"Failed to complete SSO auth: {e}")
        return {
            "status": "error",
            "message": str(e),
        }


# APIルーター
from app.api.v1 import drawings, search, locks, config, lines, equipments, oracle, spec_numbers, spec_sheets, prompts

app.include_router(drawings.router, prefix="/api/v1/drawings", tags=["drawings"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(locks.router, prefix="/api/v1/locks", tags=["locks"])
app.include_router(config.router, prefix="/api/v1/config", tags=["config"])
app.include_router(lines.router, prefix="/api/v1/lines", tags=["lines"])
app.include_router(equipments.router, prefix="/api/v1/equipments", tags=["equipments"])
app.include_router(oracle.router, prefix="/api/v1/oracle", tags=["oracle"])
app.include_router(spec_numbers.router, prefix="/api/v1", tags=["spec-numbers"])
app.include_router(spec_sheets.router, prefix="/api/v1", tags=["spec-sheets"])
app.include_router(prompts.router, prefix="/api/v1/prompts", tags=["prompts"])

# 静的ファイルをマウント（storage/drawings, storage/thumbnails）
# Docker環境: /app/app/main.py -> /app/storage
# ローカル環境: backend/app/main.py -> backend/../storage
storage_path = Path(__file__).parent.parent / "storage"
if storage_path.exists():
    app.mount("/storage", StaticFiles(directory=str(storage_path)), name="storage")
    logger.info(f"Static files mounted: {storage_path}")
else:
    logger.warning(f"Storage directory not found: {storage_path}")

# Socket.IOをFastAPIにラップ
# Socket.IOは /socket.io/ パスで利用可能になります
combined_asgi_app = socketio.ASGIApp(websocket_manager.sio, other_asgi_app=app)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:combined_asgi_app", host="0.0.0.0", port=8000, reload=True, log_level="info")
