"""摘要表部品モデル"""
from sqlalchemy import Column, String, Text, Integer, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from ..database import Base


class SpecSheetItem(Base):
    """摘要表部品モデル

    摘要表の部品リスト1行分のデータ
    """

    __tablename__ = "spec_sheet_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    spec_sheet_id = Column(String, ForeignKey("spec_sheets.id"), nullable=False)
    row_number = Column(Integer, nullable=False)  # 行番号
    part_name = Column(String)  # 品名
    drawing_number = Column(String)  # 図面番号
    sub_number = Column(String)  # 副番
    item_number = Column(String)  # 品番
    material = Column(String)  # 材料/メーカー
    heat_treatment = Column(String)  # 熱処理
    surface_treatment = Column(String)  # 表面処理
    quantity_per_set = Column(Integer)  # 数/セット
    required_quantity = Column(Integer)  # 必要数
    revision = Column(String)  # 改定記号
    part_type = Column(String, nullable=False)  # 'assembly', 'unit', 'part', 'purchased'
    parent_item_id = Column(String, ForeignKey("spec_sheet_items.id"), nullable=True)  # 親部品ID（自己参照）
    parent_name = Column(String)  # 親ユニット名（列27から）
    web_link = Column(String(2048), nullable=True)  # 外部Webリンク（部品タイプのみ）
    created_at = Column(TIMESTAMP, default=func.now())
    updated_at = Column(TIMESTAMP, default=func.now(), onupdate=func.now())

    # リレーションシップ
    spec_sheet = relationship("SpecSheet", back_populates="items")
    parent_item = relationship(
        "SpecSheetItem",
        remote_side=[id],
        backref="child_items"
    )
    linked_drawing = relationship(
        "Drawing",
        back_populates="spec_sheet_item",
        uselist=False
    )

    def __repr__(self):
        return f"<SpecSheetItem(id={self.id}, row={self.row_number}, part_name={self.part_name}, type={self.part_type})>"
