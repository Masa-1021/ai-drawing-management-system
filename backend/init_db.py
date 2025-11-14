"""
データベース初期化スクリプト

Usage:
    python init_db.py
"""

import sys
import os
from pathlib import Path

# プロジェクトルートをPythonパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from app.database import Base, engine
from app.models import (
    Drawing,
    ExtractedField,
    Balloon,
    Revision,
    Tag,
    EditHistory,
    Lock,
)


def init_database():
    """データベースを初期化"""
    print("データベースを初期化しています...")

    # storage/ディレクトリが存在するか確認（プロジェクトルートから）
    project_root = Path(__file__).parent.parent
    storage_dir = project_root / "storage"
    if not storage_dir.exists():
        print(f"エラー: {storage_dir} が存在しません")
        print("storage/ディレクトリを作成します...")
        storage_dir.mkdir(parents=True, exist_ok=True)
        (storage_dir / "drawings").mkdir(exist_ok=True)
        (storage_dir / "thumbnails").mkdir(exist_ok=True)
        (storage_dir / "logs").mkdir(exist_ok=True)

    # データベースファイルのパスを設定
    db_path = storage_dir / "database.db"
    print(f"データベースパス: {db_path}")

    # すべてのテーブルを作成
    Base.metadata.create_all(bind=engine)

    print("[OK] データベース初期化完了")
    print("[OK] 作成されたテーブル:")
    for table in Base.metadata.tables:
        print(f"  - {table}")


if __name__ == "__main__":
    init_database()
    # drawingsテーブルにpage_numberカラムを追加（既存DB）
    import sqlite3
    db_path = Path(__file__).parent.parent / "storage" / "database.db"
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE drawings ADD COLUMN page_number INTEGER NOT NULL DEFAULT 0;")
        print("[OK] drawingsテーブルにpage_numberカラムを追加しました。")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("[INFO] page_numberカラムはすでに追加されています。")
        else:
            print(f"[ERROR] ALTER TABLE失敗: {e}")
    conn.commit()
    conn.close()
