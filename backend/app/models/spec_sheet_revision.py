"""摘要表改定履歴モデル"""
from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from ..database import Base


class SpecSheetRevision(Base):
    """摘要表改定履歴モデル

    摘要表の改定履歴（A, B, C...）
    """

    __tablename__ = "spec_sheet_revisions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    spec_sheet_id = Column(String, ForeignKey("spec_sheets.id"), nullable=False)
    revision_symbol = Column(String, nullable=False)  # 改定記号 (A, B, C...)
    revision_date = Column(String)  # 改定日付
    description = Column(Text)  # 改定内容
    created_by = Column(String)  # 作成者
    checked_by = Column(String)  # 照査者
    approved_by = Column(String)  # 検認者
    remarks = Column(Text)  # 備考
    created_at = Column(TIMESTAMP, default=func.now())

    # リレーションシップ
    spec_sheet = relationship("SpecSheet", back_populates="revisions")

    def __repr__(self):
        return f"<SpecSheetRevision(id={self.id}, symbol={self.revision_symbol}, date={self.revision_date})>"
