"""
図面管理API
"""

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
from app.schemas.drawing import (
    DrawingResponse,
    DrawingListResponse,
    DrawingUpdate,
    BulkOperationRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/upload", response_model=List[DrawingResponse])
async def upload_drawing(
    file: UploadFile = File(...),
    run_analysis: bool = Query(True),
    db: Session = Depends(get_db),
):
    """
    図面をアップロード

    - **file**: PDFファイル
    - **run_analysis**: AI解析を実行するか（デフォルト: true）
    """
    try:
        print('[DEBUG] upload_drawing called')
        print('[DEBUG] file type:', type(file))
        print('[DEBUG] file.filename:', getattr(file, "filename", None))

        pdf_data = await file.read()
        print('[DEBUG] pdf_data length:', len(pdf_data) if pdf_data else 0)
        print('[DEBUG] run_analysis:', run_analysis)
        print('[DEBUG] db type:', type(db))

        service = DrawingService(db)
        print('[DEBUG] DrawingService created')

        print('[DEBUG] Call create_drawing with filename:', file.filename or "unknown.pdf")
        try:
            drawings = service.create_drawing(
                pdf_data=pdf_data,
                filename=file.filename or "unknown.pdf",
                run_analysis=run_analysis,
            )
            print('[DEBUG] create_drawing returned:', drawings)
        except Exception as e:
            print('[ERROR] Exception in create_drawing:', repr(e))
            raise

        return drawings

    except DrawingServiceException as e:
        print('[ERROR] DrawingServiceException:', repr(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print('[ERROR] Upload error:', repr(e))
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
    db: Session = Depends(get_db),
):
    """
    図面リストを取得

    - **skip**: スキップ件数
    - **limit**: 取得件数
    - **status**: ステータスフィルタ
    - **classification**: 分類フィルタ
    """
    service = DrawingService(db)
    drawings = service.list_drawings(
        skip=skip, limit=limit, status=status_filter, classification=classification
    )

    # 総件数取得（簡易版）
    total = len(drawings)

    return {"total": total, "items": drawings}


@router.get("/{drawing_id}", response_model=DrawingResponse)
def get_drawing(drawing_id: int, db: Session = Depends(get_db)):
    """
    図面を取得

    - **drawing_id**: 図面ID
    """
    service = DrawingService(db)
    drawing = service.get_drawing(drawing_id)

    if not drawing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません"
        )

    return drawing


@router.put("/{drawing_id}", response_model=DrawingResponse)
def update_drawing(
    drawing_id: int, updates: DrawingUpdate, db: Session = Depends(get_db)
):
    """
    図面を更新

    - **drawing_id**: 図面ID
    - **updates**: 更新内容
    """
    try:
        service = DrawingService(db)
        drawing = service.update_drawing(
            drawing_id, updates.model_dump(exclude_unset=True)
        )

        if not drawing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません"
            )

        return drawing

    except DrawingServiceException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{drawing_id}/approve", response_model=DrawingResponse)
def approve_drawing(drawing_id: int, db: Session = Depends(get_db)):
    """
    図面を承認

    - **drawing_id**: 図面ID
    """
    try:
        service = DrawingService(db)
        drawing = service.approve_drawing(drawing_id)

        if not drawing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません"
            )

        return drawing

    except DrawingServiceException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{drawing_id}/unapprove", response_model=DrawingResponse)
def unapprove_drawing(drawing_id: int, db: Session = Depends(get_db)):
    """
    図面の承認を取り消し

    - **drawing_id**: 図面ID
    """
    try:
        service = DrawingService(db)
        drawing = service.unapprove_drawing(drawing_id)

        if not drawing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません"
            )

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
def reanalyze_drawing(drawing_id: int, db: Session = Depends(get_db)):
    """
    図面を再解析

    - **drawing_id**: 図面ID
    """
    try:
        service = DrawingService(db)
        drawing = service.get_drawing(drawing_id)

        if not drawing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="図面が見つかりません"
            )

        # 再解析実行
        service._run_analysis(drawing)

        return drawing

    except DrawingServiceException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
