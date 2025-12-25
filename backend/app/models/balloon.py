from sqlalchemy import Column, String, Integer, Float, ForeignKey, Index
from sqlalchemy.orm import relationship

from ..database import Base


class Balloon(Base):
    """風船情報モデル"""

    __tablename__ = "balloons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    drawing_id = Column(String, ForeignKey("drawings.id"), nullable=False)
    balloon_number = Column(String)  # 後方互換性のため保持
    part_name = Column(String)  # 後方互換性のため保持
    quantity = Column(Integer)  # 後方互換性のため保持
    upper_text = Column(String)  # 風船上部のテキスト
    lower_text = Column(String)  # 風船下部のテキスト
    adjacent_text = Column(String)  # 風船周辺のテキスト（型式、品名など）
    adjacent_position = Column(String)  # 付随テキストの位置（right, bottom, right_bottom等）
    x = Column(Float)
    y = Column(Float)
    confidence = Column(Float)

    # リレーションシップ
    drawing = relationship("Drawing", back_populates="balloons")

    # インデックス
    __table_args__ = (Index("idx_balloons_drawing", "drawing_id"),)

    def __repr__(self):
        return f"<Balloon(upper={self.upper_text}, lower={self.lower_text})>"
