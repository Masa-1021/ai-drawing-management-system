"""
設備管理API
"""

import os
import uuid
import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.database import get_db
from app.schemas.equipment import EquipmentResponse, EquipmentCreate, EquipmentUpdate
from app.schemas.drawing import DrawingResponse
from app.schemas.equipment_attachment import (
    EquipmentAttachmentResponse,
    EquipmentAttachmentListResponse,
    EquipmentAttachmentGroupedResponse,
    EquipmentAttachmentUpdateRequest,
    EquipmentAttachmentVersionHistoryResponse,
)
from app.models.equipment import Equipment
from app.models.drawing import Drawing
from app.models.spec_sheet import SpecSheet
from app.models.spec_sheet_item import SpecSheetItem
from app.models.equipment_attachment import EquipmentAttachment

router = APIRouter()

# 添付ファイルのストレージパス
ATTACHMENTS_STORAGE_PATH = Path(__file__).parent.parent.parent.parent / "storage" / "attachments"


@router.get("", response_model=List[EquipmentResponse])
async def get_equipments(line_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    設備一覧取得（ライン指定可能）

    Args:
        line_id: ライン ID（指定した場合、そのラインの設備のみ取得）

    Returns:
        List[EquipmentResponse]: 設備一覧
    """
    query = db.query(Equipment)
    if line_id:
        query = query.filter(Equipment.line_id == line_id)
    equipments = query.all()
    return equipments


@router.get("/{equipment_id}", response_model=EquipmentResponse)
async def get_equipment(equipment_id: str, db: Session = Depends(get_db)):
    """
    設備詳細取得

    Args:
        equipment_id: 設備ID

    Returns:
        EquipmentResponse: 設備詳細

    Raises:
        HTTPException: 設備が見つからない場合
    """
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment


@router.get("/{equipment_id}/drawings", response_model=List[DrawingResponse])
async def get_equipment_drawings(equipment_id: str, db: Session = Depends(get_db)):
    """
    設備に紐づく図面一覧取得

    直接設備に紐づく図面と、摘要表経由で紐づく図面の両方を取得します。

    Args:
        equipment_id: 設備ID

    Returns:
        List[DrawingResponse]: 図面一覧

    Raises:
        HTTPException: 設備が見つからない場合
    """
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    # 直接設備に紐づく図面と、摘要表経由で紐づく図面の両方を取得
    # Drawing -> SpecSheetItem -> SpecSheet -> Equipment の経路を含める
    drawings = (
        db.query(Drawing)
        .outerjoin(SpecSheetItem, Drawing.spec_sheet_item_id == SpecSheetItem.id)
        .outerjoin(SpecSheet, SpecSheetItem.spec_sheet_id == SpecSheet.id)
        .filter(
            or_(
                Drawing.equipment_id == equipment_id,
                SpecSheet.equipment_id == equipment_id
            )
        )
        .order_by(Drawing.upload_date.desc())
        .all()
    )

    return drawings


@router.post("", response_model=EquipmentResponse, status_code=201)
async def create_equipment(equipment: EquipmentCreate, db: Session = Depends(get_db)):
    """
    設備作成

    Args:
        equipment: 設備作成データ

    Returns:
        EquipmentResponse: 作成された設備

    Raises:
        HTTPException: 同じコードの設備が既に存在する場合、またはラインが存在しない場合
    """
    # コード重複チェック
    existing = db.query(Equipment).filter(Equipment.code == equipment.code).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Equipment with code '{equipment.code}' already exists",
        )

    db_equipment = Equipment(**equipment.dict())
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment


@router.put("/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(
    equipment_id: str, equipment: EquipmentUpdate, db: Session = Depends(get_db)
):
    """
    設備更新

    Args:
        equipment_id: 設備ID
        equipment: 更新データ

    Returns:
        EquipmentResponse: 更新された設備

    Raises:
        HTTPException: 設備が見つからない場合
    """
    db_equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not db_equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    # 更新データを適用
    for key, value in equipment.dict(exclude_unset=True).items():
        setattr(db_equipment, key, value)

    db.commit()
    db.refresh(db_equipment)
    return db_equipment


@router.delete("/{equipment_id}", status_code=204)
async def delete_equipment(equipment_id: str, db: Session = Depends(get_db)):
    """
    設備削除

    Args:
        equipment_id: 設備ID

    Raises:
        HTTPException: 設備が見つからない場合
    """
    db_equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not db_equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    db.delete(db_equipment)
    db.commit()


# ========================
# 添付ファイル関連エンドポイント
# ========================

@router.get("/{equipment_id}/attachments", response_model=EquipmentAttachmentListResponse)
async def get_equipment_attachments(
    equipment_id: str,
    category: Optional[str] = Query(None, description="カテゴリでフィルタ"),
    latest_only: bool = Query(True, description="最新バージョンのみ取得"),
    db: Session = Depends(get_db)
):
    """
    設備の添付ファイル一覧取得

    Args:
        equipment_id: 設備ID
        category: カテゴリフィルタ（soft, manual, inspection, asset, other）
        latest_only: Trueの場合、最新バージョンのみ取得（デフォルト: True）

    Returns:
        EquipmentAttachmentListResponse: 添付ファイル一覧
    """
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    query = db.query(EquipmentAttachment).filter(EquipmentAttachment.equipment_id == equipment_id)
    if category:
        query = query.filter(EquipmentAttachment.category == category)

    # 最新バージョンのみ取得する場合
    if latest_only:
        query = query.filter(
            or_(
                EquipmentAttachment.is_latest == True,
                EquipmentAttachment.is_latest.is_(None)  # 旧データ対応
            )
        )

    attachments = query.order_by(
        EquipmentAttachment.sub_category,
        EquipmentAttachment.created_at.desc()
    ).all()

    return EquipmentAttachmentListResponse(
        total=len(attachments),
        items=attachments
    )


@router.get("/{equipment_id}/attachments/grouped", response_model=EquipmentAttachmentGroupedResponse)
async def get_equipment_attachments_grouped(
    equipment_id: str,
    category: str = Query(..., description="カテゴリ（必須）"),
    latest_only: bool = Query(True, description="最新バージョンのみ取得"),
    db: Session = Depends(get_db)
):
    """
    サブカテゴリ別にグループ化された添付ファイル一覧取得

    Args:
        equipment_id: 設備ID
        category: カテゴリ（soft, manual, inspection, asset, other）
        latest_only: Trueの場合、最新バージョンのみ取得

    Returns:
        EquipmentAttachmentGroupedResponse: グループ化された添付ファイル一覧
    """
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    query = db.query(EquipmentAttachment).filter(
        EquipmentAttachment.equipment_id == equipment_id,
        EquipmentAttachment.category == category
    )

    if latest_only:
        query = query.filter(
            or_(
                EquipmentAttachment.is_latest == True,
                EquipmentAttachment.is_latest.is_(None)
            )
        )

    attachments = query.order_by(EquipmentAttachment.created_at.desc()).all()

    # サブカテゴリ別にグループ化
    groups: dict = {}
    for att in attachments:
        sub_cat = att.sub_category or att.soft_type or "未分類"
        if sub_cat not in groups:
            groups[sub_cat] = []
        groups[sub_cat].append(att)

    return EquipmentAttachmentGroupedResponse(
        category=category,
        groups=groups,
        total=len(attachments)
    )


def get_next_version(db: Session, equipment_id: str, category: str, sub_category: Optional[str], version_group_id: Optional[str] = None) -> str:
    """
    次のバージョン文字（A, B, C...）を取得

    Args:
        db: データベースセッション
        equipment_id: 設備ID
        category: カテゴリ
        sub_category: サブカテゴリ
        version_group_id: バージョングループID（指定時はそのグループ内で次のバージョンを取得）

    Returns:
        str: 次のバージョン文字（A, B, C...Z, AA, AB...）
    """
    if version_group_id:
        # 特定のバージョングループ内で次のバージョンを取得
        query = db.query(EquipmentAttachment).filter(
            EquipmentAttachment.version_group_id == version_group_id
        )
    else:
        # カテゴリとサブカテゴリでフィルタ
        query = db.query(EquipmentAttachment).filter(
            EquipmentAttachment.equipment_id == equipment_id,
            EquipmentAttachment.category == category,
        )
        if sub_category:
            query = query.filter(
                or_(
                    EquipmentAttachment.sub_category == sub_category,
                    EquipmentAttachment.soft_type == sub_category  # 後方互換
                )
            )

    existing = query.filter(EquipmentAttachment.version.isnot(None)).all()

    if not existing:
        return "A"

    # 既存のバージョンから最大を取得
    versions = [att.version for att in existing if att.version]
    if not versions:
        return "A"

    # バージョン文字をソート（A, B, C... Z, AA, AB...）
    max_version = max(versions, key=lambda v: (len(v), v))

    # 次のバージョンを計算
    if max_version == "Z":
        return "AA"
    elif len(max_version) == 1:
        return chr(ord(max_version) + 1)
    else:
        # AA, AB... の場合
        last_char = max_version[-1]
        if last_char == "Z":
            # AZ -> BA, BZ -> CA...
            return chr(ord(max_version[0]) + 1) + "A"
        else:
            return max_version[:-1] + chr(ord(last_char) + 1)


@router.post("/{equipment_id}/attachments", response_model=EquipmentAttachmentResponse, status_code=201)
async def upload_equipment_attachment(
    equipment_id: str,
    file: UploadFile = File(...),
    category: str = Form("other"),
    sub_category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    version: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    設備に添付ファイルをアップロード

    Args:
        equipment_id: 設備ID
        file: アップロードファイル
        category: カテゴリ（soft, manual, inspection, asset, other）
        sub_category: サブカテゴリ（種別）
        description: 説明
        version: バージョン（指定しない場合は自動採番 A, B, C...）

    Returns:
        EquipmentAttachmentResponse: アップロードされた添付ファイル
    """
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    # カテゴリバリデーション
    valid_categories = ["soft", "manual", "inspection", "asset", "other"]
    if category not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )

    # サブカテゴリが必須
    if not sub_category:
        raise HTTPException(
            status_code=400,
            detail="sub_category is required"
        )

    # バージョンが指定されていない場合は自動採番
    final_version = version
    if not final_version:
        final_version = get_next_version(db, equipment_id, category, sub_category)

    # 新規アップロードの場合、バージョングループIDを生成
    version_group_id = str(uuid.uuid4())

    # ストレージディレクトリ作成
    ATTACHMENTS_STORAGE_PATH.mkdir(parents=True, exist_ok=True)

    # ファイル名とパス生成
    file_ext = Path(file.filename).suffix if file.filename else ""
    stored_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = ATTACHMENTS_STORAGE_PATH / stored_filename

    # ファイル保存
    content = await file.read()
    file_size = len(content)

    with open(file_path, "wb") as f:
        f.write(content)

    # MIMEタイプ推定
    mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0]

    # DBに保存
    attachment = EquipmentAttachment(
        equipment_id=equipment_id,
        filename=file.filename or "unknown",
        stored_filename=stored_filename,
        file_path=str(file_path),
        file_size=file_size,
        mime_type=mime_type,
        category=category,
        sub_category=sub_category,
        description=description,
        version=final_version,
        version_group_id=version_group_id,
        is_latest=True,
        # 後方互換性のため
        soft_type=sub_category if category == "soft" else None,
    )

    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment


