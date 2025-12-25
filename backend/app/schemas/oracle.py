"""
Oracle DB関連のPydanticスキーマ
"""

from pydantic import BaseModel, Field


class OracleLineData(BaseModel):
    """OracleDBから取得したライン情報"""

    line_code: str = Field(..., description="ラインコード (STA_NO2)")
    line_name: str = Field(..., description="ライン名 (LINE_NAME)")

    class Config:
        json_schema_extra = {
            "example": {
                "line_code": "L001",
                "line_name": "第1ライン",
            }
        }


class OracleEquipmentData(BaseModel):
    """OracleDBから取得した設備情報"""

    equipment_code: str = Field(..., description="設備コード (STA_NO3)")
    equipment_name: str = Field(..., description="設備名 (ST_NAME)")

    class Config:
        json_schema_extra = {
            "example": {
                "equipment_code": "E001",
                "equipment_name": "検査装置A",
            }
        }


class OracleImportRequest(BaseModel):
    """Oracle DBからのインポートリクエスト"""

    line_code: str = Field(..., description="インポートするラインコード")
    line_name: str = Field(..., description="ライン名")
    equipments: list[OracleEquipmentData] = Field(default_factory=list, description="ラインに紐づく設備リスト")

    class Config:
        json_schema_extra = {
            "example": {
                "line_code": "L001",
                "line_name": "第1ライン",
                "equipments": [
                    {"equipment_code": "E001", "equipment_name": "検査装置A"},
                    {"equipment_code": "E002", "equipment_name": "組立装置B"},
                ],
            }
        }


class OracleImportResponse(BaseModel):
    """Oracle DBからのインポートレスポンス"""

    line_id: str = Field(..., description="作成されたラインのID")
    line_name: str = Field(..., description="ライン名")
    equipment_count: int = Field(..., description="登録された設備数")
    created_at: str = Field(..., description="登録日時 (ISO 8601)")

    class Config:
        json_schema_extra = {
            "example": {
                "line_id": "550e8400-e29b-41d4-a716-446655440000",
                "line_name": "第1ライン",
                "equipment_count": 2,
                "created_at": "2025-12-02T10:30:00",
            }
        }


class OracleConnectionTestResponse(BaseModel):
    """Oracle DB接続テストレスポンス"""

    success: bool = Field(..., description="接続成功フラグ")
    message: str = Field(..., description="メッセージ")
    oracle_version: str | None = Field(None, description="Oracleバージョン情報")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Oracle DBへの接続に成功しました",
                "oracle_version": "Oracle Database 11g Release 11.2.0.4.0",
            }
        }
