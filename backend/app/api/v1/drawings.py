"""
図面管理API
"""

import asyncio
import logging
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    Query,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.drawing_service import DrawingService, DrawingServiceException
from app.services.drawing_link_service import DrawingLinkService
from app.services.claude_client import AWSAuthenticationError
from app.schemas.drawing import (
    DrawingResponse,
    DrawingListResponse,
    DrawingUpdate,
    BulkOperationRequest,
    SpecSheetItemInfo,
    EditHistorySchema,
    EditHistoryListResponse,
)
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


def _enrich_drawing_with_spec_info(drawing) -> dict:
    """図面に摘要表情報を追加する"""
    drawing_dict = {
        "id": drawing.id,
        "original_filename": drawing.original_filename,
        "pdf_filename": drawing.pdf_filename,
        "pdf_path": drawing.pdf_path,
        "page_number": drawing.page_number,
        "thumbnail_path": drawing.thumbnail_path,
        "status": drawing.status,
        "classification": drawing.classification,
        "classification_confidence": drawing.classification_confidence,
        "rotation": drawing.rotation,
        "upload_date": drawing.upload_date,
        "analyzed_at": drawing.analyzed_at,
        "approved_date": drawing.approved_date,
        "created_by": drawing.created_by,
        "summary": drawing.summary,
        "shape_features": drawing.shape_features,
        "spec_sheet_item_id": drawing.spec_sheet_item_id,
        "spec_number": drawing.spec_number,
        "extracted_fields": drawing.extracted_fields,
        "balloons": drawing.balloons,
        "revisions": drawing.revisions,
        "tags": drawing.tags,
        "spec_sheet_item": None,
    }

    # 摘要表部品情報を追加
    if drawing.spec_sheet_item:
        item = drawing.spec_sheet_item
        spec_sheet = item.spec_sheet if hasattr(item, "spec_sheet") and item.spec_sheet else None
        drawing_dict["spec_sheet_item"] = {
            "id": item.id,
            "row_number": item.row_number,
            "part_name": item.part_name,
            "drawing_number": item.drawing_number,
            "part_type": item.part_type,
            "spec_sheet_id": item.spec_sheet_id,
            "spec_number": spec_sheet.spec_number if spec_sheet else (drawing.spec_number or ""),
            "equipment_name": spec_sheet.equipment_name if spec_sheet else None,
            "line_name": spec_sheet.line_name if spec_sheet else None,
        }

    return drawing_dict


@router.post("/upload", response_model=List[DrawingResponse])
async def upload_drawing(
    files: List[UploadFile] = File(...),
    run_analysis: bool = Query(True),
    db: Session = Depends(get_db),
):
    """
    図面をアップロード（複数ファイル対応）

    - **files**: PDFまたはTIFファイル（複数可）
    - **run_analysis**: AI解析を実行するか（デフォルト: true）

    TIFファイルの場合は自動的にPDFに変換してから処理されます
    """
    try:
        service = DrawingService(db)
        all_drawings = []

        logger.info(f"Starting upload of {len(files)} files")

        for index, file in enumerate(files, 1):
            logger.info(f"Processing file {index}/{len(files)}: {file.filename}")
            pdf_data = await file.read()
            # スレッドプールで実行してイベントループをブロックしない
            # これによりWebSocket進捗通知がリアルタイムで送信される
            drawings = await asyncio.to_thread(
                service.create_drawing,
                pdf_data=pdf_data,
                filename=file.filename or "unknown.pdf",
                run_analysis=run_analysis,
            )
            all_drawings.extend(drawings)
            logger.info(
                f"Completed file {index}/{len(files)}: {file.filename} ({len(drawings)} pages)"
            )

        logger.info(f"Upload completed: {len(files)} files, {len(all_drawings)} total pages")
        return all_drawings

    except AWSAuthenticationError as e:
        logger.error(f"AWS authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "AWS_AUTH_EXPIRED",
                "message": "AWS認証の有効期限が切れました。コマンドプロンプトで 'aws sso login --profile <profile>' を実行してください。",
            },
        )
    except DrawingServiceException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="アップロードエラー",
        )


