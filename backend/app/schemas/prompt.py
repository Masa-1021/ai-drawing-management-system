"""
プロンプト関連スキーマ
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PromptListItem(BaseModel):
    """プロンプト一覧アイテム"""

    name: str = Field(..., description="プロンプト名（拡張子なし）")
    label: str = Field(..., description="日本語表示名")
    preview: str = Field(..., description="内容プレビュー（先頭100文字）")
    updated_at: Optional[datetime] = Field(None, description="最終更新日時")


class PromptResponse(BaseModel):
    """プロンプト詳細レスポンススキーマ"""

    name: str = Field(..., description="プロンプト名（拡張子なし）")
    label: str = Field(..., description="日本語表示名")
    content: str = Field(..., description="プロンプトの内容")
    file_path: str = Field(..., description="ファイルパス")
    updated_at: Optional[datetime] = Field(None, description="最終更新日時")

    class Config:
        from_attributes = True


class PromptUpdate(BaseModel):
    """プロンプト更新スキーマ"""

    content: str = Field(..., description="更新するプロンプト内容", min_length=1)
