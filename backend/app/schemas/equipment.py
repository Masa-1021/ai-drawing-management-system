"""
設備関連スキーマ
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class EquipmentBase(BaseModel):
    """設備基本スキーマ"""

    line_id: str
    code: str
    name: str
    description: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    installed_date: Optional[str] = None


class EquipmentCreate(EquipmentBase):
    """設備作成スキーマ"""

    pass


class EquipmentUpdate(BaseModel):
    """設備更新スキーマ"""

    line_id: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    installed_date: Optional[str] = None


class EquipmentResponse(EquipmentBase):
    """設備レスポンススキーマ"""

    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
