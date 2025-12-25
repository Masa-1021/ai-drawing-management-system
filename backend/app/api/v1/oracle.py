"""
Oracle DB連携APIルーター
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import oracledb

from ...database import get_db
from ...schemas.oracle import (
    OracleLineData,
    OracleEquipmentData,
    OracleImportRequest,
    OracleImportResponse,
    OracleConnectionTestResponse,
)
from ...models.line import Line
from ...models.equipment import Equipment
from ...services.oracle_service import OracleService
from ...utils.oracle_config import OracleConfig

router = APIRouter()

# グローバルなOracleServiceインスタンス（アプリケーション起動時に初期化）
_oracle_service: OracleService | None = None


def get_oracle_service() -> OracleService:
    """OracleServiceのDI依存性注入"""
    global _oracle_service
    if _oracle_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Oracle DBサービスが初期化されていません",
        )
    return _oracle_service


def initialize_oracle_service() -> None:
    """OracleServiceを初期化（アプリケーション起動時に呼び出し）"""
    global _oracle_service
    try:
        print("OracleService初期化を開始します...")
        config = OracleConfig()
        print(f"Oracle設定読み込み完了: {config.dsn}")
        _oracle_service = OracleService(config)
        print("OracleServiceを初期化しました")
    except Exception as e:
        print(f"OracleService初期化エラー: {e}")
        import traceback

        traceback.print_exc()
        # 初期化エラーでもアプリケーションは起動させる（Oracle機能のみ無効化）
        _oracle_service = None


def close_oracle_service() -> None:
    """OracleServiceをクローズ（アプリケーション終了時に呼び出し）"""
    global _oracle_service
    if _oracle_service:
        _oracle_service.close()
        _oracle_service = None


@router.get("/test", response_model=OracleConnectionTestResponse)
def test_oracle_connection(
    oracle_service: OracleService = Depends(get_oracle_service),
):
    """
    Oracle DB接続テスト

    Returns:
        OracleConnectionTestResponse: 接続テスト結果
    """
    success, message, version = oracle_service.test_connection()

    if not success:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=message,
        )

    return OracleConnectionTestResponse(
        success=success,
        message=message,
        oracle_version=version,
    )


@router.get("/lines", response_model=list[OracleLineData])
def get_oracle_lines(
    oracle_service: OracleService = Depends(get_oracle_service),
):
    """
    OracleDBからライン一覧を取得

    Returns:
        List[OracleLineData]: ライン情報リスト
    """
    try:
        lines = oracle_service.get_lines()
        return lines
    except oracledb.Error as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Oracle DB接続エラー: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ライン取得エラー: {str(e)}",
        )


@router.get("/equipments", response_model=list[OracleEquipmentData])
def get_oracle_equipments(
    line_code: str,
    oracle_service: OracleService = Depends(get_oracle_service),
):
    """
    指定ラインの設備一覧を取得

    Args:
        line_code: ラインコード (STA_NO2)

    Returns:
        List[OracleEquipmentData]: 設備情報リスト
    """
    if not line_code:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="line_codeパラメータが必要です",
        )

    try:
        equipments = oracle_service.get_equipments(line_code)
        return equipments
    except oracledb.Error as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Oracle DB接続エラー: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"設備取得エラー: {str(e)}",
        )


@router.post("/import", response_model=OracleImportResponse)
def import_from_oracle(
    request: OracleImportRequest,
    db: Session = Depends(get_db),
):
    """
    OracleDBからライン・設備データをインポート

    Args:
        request: インポートリクエスト
        db: DBセッション

    Returns:
        OracleImportResponse: インポート結果
    """
    # 1. 重複チェック（line_code で確認）
    existing_line = db.query(Line).filter(Line.code == request.line_code).first()
    if existing_line:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"ラインコード '{request.line_code}' は既に登録されています",
        )

    try:
        # 2. トランザクション開始
        line_id = str(uuid.uuid4())
        now = datetime.utcnow()  # datetimeオブジェクトとして保持
        now_iso = now.isoformat()  # ISO文字列はレスポンス用

        # 3. ライン登録
        new_line = Line(
            id=line_id,
            name=request.line_name,
            code=request.line_code,
            synced_from_oracle=True,
            last_synced_at=now_iso,  # last_synced_atはString型
        )
        db.add(new_line)

        # 4. 設備登録
        equipment_count = 0
        for eq in request.equipments:
            # 設備コード重複チェック
            existing_equipment = (
                db.query(Equipment).filter(Equipment.code == eq.equipment_code).first()
            )
            if existing_equipment:
                # 既に登録済みの設備はスキップ
                continue

            new_equipment = Equipment(
                id=str(uuid.uuid4()),
                line_id=line_id,
                code=eq.equipment_code,
                name=eq.equipment_name,
                synced_from_oracle=True,
            )
            db.add(new_equipment)
            equipment_count += 1

        # 5. コミット
        db.commit()

        return OracleImportResponse(
            line_id=line_id,
            line_name=request.line_name,
            equipment_count=equipment_count,
            created_at=now_iso,
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"登録処理に失敗しました: {str(e)}",
        )
