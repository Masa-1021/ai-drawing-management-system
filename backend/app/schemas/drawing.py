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

    balloon_number: Optional[str] = None  # 後方互換性のため保持
    part_name: Optional[str] = None  # 後方互換性のため保持
    quantity: Optional[int] = None  # 後方互換性のため保持
    upper_text: Optional[str] = None  # 風船上部のテキスト
    lower_text: Optional[str] = None  # 風船下部のテキスト
    adjacent_text: Optional[str] = None  # 風船周辺のテキスト（型式、品名など）
    adjacent_position: Optional[str] = None  # 付随テキストの位置
    confidence: int
    x: float  # 座標は小数点を含む
    y: float  # 座標は小数点を含む

    class Config:
        from_attributes = True


class RevisionSchema(BaseModel):
    """改訂履歴スキーマ"""

    revision_number: str
    revision_date: Optional[str] = None  # 文字列として扱う
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


class SpecSheetItemInfo(BaseModel):
    """摘要表部品情報（図面一覧表示用）"""
    id: str
    row_number: int
    part_name: Optional[str] = None
    drawing_number: Optional[str] = None
    part_type: Optional[str] = None
    spec_sheet_id: Optional[str] = None
    spec_number: Optional[str] = None
    equipment_name: Optional[str] = None
    line_name: Optional[str] = None


class DrawingResponse(DrawingBase):
    """図面レスポンススキーマ"""

    id: str  # UUID
    pdf_path: str  # 実際のファイルパス
    thumbnail_path: Optional[str] = None
    rotation: Optional[int] = 0  # AIで検出された回転角度 (0, 90, 180, 270)
    upload_date: datetime
    analyzed_at: Optional[datetime] = None
    approved_date: Optional[datetime] = None
    created_by: str
    classification_confidence: Optional[int] = None
    summary: Optional[str] = None
    shape_features: Optional[Dict[str, Any]] = None

    # 摘要表関連
    spec_sheet_item_id: Optional[str] = None
    spec_number: Optional[str] = None
    spec_sheet_item: Optional[SpecSheetItemInfo] = None

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


class EditHistorySchema(BaseModel):
    """編集履歴スキーマ"""

    id: int
    drawing_id: str
    user_id: str
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class EditHistoryListResponse(BaseModel):
    """編集履歴リストレスポンス"""

    total: int
    items: List[EditHistorySchema]
