"""摘要表スキーマ"""
from typing import Optional, List, Literal
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


# 部品タイプ
PartType = Literal["assembly", "unit", "part", "purchased"]

# 摘要表ステータス
SpecSheetStatus = Literal["draft", "linked", "active"]


class SpecSheetRevisionBase(BaseModel):
    """摘要表改定履歴基本スキーマ"""
    revision_symbol: str = Field(..., description="改定記号 (A, B, C...)")
    revision_date: Optional[str] = Field(None, description="改定日付")
    description: Optional[str] = Field(None, description="改定内容")
    created_by: Optional[str] = Field(None, description="作成者")
    checked_by: Optional[str] = Field(None, description="照査者")
    approved_by: Optional[str] = Field(None, description="検認者")
    remarks: Optional[str] = Field(None, description="備考")


class SpecSheetRevisionResponse(SpecSheetRevisionBase):
    """摘要表改定履歴レスポンス"""
    id: str
    spec_sheet_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class SpecSheetItemBase(BaseModel):
    """摘要表部品基本スキーマ"""
    row_number: int = Field(..., ge=0, description="行番号")
    part_name: Optional[str] = Field(None, description="品名")
    drawing_number: Optional[str] = Field(None, description="図面番号")
    sub_number: Optional[str] = Field(None, description="副番")
    item_number: Optional[str] = Field(None, description="品番")
    material: Optional[str] = Field(None, description="材料/メーカー")
    heat_treatment: Optional[str] = Field(None, description="熱処理")
    surface_treatment: Optional[str] = Field(None, description="表面処理")
    quantity_per_set: Optional[int] = Field(None, ge=0, description="数/セット")
    required_quantity: Optional[int] = Field(None, ge=0, description="必要数")
    revision: Optional[str] = Field(None, description="改定記号")
    part_type: PartType = Field(..., description="部品タイプ")
    parent_name: Optional[str] = Field(None, description="親ユニット名")
    web_link: Optional[str] = Field(None, max_length=2048, description="外部Webリンク（部品タイプのみ）")


class LinkedDrawingInfo(BaseModel):
    """紐づき図面情報"""
    id: str
    pdf_filename: str
    thumbnail_path: Optional[str] = None


class SpecSheetItemResponse(SpecSheetItemBase):
    """摘要表部品レスポンス"""
    id: str
    spec_sheet_id: str
    parent_item_id: Optional[str] = None
    linked_drawing_id: Optional[str] = None
    linked_drawing: Optional[LinkedDrawingInfo] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SpecSheetBase(BaseModel):
    """摘要表基本スキーマ"""
    spec_number: str = Field(..., description="摘番")
    equipment_name: Optional[str] = Field(None, description="設備名")
    line_name: Optional[str] = Field(None, description="ライン名")
    model_name: Optional[str] = Field(None, description="機種名")
    order_number: Optional[str] = Field(None, description="製作番号")
    created_by: Optional[str] = Field(None, description="作成者")
    checked_by: Optional[str] = Field(None, description="照査者")
    designed_by: Optional[str] = Field(None, description="設計者")
    approved_by: Optional[str] = Field(None, description="検認者")


class SpecSheetCreate(SpecSheetBase):
    """摘要表作成スキーマ"""
    equipment_id: Optional[str] = Field(None, description="設備ID")


class SpecSheetUpdate(BaseModel):
    """摘要表更新スキーマ"""
    equipment_id: Optional[str] = None
    spec_number: Optional[str] = None
    equipment_name: Optional[str] = None
    line_name: Optional[str] = None
    model_name: Optional[str] = None
    order_number: Optional[str] = None
    created_by: Optional[str] = None
    checked_by: Optional[str] = None
    designed_by: Optional[str] = None
    approved_by: Optional[str] = None
    status: Optional[SpecSheetStatus] = None


class EquipmentInfo(BaseModel):
    """設備情報"""
    id: str
    code: str
    name: str
    line_name: Optional[str] = None


class SpecSheetResponse(SpecSheetBase):
    """摘要表レスポンス"""
    id: str
    equipment_id: Optional[str] = None
    current_revision: Optional[str] = None
    file_path: Optional[str] = None
    original_filename: Optional[str] = None
    status: SpecSheetStatus
    created_at: datetime
    updated_at: datetime
    equipment: Optional[EquipmentInfo] = None
    revisions: List[SpecSheetRevisionResponse] = []
    items: List[SpecSheetItemResponse] = []

    class Config:
        from_attributes = True


