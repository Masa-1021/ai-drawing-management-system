"""spec_sheet_items に web_link カラムを追加"""
import sqlite3
from pathlib import Path


def migrate():
    """web_link カラムを追加するマイグレーション"""
    db_path = Path(__file__).parent.parent / "storage" / "database.db"

    if not db_path.exists():
        print(f"データベースが見つかりません: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # カラムが存在するか確認
        cursor.execute("PRAGMA table_info(spec_sheet_items)")
        columns = [col[1] for col in cursor.fetchall()]

        if "web_link" not in columns:
            cursor.execute("""
                ALTER TABLE spec_sheet_items
                ADD COLUMN web_link VARCHAR(2048)
            """)
            conn.commit()
            print("web_link カラムを追加しました")
        else:
            print("web_link カラムは既に存在します")

    except Exception as e:
        print(f"マイグレーションエラー: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
