"""
既存の図面データのファイル名を修正するスクリプト

original_filename がUUID形式になっている既存データについて:
- original_filename はそのまま（元の情報が失われているため）
- pdf_filename を original_filename と同じ値に設定（表示用）
"""

import sqlite3
from pathlib import Path

def fix_filenames():
    # データベースパス
    db_path = Path(__file__).parent.parent / "storage" / "database.db"

    if not db_path.exists():
        print(f"Database not found: {db_path}")
        return

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    try:
        # 全図面を取得
        cursor.execute("""
            SELECT id, original_filename, pdf_filename, pdf_path
            FROM drawings
        """)

        drawings = cursor.fetchall()

        print(f"Found {len(drawings)} drawings")

        for drawing_id, original_filename, pdf_filename, pdf_path in drawings:
            print(f"\nDrawing: {drawing_id}")
            print(f"  original_filename: {original_filename}")
            print(f"  pdf_filename: {pdf_filename}")
            print(f"  pdf_path: {pdf_path}")

            # pdf_filename が UUID 形式の場合、original_filename と同じ値に設定
            # （表示用のファイル名として使用）
            if pdf_filename == original_filename:
                print(f"  -> pdf_filename は既に正しい値です")
            else:
                # pdf_filename を original_filename と同じ値に更新
                cursor.execute("""
                    UPDATE drawings
                    SET pdf_filename = ?
                    WHERE id = ?
                """, (original_filename, drawing_id))
                print(f"  -> pdf_filename を '{original_filename}' に更新しました")

        conn.commit()
        print("\n✓ ファイル名の修正が完了しました")

    except Exception as e:
        conn.rollback()
        print(f"\n✗ エラーが発生しました: {e}")
        raise

    finally:
        conn.close()

if __name__ == "__main__":
    fix_filenames()
