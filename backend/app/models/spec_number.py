"""摘番マスタモデル"""
from sqlalchemy import Column, String, Text, TIMESTAMP
from sqlalchemy.sql import func
import uuid

from ..database import Base


class SpecNumber(Base):
    """摘番マスタモデル

    摘番一括検索Excelからインポートされるマスタデータ
    """

    __tablename__ = "spec_numbers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    spec_number = Column(String, nullable=False, unique=True)  # 摘番 (例: S843, A001)
    title = Column(Text)  # 件名
    model_name = Column(String)  # 機種名
    material_code = Column(String)  # 資材コード
    usage_location = Column(String)  # 使用場所
    line_name = Column(String)  # ライン名
    equipment_name = Column(String)  # 使用設備
    design_date = Column(String)  # 年月日
    designer = Column(String)  # 設計者
    reference_drawing = Column(String)  # 参考図
    remarks = Column(Text)  # 備考
    created_at = Column(TIMESTAMP, default=func.now())
    updated_at = Column(TIMESTAMP, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SpecNumber(id={self.id}, spec_number={self.spec_number}, title={self.title})>"
