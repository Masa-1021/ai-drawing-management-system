from sqlalchemy import Column, String, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class Lock(Base):
    """編集ロックモデル"""

    __tablename__ = "locks"

    drawing_id = Column(String, ForeignKey("drawings.id"), primary_key=True)
    user_id = Column(String, nullable=False)
    acquired_at = Column(TIMESTAMP, default=func.now())
    expires_at = Column(TIMESTAMP, nullable=False)

    # リレーションシップ
    drawing = relationship("Drawing", back_populates="lock")

    def __repr__(self):
        return (
            f"<Lock(drawing_id={self.drawing_id}, user={self.user_id}, expires={self.expires_at})>"
        )
