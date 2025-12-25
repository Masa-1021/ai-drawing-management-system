"""
設備添付ファイルテーブルを追加するマイグレーション
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, Base
from app.models.equipment_attachment import EquipmentAttachment


def migrate():
    """マイグレーション実行"""
    print("Starting migration: add_equipment_attachments")

    with engine.connect() as conn:
        # テーブルが存在するか確認
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='equipment_attachments'")
        )
        if result.fetchone():
            print("Table 'equipment_attachments' already exists, skipping...")
            return

    # テーブル作成
    EquipmentAttachment.__table__.create(engine, checkfirst=True)
    print("Created table: equipment_attachments")

    # 添付ファイル用ストレージディレクトリ作成
    storage_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "attachments")
    os.makedirs(storage_path, exist_ok=True)
    print(f"Created storage directory: {storage_path}")

    print("Migration completed successfully!")


if __name__ == "__main__":
    migrate()
