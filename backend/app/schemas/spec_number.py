"""摘番マスタスキーマ"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class SpecNumberBase(BaseModel):
    """摘番マスタ基本スキーマ"""
    spec_number: str = Field(..., min_length=1, max_length=10, description="摘番")
    title: Optional[str] = Field(None, description="件名")
    model_name: Optional[str] = Field(None, description="機種名")
    material_code: Optional[str] = Field(None, description="資材コード")
    usage_location: Optional[str] = Field(None, description="使用場所")
    line_name: Optional[str] = Field(None, description="ライン名")
    equipment_name: Optional[str] = Field(None, description="使用設備")
    design_date: Optional[str] = Field(None, description="年月日")
    designer: Optional[str] = Field(None, description="設計者")
    reference_drawing: Optional[str] = Field(None, description="参考図")
    remarks: Optional[str] = Field(None, description="備考")


class SpecNumberCreate(SpecNumberBase):
    """摘番マスタ作成スキーマ"""
    pass


class SpecNumberUpdate(BaseModel):
    """摘番マスタ更新スキーマ"""
    spec_number: Optional[str] = Field(None, min_length=1, max_length=10)
    title: Optional[str] = None
    model_name: Optional[str] = None
    material_code: Optional[str] = None
    usage_location: Optional[str] = None
    line_name: Optional[str] = None
    equipment_name: Optional[str] = None
    design_date: Optional[str] = None
    designer: Optional[str] = None
    reference_drawing: Optional[str] = None
    remarks: Optional[str] = None


class SpecNumberResponse(SpecNumberBase):
    """摘番マスタレスポンススキーマ"""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SpecNumberListParams(BaseModel):
    """摘番マスタ一覧取得パラメータ"""
    page: int = Field(1, ge=1, description="ページ番号")
    per_page: int = Field(50, ge=1, le=100, description="1ページあたりの件数")
    spec_number: Optional[str] = Field(None, description="摘番（部分一致）")
    title: Optional[str] = Field(None, description="件名（部分一致）")
    line_name: Optional[str] = Field(None, description="ライン名（部分一致）")
    equipment_name: Optional[str] = Field(None, description="設備名（部分一致）")
    sort_by: str = Field("spec_number", description="ソートカラム")
    sort_order: str = Field("asc", pattern="^(asc|desc)$", description="ソート順")


class SpecNumberListResponse(BaseModel):
    """摘番マスタ一覧レスポンス"""
    total: int
    page: int
    per_page: int
    items: List[SpecNumberResponse]


class SpecNumberImportResponse(BaseModel):
    """摘番マスタインポートレスポンス"""
    total_rows: int = Field(..., description="読み込み行数")
    imported: int = Field(..., description="インポート成功件数")
    skipped: int = Field(..., description="スキップ件数（重複等）")
    errors: List[str] = Field(default_factory=list, description="エラーメッセージ")


class SpecNumberPrefixListResponse(BaseModel):
    """摘番プレフィックス一覧レスポンス"""
    prefixes: List[str] = Field(..., description="プレフィックス一覧（A, B, L等）")


class SpecNumberNextResponse(BaseModel):
    """次の摘番レスポンス"""
    next_spec_number: str = Field(..., description="次の摘番")
    prefix: str = Field(..., description="プレフィックス")
    current_max_number: int = Field(..., description="現在の最大番号")


class SpecNumberFilterOptionsResponse(BaseModel):
    """摘番フィルタオプションレスポンス"""
    prefixes: List[str] = Field(..., description="プレフィックス一覧")
    line_names: List[str] = Field(..., description="ライン名一覧")
    usage_locations: List[str] = Field(..., description="使用場所一覧")
