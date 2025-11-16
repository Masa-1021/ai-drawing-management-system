"""
図面関連スキーマ
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class DrawingBase(BaseModel):
    """図面基本スキーマ"""

    original_filename: str  # 元のファイル名
    pdf_filename: str  # ストレージ上のファイル名（編集可能）
    page_number: int = 0
    classification: Optional[str] = None
    status: str = "pending"


class DrawingCreate(DrawingBase):
    """図面作成スキーマ"""

    pass


class DrawingUpdate(BaseModel):
    """図面更新スキーマ"""

    pdf_filename: Optional[str] = None  # ファイル名の編集を許可
    classification: Optional[str] = None
    status: Optional[str] = None
    summary: Optional[str] = None


class ExtractedFieldSchema(BaseModel):
    """抽出フィールドスキーマ"""

    field_name: str
    field_value: str
    confidence: int
    x: int = 0
    y: int = 0
    width: int = 0
    height: int = 0

    class Config:
        from_attributes = True


class BalloonSchema(BaseModel):
    """風船スキーマ"""

    balloon_number: str
    part_name: Optional[str] = None
    quantity: Optional[int] = 1
    confidence: int
    x: int
    y: int

    class Config:
        from_attributes = True


class RevisionSchema(BaseModel):
    """改訂履歴スキーマ"""

    revision_number: str
    revision_date: Optional[datetime] = None
    description: Optional[str] = None
    author: Optional[str] = None
    confidence: int

    class Config:
        from_attributes = True


class TagSchema(BaseModel):
    """タグスキーマ"""

    id: int
    tag_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class DrawingResponse(DrawingBase):
    """図面レスポンススキーマ"""

    id: str  # UUID
    pdf_path: str  # 実際のファイルパス
    thumbnail_path: Optional[str] = None
    upload_date: datetime
    analyzed_at: Optional[datetime] = None
    approved_date: Optional[datetime] = None
    created_by: str
    classification_confidence: Optional[int] = None
    summary: Optional[str] = None
    shape_features: Optional[Dict[str, Any]] = None

    # リレーション
    extracted_fields: List[ExtractedFieldSchema] = []
    balloons: List[BalloonSchema] = []
    revisions: List[RevisionSchema] = []
    tags: List[TagSchema] = []

    class Config:
        from_attributes = True


class DrawingListResponse(BaseModel):
    """図面リストレスポンス"""

    total: int
    items: List[DrawingResponse]


class BulkOperationRequest(BaseModel):
    """一括操作リクエスト"""

    drawing_ids: List[str] = Field(..., min_length=1)  # UUID
    value: Optional[str] = None
