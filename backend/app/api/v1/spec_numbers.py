"""摘番マスタAPIルーター"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
import tempfile
import os
import json
import logging
import re

from ...database import get_db
from ...models.spec_number import SpecNumber
from ...schemas.spec_number import (
    SpecNumberCreate,
    SpecNumberUpdate,
    SpecNumberResponse,
    SpecNumberListResponse,
    SpecNumberImportResponse,
    SpecNumberPrefixListResponse,
    SpecNumberNextResponse,
    SpecNumberFilterOptionsResponse,
)
from ...schemas.spec_number import SpecNumberListParams
from ...services.spec_sheet_service import SpecNumberService
from ...services.excel_parser_service import ExcelParserService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/spec-numbers", tags=["spec-numbers"])


def get_config() -> dict:
    """設定を取得"""
    config_path = os.path.join(os.path.dirname(__file__), "../../../../config.json")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


@router.post("/import", response_model=SpecNumberImportResponse)
async def import_spec_numbers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """摘番一括検索Excelをインポート

    対応フォーマット: .xlsx
    """
    # ファイル拡張子チェック
    if not file.filename:
        raise HTTPException(status_code=400, detail="ファイル名が不正です")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".xlsx"]:
        raise HTTPException(
            status_code=415,
            detail="対応していないファイル形式です。.xlsx形式のファイルをアップロードしてください。"
        )

    # 一時ファイルに保存
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Excelパース
        config = get_config()
        parser = ExcelParserService(config)
        rows = parser.parse_spec_number_excel(tmp_path)

        # DBにインポート
        service = SpecNumberService(db)
        imported, skipped, errors = service.import_spec_numbers(rows)

        return SpecNumberImportResponse(
            total_rows=len(rows),
            imported=imported,
            skipped=skipped,
            errors=errors
        )

    except Exception as e:
        logger.error(f"摘番マスタインポートエラー: {e}")
        raise HTTPException(status_code=400, detail=f"インポートエラー: {str(e)}")

    finally:
        # 一時ファイル削除
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/filter-options", response_model=SpecNumberFilterOptionsResponse)
async def get_filter_options(
    db: Session = Depends(get_db)
):
    """フィルタオプション取得（プレフィックス、ライン名、使用場所）"""
    service = SpecNumberService(db)
    prefixes, line_names, usage_locations = service.get_filter_options()

    return SpecNumberFilterOptionsResponse(
        prefixes=prefixes,
        line_names=line_names,
        usage_locations=usage_locations
    )


@router.get("/prefixes", response_model=SpecNumberPrefixListResponse)
async def get_prefixes(
    db: Session = Depends(get_db)
):
    """摘番プレフィックス一覧取得"""
    service = SpecNumberService(db)
    prefixes = service.get_prefixes()

    return SpecNumberPrefixListResponse(prefixes=prefixes)


@router.get("/next/{prefix}", response_model=SpecNumberNextResponse)
async def get_next_spec_number(
    prefix: str,
    db: Session = Depends(get_db)
):
    """次の摘番を取得

    指定プレフィックスの最大番号+1を返す
    """
    # プレフィックスは1文字のアルファベット
    if not prefix or len(prefix) != 1 or not prefix.isalpha():
        raise HTTPException(
            status_code=400,
            detail="プレフィックスは1文字のアルファベットで指定してください"
        )

    service = SpecNumberService(db)
    next_spec_number, current_max = service.get_next_spec_number(prefix.upper())

    # 摘番番号は999までに制限
    if current_max >= 999:
        raise HTTPException(
            status_code=400,
            detail=f"プレフィックス {prefix.upper()} の摘番は上限（999）に達しています。新規作成できません。"
        )

    return SpecNumberNextResponse(
        next_spec_number=next_spec_number,
        prefix=prefix.upper(),
        current_max_number=current_max
    )


@router.get("/", response_model=SpecNumberListResponse)
async def list_spec_numbers(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    prefix: Optional[str] = None,
    spec_number: Optional[str] = None,
    title: Optional[str] = None,
    line_name: Optional[str] = None,
    equipment_name: Optional[str] = None,
    usage_location: Optional[str] = None,
    sort_by: str = "spec_number",
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """摘番マスタ一覧取得"""
    service = SpecNumberService(db)
    items, total = service.list_spec_numbers_with_prefix(
        page=page,
        per_page=per_page,
        prefix=prefix,
        spec_number=spec_number,
        title=title,
        line_name=line_name,
        equipment_name=equipment_name,
        usage_location=usage_location,
        sort_by=sort_by,
        sort_order=sort_order
    )

    return SpecNumberListResponse(
        total=total,
        page=page,
        per_page=per_page,
        items=items
    )


@router.get("/{spec_number_id}", response_model=SpecNumberResponse)
async def get_spec_number(
    spec_number_id: str,
    db: Session = Depends(get_db)
):
    """摘番マスタ詳細取得"""
    service = SpecNumberService(db)
    spec_number = service.get_spec_number(spec_number_id)

    if not spec_number:
        raise HTTPException(status_code=404, detail="摘番マスタが見つかりません")

    return spec_number


@router.post("/", response_model=SpecNumberResponse, status_code=201)
async def create_spec_number(
    data: SpecNumberCreate,
    db: Session = Depends(get_db)
):
    """摘番マスタ作成"""
    service = SpecNumberService(db)

    # 摘番番号のバリデーション（1000以上は不可）
    spec_num_match = re.match(r"^([A-Z])(\d+)$", data.spec_number.upper())
    if spec_num_match:
        number_part = int(spec_num_match.group(2))
        if number_part >= 1000:
            raise HTTPException(
                status_code=400,
                detail=f"摘番番号は999以下である必要があります。{data.spec_number} は作成できません。"
            )

    # 重複チェック
    existing = service.get_by_spec_number(data.spec_number)
    if existing:
        raise HTTPException(status_code=409, detail=f"摘番 {data.spec_number} は既に存在します")

    spec_number = service.create_spec_number(**data.model_dump())
    return spec_number


@router.put("/{spec_number_id}", response_model=SpecNumberResponse)
async def update_spec_number(
    spec_number_id: str,
    data: SpecNumberUpdate,
    db: Session = Depends(get_db)
):
    """摘番マスタ更新"""
    service = SpecNumberService(db)

    try:
        spec_number = service.update_spec_number(
            spec_number_id,
            **data.model_dump(exclude_unset=True)
        )
        return spec_number
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{spec_number_id}", status_code=204)
async def delete_spec_number(
    spec_number_id: str,
    db: Session = Depends(get_db)
):
    """摘番マスタ削除"""
    service = SpecNumberService(db)
    success = service.delete_spec_number(spec_number_id)

    if not success:
        raise HTTPException(status_code=404, detail="摘番マスタが見つかりません")

    return None
