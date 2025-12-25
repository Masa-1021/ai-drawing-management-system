"""
検索API
"""

import logging
from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.services.search_service import SearchService, SearchServiceException
from app.schemas.drawing import DrawingResponse

logger = logging.getLogger(__name__)

router = APIRouter()


class NaturalSearchRequest(BaseModel):
    """自然言語検索リクエスト"""

    query: str


class SimilaritySearchResponse(BaseModel):
    """類似検索レスポンス"""

    drawing: DrawingResponse
    similarity_score: int
    reason: str
    common_features: List[str] = []
    differences: List[str] = []


@router.post("/natural", response_model=List[DrawingResponse])
def natural_language_search(request: NaturalSearchRequest, db: Session = Depends(get_db)):
    """
    自然言語検索

    - **query**: 自然言語クエリ（例: "作成者が田中の図面"）
    """
    try:
        service = SearchService(db)
        drawings = service.natural_language_search(request.query)

        return drawings

    except SearchServiceException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/similar", response_model=List[SimilaritySearchResponse])
def similarity_search(
    drawing_id: int = Query(...),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    類似図面検索

    - **drawing_id**: 検索元の図面ID
    - **limit**: 取得件数
    """
    try:
        service = SearchService(db)
        results = service.similarity_search(drawing_id, limit)

        return results

    except SearchServiceException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
