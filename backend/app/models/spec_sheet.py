"""摘要表モデル"""
from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from ..database import Base


class SpecSheet(Base):
    """摘要表モデル

    設備の部品リストを記載したExcelファイルから抽出された情報
    """

    __tablename__ = "spec_sheets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    equipment_id = Column(String, ForeignKey("equipments.id"), nullable=True)  # 設備ID（NULL許容）
    spec_number = Column(String, nullable=False)  # 摘番 (例: S843)
    equipment_name = Column(String)  # 設備名 (Excelから抽出)
    line_name = Column(String)  # ライン名 (Excelから抽出)
    model_name = Column(String)  # 機種名
    order_number = Column(String)  # 製作番号
    created_by = Column(String)  # 作成者
    checked_by = Column(String)  # 照査者
    designed_by = Column(String)  # 設計者
    approved_by = Column(String)  # 検認者
    current_revision = Column(String)  # 現在の改定記号
    file_path = Column(String)  # アップロードファイルパス
    original_filename = Column(String)  # 元のファイル名
    status = Column(String, default="draft")  # 'draft', 'linked', 'active'
    created_at = Column(TIMESTAMP, default=func.now())
    updated_at = Column(TIMESTAMP, default=func.now(), onupdate=func.now())

    # リレーションシップ
    equipment = relationship("Equipment", back_populates="spec_sheets")
    revisions = relationship(
        "SpecSheetRevision",
        back_populates="spec_sheet",
        cascade="all, delete-orphan",
        order_by="SpecSheetRevision.revision_symbol.desc()"
    )
    items = relationship(
        "SpecSheetItem",
        back_populates="spec_sheet",
        cascade="all, delete-orphan",
        order_by="SpecSheetItem.row_number"
    )

    def __repr__(self):
        return f"<SpecSheet(id={self.id}, spec_number={self.spec_number}, equipment_name={self.equipment_name})>"
