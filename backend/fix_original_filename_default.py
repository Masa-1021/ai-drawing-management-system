"""
Fix original_filename DEFAULT constraint

SQLiteでは ALTER COLUMN ができないため、テーブルを再作成する必要があります。
"""

import sqlite3
from pathlib import Path

def fix_default():
    db_path = Path(__file__).parent.parent / "storage" / "database.db"

    if not db_path.exists():
        print(f"Database not found: {db_path}")
        return

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    try:
        print("1. Creating temporary table...")
        # 一時テーブルを作成（original_filename に DEFAULT なし）
        cursor.execute("""
            CREATE TABLE drawings_temp (
                id VARCHAR PRIMARY KEY,
                pdf_filename VARCHAR NOT NULL,
                pdf_path VARCHAR NOT NULL,
                page_number INTEGER NOT NULL,
                thumbnail_path VARCHAR,
                status VARCHAR NOT NULL,
                classification VARCHAR,
                classification_confidence FLOAT,
                classification_reason TEXT,
                summary TEXT,
                shape_features JSON,
                upload_date TIMESTAMP,
                approved_date TIMESTAMP,
                created_by VARCHAR NOT NULL,
                updated_at TIMESTAMP,
                original_filename TEXT NOT NULL
            )
        """)

        print("2. Copying data...")
        # データをコピー
        cursor.execute("""
            INSERT INTO drawings_temp
            SELECT id, pdf_filename, pdf_path, page_number, thumbnail_path,
                   status, classification, classification_confidence, classification_reason,
                   summary, shape_features, upload_date, approved_date, created_by,
                   updated_at, original_filename
            FROM drawings
        """)

        print("3. Dropping old table...")
        # 古いテーブルを削除
        cursor.execute("DROP TABLE drawings")

        print("4. Renaming temp table...")
        # 一時テーブルをリネーム
        cursor.execute("ALTER TABLE drawings_temp RENAME TO drawings")

        conn.commit()
        print("\n✓ DEFAULT constraint removed successfully!")

        # 確認
        cursor.execute("PRAGMA table_info(drawings)")
        for col in cursor.fetchall():
            if col[1] == 'original_filename':
                print(f"\noriginal_filename column: {col}")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("="*80)
    print("Fixing original_filename DEFAULT constraint...")
    print("="*80)
    fix_default()
    print("="*80)
    print("Done!")
