"""
設備添付ファイルスキーマ
"""

from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class EquipmentAttachmentBase(BaseModel):
    """設備添付ファイル基本スキーマ"""
    category: str = Field(..., description="カテゴリ（soft, manual, inspection, asset, other）")
    sub_category: Optional[str] = Field(None, description="サブカテゴリ（種別）")
    description: Optional[str] = Field(None, description="説明")
    version: Optional[str] = Field(None, description="バージョン（A, B, C...）")


class EquipmentAttachmentCreate(EquipmentAttachmentBase):
    """設備添付ファイル作成スキーマ"""
    pass


class EquipmentAttachmentResponse(BaseModel):
    """設備添付ファイルレスポンス"""
    id: str
    equipment_id: str
    filename: str
    stored_filename: str
    file_path: str
    file_size: int
    mime_type: Optional[str] = None
    category: str
    sub_category: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    version_group_id: Optional[str] = None
    is_latest: bool = True
    # 後方互換性
    soft_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


class EquipmentAttachmentListResponse(BaseModel):
    """設備添付ファイル一覧レスポンス"""
    total: int
    items: List[EquipmentAttachmentResponse]


class EquipmentAttachmentGroupedResponse(BaseModel):
    """サブカテゴリ別にグループ化された添付ファイルレスポンス"""
    category: str
    groups: Dict[str, List[EquipmentAttachmentResponse]]  # sub_category -> items
    total: int


class EquipmentAttachmentUpdateRequest(BaseModel):
    """設備添付ファイル更新リクエスト"""
    description: Optional[str] = None
    version: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None


class EquipmentAttachmentVersionHistoryResponse(BaseModel):
    """バージョン履歴レスポンス"""
    current: EquipmentAttachmentResponse
    history: List[EquipmentAttachmentResponse]
