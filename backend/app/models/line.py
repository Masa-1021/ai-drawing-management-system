"""
ラインマスタモデル
"""

from sqlalchemy import Column, String, Text, TIMESTAMP, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from ..database import Base


class Line(Base):
    """ラインマスタ"""

    __tablename__ = "lines"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, unique=True)  # ライン名
    code = Column(String, unique=True)  # ラインコード (オプション)
    description = Column(Text)  # 説明
    synced_from_oracle = Column(Boolean, default=False)  # OracleDB同期フラグ
    last_synced_at = Column(String)  # 最終同期日時 (ISO 8601)
    created_at = Column(TIMESTAMP, default=func.now())
    updated_at = Column(TIMESTAMP, default=func.now(), onupdate=func.now())

    # リレーションシップ
    equipments = relationship("Equipment", back_populates="line", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Line(id={self.id}, name={self.name})>"
