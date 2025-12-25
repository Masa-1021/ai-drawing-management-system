"""摘要表APIルーター"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
import tempfile
import os
import json
import shutil
import uuid
import logging

from ...database import get_db
from ...schemas.spec_sheet import (
    SpecSheetCreate,
    SpecSheetUpdate,
    SpecSheetResponse,
    SpecSheetListResponse,
    SpecSheetListItem,
    SpecSheetUploadResponse,
    LinkEquipmentRequest,
    FindMatchingDrawingsResponse,
    LinkDrawingsRequest,
    LinkDrawingsResponse,
    EquipmentSuggestion,
    EquipmentInfo,
    UpdateItemParentRequest,
    SpecSheetItemResponse,
    BulkUpdatePartTypeRequest,
    BulkUpdatePartTypeResponse,
    LinkSingleDrawingRequest,
    LinkedDrawingInfo,
    UpdateWebLinkRequest,
    UpdateWebLinkResponse,
)
from ...services.spec_sheet_service import SpecSheetService
from ...services.excel_parser_service import ExcelParserService
from ...services.drawing_link_service import DrawingLinkService
from ...services.drawing_service import DrawingService, DrawingServiceException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/spec-sheets", tags=["spec-sheets"])


def _convert_item_to_response(item) -> SpecSheetItemResponse:
    """摘要表部品をレスポンススキーマに変換"""
    linked_drawing = None
    linked_drawing_id = None

    # linked_drawingリレーションシップから図面情報を取得
    if item.linked_drawing:
        linked_drawing_id = item.linked_drawing.id
        linked_drawing = LinkedDrawingInfo(
            id=item.linked_drawing.id,
            pdf_filename=item.linked_drawing.pdf_filename,
            thumbnail_path=item.linked_drawing.thumbnail_path
        )

    return SpecSheetItemResponse(
        id=item.id,
        spec_sheet_id=item.spec_sheet_id,
        row_number=item.row_number,
        part_name=item.part_name,
        drawing_number=item.drawing_number,
        sub_number=item.sub_number,
        item_number=item.item_number,
        material=item.material,
        heat_treatment=item.heat_treatment,
        surface_treatment=item.surface_treatment,
        quantity_per_set=item.quantity_per_set,
        required_quantity=item.required_quantity,
        revision=item.revision,
        part_type=item.part_type,
        parent_name=item.parent_name,
        parent_item_id=item.parent_item_id,
        web_link=item.web_link,
        linked_drawing_id=linked_drawing_id,
        linked_drawing=linked_drawing,
        created_at=item.created_at,
        updated_at=item.updated_at
    )


def get_config() -> dict:
    """設定を取得"""
    config_path = os.path.join(os.path.dirname(__file__), "../../../../config.json")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def get_storage_path() -> str:
    """ストレージパスを取得"""
    config = get_config()
    storage_path = config.get("storagePath", "./storage/drawings/")
    # spec_sheets用のサブディレクトリ
    spec_sheets_path = os.path.join(os.path.dirname(storage_path), "spec_sheets")
    os.makedirs(spec_sheets_path, exist_ok=True)
    return spec_sheets_path


@router.post("/upload", response_model=SpecSheetUploadResponse)
async def upload_spec_sheet(
    file: UploadFile = File(...),
    equipment_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """摘要表Excelをアップロード

    対応フォーマット: .xlsx, .xlsm
    """
    # ファイル拡張子チェック
    if not file.filename:
        raise HTTPException(status_code=400, detail="ファイル名が不正です")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".xlsx", ".xlsm"]:
        raise HTTPException(
            status_code=415,
            detail="対応していないファイル形式です。.xlsx または .xlsm 形式のファイルをアップロードしてください。"
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
        header, revisions, items = parser.parse_spec_sheet_excel(tmp_path)

        # ストレージに保存
        storage_path = get_storage_path()
        file_id = str(uuid.uuid4())
        stored_filename = f"{file_id}{ext}"
        stored_path = os.path.join(storage_path, stored_filename)
        shutil.copy(tmp_path, stored_path)

        # DBに保存
        service = SpecSheetService(db)
        spec_sheet = service.create_spec_sheet(
            header=header,
            revisions=revisions,
            items=items,
            file_path=stored_path,
            original_filename=file.filename,
            equipment_id=equipment_id
        )

        # 設備サジェスト
        suggested_equipment = None
        if not equipment_id:
            suggestion = service.suggest_equipment(header.line_name, header.equipment_name)
            if suggestion:
                suggested_equipment = EquipmentSuggestion(**suggestion)

        return SpecSheetUploadResponse(
            id=spec_sheet.id,
            spec_number=spec_sheet.spec_number,
            equipment_name=spec_sheet.equipment_name,
            line_name=spec_sheet.line_name,
            item_count=len(items),
            revision_count=len(revisions),
            suggested_equipment=suggested_equipment
        )

    except Exception as e:
        logger.error(f"摘要表アップロードエラー: {e}")
        raise HTTPException(status_code=400, detail=f"アップロードエラー: {str(e)}")

    finally:
        # 一時ファイル削除
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/", response_model=SpecSheetListResponse)
async def list_spec_sheets(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    line_name: Optional[str] = None,
    equipment_name: Optional[str] = None,
    spec_number: Optional[str] = None,
    model_name: Optional[str] = None,
    created_by: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "spec_number",
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """摘要表一覧取得"""
    service = SpecSheetService(db)
    items, total = service.list_spec_sheets(
        page=page,
        per_page=per_page,
        line_name=line_name,
        equipment_name=equipment_name,
        spec_number=spec_number,
        model_name=model_name,
        created_by=created_by,
        status=status,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order
    )

    # 軽量版に変換
    list_items = []
    for item in items:
        item_count = len(item.items) if item.items else 0
        linked_count = sum(1 for i in item.items if i.linked_drawing) if item.items else 0

        list_items.append(SpecSheetListItem(
            id=item.id,
            equipment_id=item.equipment_id,
            spec_number=item.spec_number,
            equipment_name=item.equipment_name,
            line_name=item.line_name,
            model_name=item.model_name,
            order_number=item.order_number,
            created_by=item.created_by,
            checked_by=item.checked_by,
            designed_by=item.designed_by,
            approved_by=item.approved_by,
            current_revision=item.current_revision,
            original_filename=item.original_filename,
            status=item.status,
            item_count=item_count,
            linked_count=linked_count,
            created_at=item.created_at,
            updated_at=item.updated_at
        ))

    return SpecSheetListResponse(
        total=total,
        page=page,
        per_page=per_page,
        items=list_items
    )


@router.get("/{spec_sheet_id}", response_model=SpecSheetResponse)
async def get_spec_sheet(
    spec_sheet_id: str,
    db: Session = Depends(get_db)
):
    """摘要表詳細取得"""
    service = SpecSheetService(db)
    spec_sheet = service.get_spec_sheet(spec_sheet_id)

    if not spec_sheet:
        raise HTTPException(status_code=404, detail="摘要表が見つかりません")

    # 設備情報を追加
    equipment_info = None
    if spec_sheet.equipment:
        equipment_info = EquipmentInfo(
            id=spec_sheet.equipment.id,
            code=spec_sheet.equipment.code,
            name=spec_sheet.equipment.name,
            line_name=spec_sheet.equipment.line.name if spec_sheet.equipment.line else None
        )

    # itemsを変換（linked_drawingをLinkedDrawingInfoに変換）
    items_response = [_convert_item_to_response(item) for item in spec_sheet.items]

    response = SpecSheetResponse(
        id=spec_sheet.id,
        equipment_id=spec_sheet.equipment_id,
        spec_number=spec_sheet.spec_number,
        equipment_name=spec_sheet.equipment_name,
        line_name=spec_sheet.line_name,
        model_name=spec_sheet.model_name,
        order_number=spec_sheet.order_number,
        created_by=spec_sheet.created_by,
        checked_by=spec_sheet.checked_by,
        designed_by=spec_sheet.designed_by,
        approved_by=spec_sheet.approved_by,
        current_revision=spec_sheet.current_revision,
        file_path=spec_sheet.file_path,
        original_filename=spec_sheet.original_filename,
        status=spec_sheet.status,
        created_at=spec_sheet.created_at,
        updated_at=spec_sheet.updated_at,
        equipment=equipment_info,
        revisions=spec_sheet.revisions,
        items=items_response
    )

    return response


@router.put("/{spec_sheet_id}", response_model=SpecSheetResponse)
async def update_spec_sheet(
    spec_sheet_id: str,
    data: SpecSheetUpdate,
    db: Session = Depends(get_db)
):
    """摘要表更新"""
    service = SpecSheetService(db)

    try:
        spec_sheet = service.update_spec_sheet(
            spec_sheet_id,
            **data.model_dump(exclude_unset=True)
        )
        return spec_sheet
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{spec_sheet_id}", status_code=204)
async def delete_spec_sheet(
    spec_sheet_id: str,
    db: Session = Depends(get_db)
):
    """摘要表削除"""
    service = SpecSheetService(db)
    spec_sheet = service.get_spec_sheet(spec_sheet_id)

    if not spec_sheet:
        raise HTTPException(status_code=404, detail="摘要表が見つかりません")

    # ファイル削除
    if spec_sheet.file_path and os.path.exists(spec_sheet.file_path):
        os.unlink(spec_sheet.file_path)

    service.delete_spec_sheet(spec_sheet_id)
    return None


@router.post("/{spec_sheet_id}/link-equipment", response_model=SpecSheetResponse)
async def link_equipment(
    spec_sheet_id: str,
    request: LinkEquipmentRequest,
    db: Session = Depends(get_db)
):
    """摘要表を設備に紐づけ"""
    service = SpecSheetService(db)

    try:
        spec_sheet = service.link_to_equipment(spec_sheet_id, request.equipment_id)
        return spec_sheet
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{spec_sheet_id}/find-matching-drawings", response_model=FindMatchingDrawingsResponse)
async def find_matching_drawings(
    spec_sheet_id: str,
    db: Session = Depends(get_db)
):
    """摘要表の図面番号と一致する宙に浮いた図面を検索"""
    spec_service = SpecSheetService(db)
    spec_sheet = spec_service.get_spec_sheet(spec_sheet_id)

    if not spec_sheet:
        raise HTTPException(status_code=404, detail="摘要表が見つかりません")

    link_service = DrawingLinkService(db)
    candidates = link_service.find_matching_drawings(spec_sheet_id)

    # 宙に浮いた図面の総数を取得
    _, total_unlinked = link_service.find_unlinked_drawings(per_page=1)

    return FindMatchingDrawingsResponse(
        candidates=candidates,
        total_unlinked=total_unlinked
    )


@router.post("/{spec_sheet_id}/link-drawings", response_model=LinkDrawingsResponse)
async def link_drawings(
    spec_sheet_id: str,
    request: LinkDrawingsRequest,
    db: Session = Depends(get_db)
):
    """図面を一括紐づけ"""
    spec_service = SpecSheetService(db)
    spec_sheet = spec_service.get_spec_sheet(spec_sheet_id)

    if not spec_sheet:
        raise HTTPException(status_code=404, detail="摘要表が見つかりません")

    link_service = DrawingLinkService(db)
    linked_count, errors = link_service.link_drawings_batch(request.links)

    return LinkDrawingsResponse(
        linked_count=linked_count,
        errors=errors
    )


@router.patch("/{spec_sheet_id}/items/{item_id}/parent", response_model=SpecSheetItemResponse)
async def update_item_parent(
    spec_sheet_id: str,
    item_id: str,
    request: UpdateItemParentRequest,
    db: Session = Depends(get_db)
):
    """部品の親を更新"""
    service = SpecSheetService(db)

    try:
        item = service.update_item_parent(
            spec_sheet_id=spec_sheet_id,
            item_id=item_id,
            parent_item_id=request.parent_item_id
        )
        return _convert_item_to_response(item)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{spec_sheet_id}/items/bulk-update-type", response_model=BulkUpdatePartTypeResponse)
async def bulk_update_part_type(
    spec_sheet_id: str,
    request: BulkUpdatePartTypeRequest,
    db: Session = Depends(get_db)
):
    """部品種別を一括更新"""
    service = SpecSheetService(db)

    try:
        updated_count, errors = service.bulk_update_part_type(
            spec_sheet_id=spec_sheet_id,
            item_ids=request.item_ids,
            part_type=request.part_type
        )
        return BulkUpdatePartTypeResponse(
            updated_count=updated_count,
            errors=errors
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{spec_sheet_id}/items/{item_id}/link-drawing", response_model=SpecSheetItemResponse)
async def link_single_drawing_to_item(
    spec_sheet_id: str,
    item_id: str,
    request: LinkSingleDrawingRequest,
    db: Session = Depends(get_db)
):
    """摘要表部品に図面を紐づけ"""
    spec_service = SpecSheetService(db)
    drawing_service = DrawingService(db)

    # 摘要表の存在確認
    spec_sheet = spec_service.get_spec_sheet(spec_sheet_id)
    if not spec_sheet:
        raise HTTPException(status_code=404, detail="摘要表が見つかりません")

    # 部品の存在確認
    item = None
    for i in spec_sheet.items:
        if i.id == item_id:
            item = i
            break

    if not item:
        raise HTTPException(status_code=404, detail="部品が見つかりません")

    try:
        # 図面を摘要表部品に紐づけ（Drawing.spec_sheet_item_idを更新）
        drawing_service.link_to_spec_sheet_item(
            drawing_id=request.drawing_id,
            spec_sheet_item_id=item_id,
            spec_number=spec_sheet.spec_number
        )

        # リレーションシップを反映するためにセッションをリフレッシュ
        db.refresh(item)

        return _convert_item_to_response(item)
    except DrawingServiceException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{spec_sheet_id}/items/{item_id}/link-drawing", response_model=SpecSheetItemResponse)
async def unlink_drawing_from_item(
    spec_sheet_id: str,
    item_id: str,
    db: Session = Depends(get_db)
):
    """摘要表部品から図面の紐づけを解除"""
    spec_service = SpecSheetService(db)
    drawing_service = DrawingService(db)

    # 摘要表の存在確認
    spec_sheet = spec_service.get_spec_sheet(spec_sheet_id)
    if not spec_sheet:
        raise HTTPException(status_code=404, detail="摘要表が見つかりません")

    # 部品の存在確認
    item = None
    for i in spec_sheet.items:
        if i.id == item_id:
            item = i
            break

    if not item:
        raise HTTPException(status_code=404, detail="部品が見つかりません")

    # linked_drawingリレーションシップ経由で紐づき図面を確認
    if not item.linked_drawing:
        raise HTTPException(status_code=400, detail="紐づけられた図面がありません")

    try:
        # 図面の紐づけを解除（Drawing.spec_sheet_item_idをNULLに）
        drawing_service.unlink_from_spec_sheet_item(item.linked_drawing.id)

        # リレーションシップを反映するためにセッションをリフレッシュ
        db.refresh(item)

        return _convert_item_to_response(item)
    except DrawingServiceException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{spec_sheet_id}/items/{item_id}/web-link", response_model=UpdateWebLinkResponse)
async def update_item_web_link(
    spec_sheet_id: str,
    item_id: str,
    request: UpdateWebLinkRequest,
    db: Session = Depends(get_db)
):
    """部品のWebリンクを更新

    部品タイプが'part'または'purchased'の場合のみ更新可能
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"update_item_web_link called: spec_sheet_id={spec_sheet_id}, item_id={item_id}, web_link={request.web_link}")

    spec_service = SpecSheetService(db)

    # 摘要表の存在確認
    spec_sheet = spec_service.get_spec_sheet(spec_sheet_id)
    if not spec_sheet:
        raise HTTPException(status_code=404, detail="摘要表が見つかりません")

    # 部品の存在確認
    item = None
    for i in spec_sheet.items:
        if i.id == item_id:
            item = i
            break

    if not item:
        raise HTTPException(status_code=404, detail="部品が見つかりません")

    logger.info(f"Found item: part_type={item.part_type}, part_name={item.part_name}")

    # 部品タイプが'part'または'purchased'かチェック
    if item.part_type not in ("part", "purchased"):
        raise HTTPException(
            status_code=400,
            detail=f"Webリンクは部品タイプが'part'または'purchased'の場合のみ設定できます（現在: {item.part_type}）"
        )

    # Webリンクを更新
    item.web_link = request.web_link
    db.commit()
    db.refresh(item)

    return UpdateWebLinkResponse(
        id=item.id,
        web_link=item.web_link
    )
