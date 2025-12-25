"""
ライン関連スキーマ
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LineBase(BaseModel):
    """ライン基本スキーマ"""

    name: str
    code: Optional[str] = None
    description: Optional[str] = None


class LineCreate(LineBase):
    """ライン作成スキーマ"""

    pass


class LineUpdate(BaseModel):
    """ライン更新スキーマ"""

    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None


class LineResponse(LineBase):
    """ラインレスポンススキーマ"""

    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