@router.get("/", response_model=DrawingListResponse)
def list_drawings(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: Optional[str] = Query(None, alias="status"),
    classification: Optional[str] = None,
    search: Optional[str] = None,
    tags: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    図面リストを取得

    - **skip**: スキップ件数
    - **limit**: 取得件数
    - **status**: ステータスフィルタ
    - **classification**: 分類フィルタ
    - **search**: ファイル名検索（部分一致）
    - **tags**: タグフィルタ（カンマ区切り）
    """
    service = DrawingService(db)

    # タグをリストに変換
    tag_list = tags.split(",") if tags else None

    drawings = service.list_drawings(
        skip=skip,
        limit=limit,
        status=status_filter,
        classification=classification,
        search=search,
        tags=tag_list,
    )

    # 総件数取得（簡易版）
    total = len(drawings)

    # 各図面に摘要表情報を追加
    enriched_drawings = [_enrich_drawing_with_spec_info(d) for d in drawings]

    return {"total": total, "items": enriched_drawings}


@router.get("/{drawing_id}", response_model=DrawingResponse)
def get_drawing(drawing_id: str, db: Session = Depends(get_db)):
    """
    図面を取得

    - **drawing_id**: 図面ID
    """
    service = DrawingService(db)
    drawing = service.get_drawing(drawing_id)

    if not drawing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません")

    return _enrich_drawing_with_spec_info(drawing)


@router.put("/{drawing_id}", response_model=DrawingResponse)
def update_drawing(drawing_id: str, updates: DrawingUpdate, db: Session = Depends(get_db)):
    """
    図面を更新

    - **drawing_id**: 図面ID
    - **updates**: 更新内容
    """
    try:
        service = DrawingService(db)
        drawing = service.update_drawing(drawing_id, updates.model_dump(exclude_unset=True))

        if not drawing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません")

        return drawing

    except DrawingServiceException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{drawing_id}/approve", response_model=DrawingResponse)
def approve_drawing(drawing_id: str, db: Session = Depends(get_db)):
    """
    図面を承認

    - **drawing_id**: 図面ID
    """
    try:
        service = DrawingService(db)
        drawing = service.approve_drawing(drawing_id)

        if not drawing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません")

        return drawing

    except DrawingServiceException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{drawing_id}/unapprove", response_model=DrawingResponse)
def unapprove_drawing(drawing_id: str, db: Session = Depends(get_db)):
    """
    図面の承認を取り消し

    - **drawing_id**: 図面ID
    """
    try:
        service = DrawingService(db)
        drawing = service.unapprove_drawing(drawing_id)

        if not drawing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません")

        return drawing

    except DrawingServiceException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/")
def delete_drawings(request: BulkOperationRequest, db: Session = Depends(get_db)):
    """
    図面を削除（一括）

    - **drawing_ids**: 削除する図面IDリスト
    """
    try:
        service = DrawingService(db)
        deleted_count = service.delete_drawings(request.drawing_ids)

        return {"deleted_count": deleted_count}

    except DrawingServiceException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{drawing_id}/reanalyze", response_model=DrawingResponse)
def reanalyze_drawing(drawing_id: str, db: Session = Depends(get_db)):
    """
    図面を再解析

    - **drawing_id**: 図面ID
    """
    try:
        service = DrawingService(db)
        drawing = service.get_drawing(drawing_id)

        if not drawing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません")

        # 再解析実行
        service._run_analysis(drawing)

        return drawing

    except DrawingServiceException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ========================
# 摘要表紐づけ関連エンドポイント
# ========================

class LinkSpecItemRequest(BaseModel):
    """摘要表部品紐づけリクエスト"""
    spec_sheet_item_id: str


class UnlinkedDrawingItem(BaseModel):
    """宙に浮いた図面"""
    id: str
    pdf_filename: str
    thumbnail_path: Optional[str] = None
    classification: Optional[str] = None
    spec_number: Optional[str] = None
    upload_date: str


class UnlinkedDrawingsResponse(BaseModel):
    """宙に浮いた図面一覧レスポンス"""
    total: int
    page: int
    per_page: int
    items: List[UnlinkedDrawingItem]


class SpecSheetItemInfo(BaseModel):
    """摘要表部品情報"""
    id: str
    row_number: int
    part_name: Optional[str] = None
    drawing_number: Optional[str] = None
    part_type: str


class SpecSheetInfo(BaseModel):
    """摘要表情報"""
    id: str
    spec_number: str
    equipment_name: Optional[str] = None
    line_name: Optional[str] = None


class DrawingWithSpecInfoResponse(BaseModel):
    """図面と摘要表情報レスポンス"""
    drawing: DrawingResponse
    spec_sheet_item: Optional[SpecSheetItemInfo] = None
    spec_sheet: Optional[SpecSheetInfo] = None


@router.get("/unlinked", response_model=UnlinkedDrawingsResponse)
def get_unlinked_drawings(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    宙に浮いた図面（摘要表に紐づいていない図面）を取得

    - **page**: ページ番号
    - **per_page**: 1ページあたりの件数
    - **search**: ファイル名検索（部分一致）
    """
    service = DrawingLinkService(db)
    drawings, total = service.find_unlinked_drawings(
        page=page,
        per_page=per_page,
        search=search
    )

    items = [
        UnlinkedDrawingItem(
            id=d.id,
            pdf_filename=d.pdf_filename,
            thumbnail_path=d.thumbnail_path,
            classification=d.classification,
            spec_number=d.spec_number,
            upload_date=d.upload_date.isoformat() if d.upload_date else ""
        )
        for d in drawings
    ]

    return UnlinkedDrawingsResponse(
        total=total,
        page=page,
        per_page=per_page,
        items=items
    )


@router.get("/{drawing_id}/spec-info", response_model=DrawingWithSpecInfoResponse)
def get_drawing_with_spec_info(drawing_id: str, db: Session = Depends(get_db)):
    """
    図面と紐づき摘要表情報を取得

    - **drawing_id**: 図面ID
    """
    drawing_service = DrawingService(db)
    drawing = drawing_service.get_drawing(drawing_id)

    if not drawing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません")

    link_service = DrawingLinkService(db)
    result = link_service.get_drawing_with_spec_info(drawing_id)

    spec_sheet_item_info = None
    spec_sheet_info = None

    if result and result.get("spec_sheet_item"):
        item = result["spec_sheet_item"]
        spec_sheet_item_info = SpecSheetItemInfo(
            id=item.id,
            row_number=item.row_number,
            part_name=item.part_name,
            drawing_number=item.drawing_number,
            part_type=item.part_type
        )

    if result and result.get("spec_sheet"):
        sheet = result["spec_sheet"]
        spec_sheet_info = SpecSheetInfo(
            id=sheet.id,
            spec_number=sheet.spec_number,
            equipment_name=sheet.equipment_name,
            line_name=sheet.line_name
        )

    return DrawingWithSpecInfoResponse(
        drawing=drawing,
        spec_sheet_item=spec_sheet_item_info,
        spec_sheet=spec_sheet_info
    )


@router.post("/{drawing_id}/link-spec-item", response_model=DrawingResponse)
def link_spec_item(
    drawing_id: str,
    request: LinkSpecItemRequest,
    db: Session = Depends(get_db)
):
    """
    図面を摘要表部品に紐づけ

    - **drawing_id**: 図面ID
    - **spec_sheet_item_id**: 摘要表部品ID
    """
    service = DrawingLinkService(db)

    try:
        drawing = service.link_drawing_to_item(drawing_id, request.spec_sheet_item_id)
        return drawing
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{drawing_id}/unlink-spec-item", response_model=DrawingResponse)
def unlink_spec_item(drawing_id: str, db: Session = Depends(get_db)):
    """
    図面と摘要表部品の紐づけを解除

    - **drawing_id**: 図面ID
    """
    service = DrawingLinkService(db)

    try:
        drawing = service.unlink_drawing(drawing_id)
        return drawing
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{drawing_id}/extract-spec-number", response_model=DrawingResponse)
def extract_spec_number(drawing_id: str, db: Session = Depends(get_db)):
    """
    図面の図番から摘番を自動抽出して設定

    - **drawing_id**: 図面ID
    """
    link_service = DrawingLinkService(db)
    spec_number = link_service.auto_extract_and_set_spec_number(drawing_id)

    drawing_service = DrawingService(db)
    drawing = drawing_service.get_drawing(drawing_id)

    if not drawing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません")

    return drawing


# ========================
# 編集履歴エンドポイント
# ========================

@router.get("/{drawing_id}/edit-history", response_model=EditHistoryListResponse)
def get_edit_history(drawing_id: str, db: Session = Depends(get_db)):
    """
    図面の編集履歴を取得

    - **drawing_id**: 図面ID
    """
    from app.models.edit_history import EditHistory

    service = DrawingService(db)
    drawing = service.get_drawing(drawing_id)

    if not drawing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません")

    # 編集履歴を新しい順で取得
    history = db.query(EditHistory).filter(
        EditHistory.drawing_id == drawing_id
    ).order_by(EditHistory.timestamp.desc()).all()

    return EditHistoryListResponse(
        total=len(history),
        items=[EditHistorySchema.model_validate(h) for h in history]
    )
