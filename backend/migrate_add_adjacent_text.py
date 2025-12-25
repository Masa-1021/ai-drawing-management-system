import sqlite3
import os

# データベースファイルのパス
db_path = os.path.join(os.path.dirname(__file__), '..', 'storage', 'database.db')

# データベースに接続
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # カラムが存在するか確認
    cursor.execute("PRAGMA table_info(balloons)")
    columns = [column[1] for column in cursor.fetchall()]

    # adjacent_textカラムを追加
    if 'adjacent_text' not in columns:
        cursor.execute("ALTER TABLE balloons ADD COLUMN adjacent_text TEXT")
        print("[OK] adjacent_text カラムを追加しました")
    else:
        print("[INFO] adjacent_text カラムは既に存在します")

    # adjacent_positionカラムを追加
    if 'adjacent_position' not in columns:
        cursor.execute("ALTER TABLE balloons ADD COLUMN adjacent_position TEXT")
        print("[OK] adjacent_position カラムを追加しました")
    else:
        print("[INFO] adjacent_position カラムは既に存在します")

    # 変更をコミット
    conn.commit()
    print("\n[OK] マイグレーション完了")

    # 更新後のテーブル構造を表示
    cursor.execute("PRAGMA table_info(balloons)")
    print("\n現在のballoonsテーブル構造:")
    for column in cursor.fetchall():
        print(f"  - {column[1]} ({column[2]})")

except Exception as e:
    print(f"[ERROR] エラーが発生しました: {e}")
    conn.rollback()
finally:
    conn.close()
