"""
設備マスタモデル
"""

from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from ..database import Base


class Equipment(Base):
    """設備マスタ"""

    __tablename__ = "equipments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    line_id = Column(String, ForeignKey("lines.id"), nullable=False)
    code = Column(String, unique=True, nullable=False)  # 設備コード
    name = Column(String, nullable=False)  # 設備名
    description = Column(Text)  # 説明
    manufacturer = Column(String)  # メーカー (オプション)
    model = Column(String)  # 型式 (オプション)
    installed_date = Column(String)  # 設置日 (オプション)
    synced_from_oracle = Column(Boolean, default=False)  # OracleDB同期フラグ
    created_at = Column(TIMESTAMP, default=func.now())
    updated_at = Column(TIMESTAMP, default=func.now(), onupdate=func.now())

    # リレーションシップ
    line = relationship("Line", back_populates="equipments")
    drawings = relationship("Drawing", back_populates="equipment")
    spec_sheets = relationship("SpecSheet", back_populates="equipment")
    attachments = relationship("EquipmentAttachment", back_populates="equipment", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Equipment(id={self.id}, code={self.code}, name={self.name})>"