@router.post("/{equipment_id}/attachments/{attachment_id}/update-version", response_model=EquipmentAttachmentResponse, status_code=201)
async def update_attachment_version(
    equipment_id: str,
    attachment_id: str,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    既存添付ファイルの新バージョンをアップロード（バージョンアップ）

    Args:
        equipment_id: 設備ID
        attachment_id: 元の添付ファイルID
        file: 新しいファイル
        description: 説明（省略時は元の説明を引き継ぐ）

    Returns:
        EquipmentAttachmentResponse: 新しいバージョンの添付ファイル
    """
    # 元のファイルを取得
    original = db.query(EquipmentAttachment).filter(
        EquipmentAttachment.id == attachment_id,
        EquipmentAttachment.equipment_id == equipment_id
    ).first()

    if not original:
        raise HTTPException(status_code=404, detail="Original attachment not found")

    # バージョングループIDを取得（なければ作成）
    version_group_id = original.version_group_id or str(uuid.uuid4())

    # 元のファイルにversion_group_idがない場合は更新
    if not original.version_group_id:
        original.version_group_id = version_group_id

    # 元のファイルを旧バージョンに設定
    original.is_latest = False

    # 変更をDBにフラッシュ（get_next_versionクエリで参照されるようにする）
    db.flush()

    # 次のバージョンを取得
    next_version = get_next_version(db, equipment_id, original.category, original.sub_category or original.soft_type, version_group_id)

    # ストレージディレクトリ作成
    ATTACHMENTS_STORAGE_PATH.mkdir(parents=True, exist_ok=True)

    # ファイル名とパス生成
    file_ext = Path(file.filename).suffix if file.filename else ""
    stored_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = ATTACHMENTS_STORAGE_PATH / stored_filename

    # ファイル保存
    content = await file.read()
    file_size = len(content)

    with open(file_path, "wb") as f:
        f.write(content)

    # MIMEタイプ推定
    mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0]

    # 新しいバージョンを作成
    new_attachment = EquipmentAttachment(
        equipment_id=equipment_id,
        filename=file.filename or "unknown",
        stored_filename=stored_filename,
        file_path=str(file_path),
        file_size=file_size,
        mime_type=mime_type,
        category=original.category,
        sub_category=original.sub_category or original.soft_type,
        description=description or original.description,
        version=next_version,
        version_group_id=version_group_id,
        is_latest=True,
        soft_type=original.soft_type,
    )

    db.add(new_attachment)
    db.commit()
    db.refresh(new_attachment)

    return new_attachment


@router.get("/{equipment_id}/attachments/{attachment_id}/history", response_model=EquipmentAttachmentVersionHistoryResponse)
async def get_attachment_version_history(
    equipment_id: str,
    attachment_id: str,
    db: Session = Depends(get_db)
):
    """
    添付ファイルのバージョン履歴を取得

    Args:
        equipment_id: 設備ID
        attachment_id: 添付ファイルID

    Returns:
        EquipmentAttachmentVersionHistoryResponse: バージョン履歴
    """
    # 指定されたファイルを取得
    attachment = db.query(EquipmentAttachment).filter(
        EquipmentAttachment.id == attachment_id,
        EquipmentAttachment.equipment_id == equipment_id
    ).first()

    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # バージョングループIDがない場合は履歴なし
    if not attachment.version_group_id:
        return EquipmentAttachmentVersionHistoryResponse(
            current=attachment,
            history=[]
        )

    # 同じバージョングループの全ファイルを取得
    all_versions = db.query(EquipmentAttachment).filter(
        EquipmentAttachment.version_group_id == attachment.version_group_id
    ).order_by(EquipmentAttachment.created_at.desc()).all()

    # 最新と履歴を分ける
    current = next((v for v in all_versions if v.is_latest), all_versions[0])
    history = [v for v in all_versions if v.id != current.id]

    return EquipmentAttachmentVersionHistoryResponse(
        current=current,
        history=history
    )


@router.get("/{equipment_id}/attachments/{attachment_id}", response_model=EquipmentAttachmentResponse)
async def get_equipment_attachment(
    equipment_id: str,
    attachment_id: str,
    db: Session = Depends(get_db)
):
    """
    添付ファイル詳細取得

    Args:
        equipment_id: 設備ID
        attachment_id: 添付ファイルID

    Returns:
        EquipmentAttachmentResponse: 添付ファイル詳細
    """
    attachment = db.query(EquipmentAttachment).filter(
        EquipmentAttachment.id == attachment_id,
        EquipmentAttachment.equipment_id == equipment_id
    ).first()

    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    return attachment


@router.get("/{equipment_id}/attachments/{attachment_id}/download")
async def download_equipment_attachment(
    equipment_id: str,
    attachment_id: str,
    db: Session = Depends(get_db)
):
    """
    添付ファイルダウンロード

    Args:
        equipment_id: 設備ID
        attachment_id: 添付ファイルID

    Returns:
        FileResponse: ファイルレスポンス
    """
    attachment = db.query(EquipmentAttachment).filter(
        EquipmentAttachment.id == attachment_id,
        EquipmentAttachment.equipment_id == equipment_id
    ).first()

    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_path = Path(attachment.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on storage")

    return FileResponse(
        path=file_path,
        filename=attachment.filename,
        media_type=attachment.mime_type or "application/octet-stream"
    )


@router.patch("/{equipment_id}/attachments/{attachment_id}", response_model=EquipmentAttachmentResponse)
async def update_equipment_attachment(
    equipment_id: str,
    attachment_id: str,
    request: EquipmentAttachmentUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    添付ファイル情報更新

    Args:
        equipment_id: 設備ID
        attachment_id: 添付ファイルID
        request: 更新データ

    Returns:
        EquipmentAttachmentResponse: 更新された添付ファイル
    """
    attachment = db.query(EquipmentAttachment).filter(
        EquipmentAttachment.id == attachment_id,
        EquipmentAttachment.equipment_id == equipment_id
    ).first()

    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # 更新データを適用
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(attachment, key, value)

    db.commit()
    db.refresh(attachment)

    return attachment


@router.delete("/{equipment_id}/attachments/{attachment_id}", status_code=204)
async def delete_equipment_attachment(
    equipment_id: str,
    attachment_id: str,
    db: Session = Depends(get_db)
):
    """
    添付ファイル削除

    Args:
        equipment_id: 設備ID
        attachment_id: 添付ファイルID
    """
    attachment = db.query(EquipmentAttachment).filter(
        EquipmentAttachment.id == attachment_id,
        EquipmentAttachment.equipment_id == equipment_id
    ).first()

    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # ファイルを削除
    file_path = Path(attachment.file_path)
    if file_path.exists():
        file_path.unlink()

    # DBから削除
    db.delete(attachment)
    db.commit()
