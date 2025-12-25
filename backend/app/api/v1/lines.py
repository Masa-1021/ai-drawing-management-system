"""
ライン管理API
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.line import LineResponse, LineCreate, LineUpdate
from app.models.line import Line

router = APIRouter()


@router.get("", response_model=List[LineResponse])
async def get_lines(db: Session = Depends(get_db)):
    """
    ライン一覧取得

    Returns:
        List[LineResponse]: ライン一覧
    """
    lines = db.query(Line).all()
    return lines


@router.get("/{line_id}", response_model=LineResponse)
async def get_line(line_id: str, db: Session = Depends(get_db)):
    """
    ライン詳細取得

    Args:
        line_id: ラインID

    Returns:
        LineResponse: ライン詳細

    Raises:
        HTTPException: ラインが見つからない場合
    """
    line = db.query(Line).filter(Line.id == line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")
    return line


@router.post("", response_model=LineResponse, status_code=201)
async def create_line(line: LineCreate, db: Session = Depends(get_db)):
    """
    ライン作成

    Args:
        line: ライン作成データ

    Returns:
        LineResponse: 作成されたライン

    Raises:
        HTTPException: 同じ名前またはコードのラインが既に存在する場合
    """
    # 重複チェック
    existing = db.query(Line).filter(Line.name == line.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Line with name '{line.name}' already exists")

    if line.code:
        existing_code = db.query(Line).filter(Line.code == line.code).first()
        if existing_code:
            raise HTTPException(
                status_code=400, detail=f"Line with code '{line.code}' already exists"
            )

    db_line = Line(**line.dict())
    db.add(db_line)
    db.commit()
    db.refresh(db_line)
    return db_line


@router.put("/{line_id}", response_model=LineResponse)
async def update_line(line_id: str, line: LineUpdate, db: Session = Depends(get_db)):
    """
    ライン更新

    Args:
        line_id: ラインID
        line: 更新データ

    Returns:
        LineResponse: 更新されたライン

    Raises:
        HTTPException: ラインが見つからない場合
    """
    db_line = db.query(Line).filter(Line.id == line_id).first()
    if not db_line:
        raise HTTPException(status_code=404, detail="Line not found")

    # 更新データを適用
    for key, value in line.dict(exclude_unset=True).items():
        setattr(db_line, key, value)

    db.commit()
    db.refresh(db_line)
    return db_line


@router.delete("/{line_id}", status_code=204)
async def delete_line(line_id: str, db: Session = Depends(get_db)):
    """
    ライン削除

    Args:
        line_id: ラインID

    Raises:
        HTTPException: ラインが見つからない場合
    """
    db_line = db.query(Line).filter(Line.id == line_id).first()
    if not db_line:
        raise HTTPException(status_code=404, detail="Line not found")

    db.delete(db_line)
    db.commit()
