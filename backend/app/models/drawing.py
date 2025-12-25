from sqlalchemy import Column, String, Text, Float, JSON, TIMESTAMP, Integer, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from ..database import Base


class Drawing(Base):
    """図面モデル"""

    __tablename__ = "drawings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    original_filename = Column(String, nullable=False)  # アップロード時の元のファイル名
    pdf_filename = Column(String, nullable=False)  # 表示用ファイル名（編集可能）
    pdf_path = Column(String, nullable=False)  # 実際のストレージパス（UUID形式、読み取り専用）
    page_number = Column(Integer, nullable=False)
    thumbnail_path = Column(String)
    status = Column(
        String, nullable=False, default="pending"
    )  # 'pending', 'analyzing', 'approved', 'unapproved', 'failed'
    classification = Column(String)  # '部品図', 'ユニット図', '組図'
    classification_confidence = Column(Float)
    classification_reason = Column(Text)
    summary = Column(Text)  # 図面の要約
    shape_features = Column(JSON)  # プレート図の特徴
    rotation = Column(Integer, default=0)  # AI検出された回転角度 (0, 90, 180, 270)
    upload_date = Column(TIMESTAMP, default=func.now())
    analyzed_at = Column(TIMESTAMP)  # AI解析完了日時
    approved_date = Column(TIMESTAMP)
    created_by = Column(String, nullable=False)  # PCホスト名/ユーザー名
    updated_at = Column(TIMESTAMP, default=func.now(), onupdate=func.now())

    # 設備関連
    equipment_id = Column(String, ForeignKey("equipments.id"), nullable=True)  # 設備ID（NULL許容）

    # 摘要表関連
    spec_sheet_item_id = Column(String, ForeignKey("spec_sheet_items.id"), nullable=True)  # 摘要表部品ID
    spec_number = Column(String, nullable=True)  # 摘番

    # リレーションシップ
    equipment = relationship("Equipment", back_populates="drawings")
    spec_sheet_item = relationship("SpecSheetItem", back_populates="linked_drawing")
    extracted_fields = relationship(
        "ExtractedField", back_populates="drawing", cascade="all, delete-orphan"
    )
    balloons = relationship("Balloon", back_populates="drawing", cascade="all, delete-orphan")
    revisions = relationship("Revision", back_populates="drawing", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="drawing", cascade="all, delete-orphan")
    edit_history = relationship(
        "EditHistory", back_populates="drawing", cascade="all, delete-orphan"
    )
    lock = relationship(
        "Lock", back_populates="drawing", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Drawing(id={self.id}, filename={self.pdf_filename}, status={self.status})>"
