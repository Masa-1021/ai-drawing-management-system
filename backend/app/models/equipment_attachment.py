"""
設備添付ファイルモデル
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class EquipmentAttachment(Base):
    """設備添付ファイル"""

    __tablename__ = "equipment_attachments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    equipment_id = Column(String(36), ForeignKey("equipments.id", ondelete="CASCADE"), nullable=False, index=True)

    # ファイル情報
    filename = Column(String(255), nullable=False)  # 元のファイル名
    stored_filename = Column(String(255), nullable=False)  # 保存時のファイル名（UUID）
    file_path = Column(String(512), nullable=False)  # ファイルパス
    file_size = Column(Integer, nullable=False)  # ファイルサイズ（バイト）
    mime_type = Column(String(100), nullable=True)  # MIMEタイプ

    # カテゴリ（soft: ソフト関連, manual: 取説, inspection: 点検マニュアル, asset: 資産情報, other: その他）
    category = Column(String(50), nullable=False, default="other")

    # サブカテゴリ（各カテゴリ内の種別：ソフトならPLC/GOT/サーボ等、取説なら操作/保守等）
    sub_category = Column(String(50), nullable=True, index=True)

    # メタデータ
    description = Column(Text, nullable=True)  # 説明
    version = Column(String(50), nullable=True)  # バージョン（A, B, C...）

    # バージョン管理（ソフト用）
    version_group_id = Column(String(36), nullable=True, index=True)  # 同一ソフトのバージョングループID
    is_latest = Column(Boolean, default=True)  # 最新バージョンかどうか

    # 後方互換性のため残す（sub_categoryに移行）
    soft_type = Column(String(50), nullable=True)

    # 作成日時・更新日時
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100), nullable=True)  # 作成者

    # リレーション
    equipment = relationship("Equipment", back_populates="attachments")

    def __repr__(self):
        return f"<EquipmentAttachment(id={self.id}, filename={self.filename}, category={self.category})>"
