from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import Generator
import os
from pathlib import Path

# プロジェクトルートからの相対パスでデータベースURLを設定
project_root = Path(__file__).parent.parent.parent
db_path = project_root / "storage" / "database.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{db_path}")

# SQLAlchemyエンジン
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,
)

# セッションファクトリ
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ベースクラス
Base = declarative_base()


def get_db() -> Generator:
    """
    データベースセッションを取得

    Yields:
        Session: SQLAlchemyセッション
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