class SpecSheetListParams(BaseModel):
    """摘要表一覧取得パラメータ"""
    page: int = Field(1, ge=1, description="ページ番号")
    per_page: int = Field(50, ge=1, le=100, description="1ページあたりの件数")
    line_name: Optional[str] = Field(None, description="ライン名（部分一致）")
    equipment_name: Optional[str] = Field(None, description="設備名（部分一致）")
    spec_number: Optional[str] = Field(None, description="摘番（部分一致）")
    model_name: Optional[str] = Field(None, description="機種名（部分一致）")
    created_by: Optional[str] = Field(None, description="作成者（部分一致）")
    status: Optional[SpecSheetStatus] = Field(None, description="ステータス")
    date_from: Optional[str] = Field(None, description="作成日From")
    date_to: Optional[str] = Field(None, description="作成日To")
    sort_by: str = Field("spec_number", description="ソートカラム")
    sort_order: str = Field("asc", pattern="^(asc|desc)$", description="ソート順")


class SpecSheetListItem(SpecSheetBase):
    """摘要表一覧アイテム（軽量版）"""
    id: str
    equipment_id: Optional[str] = None
    current_revision: Optional[str] = None
    original_filename: Optional[str] = None
    status: SpecSheetStatus
    item_count: int = Field(0, description="部品数")
    linked_count: int = Field(0, description="紐づき図面数")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SpecSheetListResponse(BaseModel):
    """摘要表一覧レスポンス"""
    total: int
    page: int
    per_page: int
    items: List[SpecSheetListItem]


class EquipmentSuggestion(BaseModel):
    """設備サジェスト"""
    equipment_id: str
    equipment_name: str
    line_name: str
    confidence: float = Field(..., ge=0, le=1, description="一致度")


class SpecSheetUploadResponse(BaseModel):
    """摘要表アップロードレスポンス"""
    id: str
    spec_number: str
    equipment_name: Optional[str] = None
    line_name: Optional[str] = None
    item_count: int = Field(..., description="部品数")
    revision_count: int = Field(..., description="改定履歴数")
    suggested_equipment: Optional[EquipmentSuggestion] = None


class LinkEquipmentRequest(BaseModel):
    """設備紐づけリクエスト"""
    equipment_id: str = Field(..., description="設備ID")


class DrawingLinkCandidate(BaseModel):
    """図面紐づけ候補"""
    spec_sheet_item_id: str
    spec_sheet_item_row: int
    spec_sheet_item_name: Optional[str]
    spec_sheet_item_drawing_number: Optional[str]
    drawing_id: str
    drawing_filename: str
    drawing_thumbnail: Optional[str] = None
    extracted_drawing_number: Optional[str] = None
    confidence: float = Field(..., ge=0, le=1, description="一致度")


class FindMatchingDrawingsResponse(BaseModel):
    """紐づけ候補検索レスポンス"""
    candidates: List[DrawingLinkCandidate]
    total_unlinked: int = Field(..., description="宙に浮いた図面の総数")


class LinkDrawingsRequest(BaseModel):
    """図面一括紐づけリクエスト"""
    links: List[dict] = Field(..., description="紐づけ情報 [{spec_sheet_item_id, drawing_id}, ...]")


class LinkDrawingsResponse(BaseModel):
    """図面一括紐づけレスポンス"""
    linked_count: int = Field(..., description="紐づけ成功件数")
    errors: List[str] = Field(default_factory=list, description="エラーメッセージ")


class UpdateItemParentRequest(BaseModel):
    """部品の親更新リクエスト"""
    parent_item_id: str = Field(..., description="親部品ID")


class BulkUpdatePartTypeRequest(BaseModel):
    """部品種別一括更新リクエスト"""
    item_ids: List[str] = Field(..., min_length=1, description="更新対象部品IDリスト")
    part_type: PartType = Field(..., description="新しい部品種別")


class BulkUpdatePartTypeResponse(BaseModel):
    """部品種別一括更新レスポンス"""
    updated_count: int = Field(..., description="更新件数")
    errors: List[str] = Field(default_factory=list, description="エラーメッセージ")


class LinkSingleDrawingRequest(BaseModel):
    """単一図面紐づけリクエスト"""
    drawing_id: str = Field(..., description="図面ID")


class UpdateWebLinkRequest(BaseModel):
    """Webリンク更新リクエスト"""
    web_link: Optional[str] = Field(None, max_length=2048, description="外部WebリンクURL")

    @field_validator("web_link")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not v.startswith(("http://", "https://")):
            raise ValueError("URLはhttp://またはhttps://で始まる必要があります")
        return v


class UpdateWebLinkResponse(BaseModel):
    """Webリンク更新レスポンス"""
    id: str
    web_link: Optional[str] = None
