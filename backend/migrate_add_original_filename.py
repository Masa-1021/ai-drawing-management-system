"""
データベースマイグレーション: original_filename カラムを追加

このスクリプトは以下を実行します:
1. drawings テーブルに original_filename カラムを追加
2. 既存レコードの original_filename を pdf_filename から設定
"""

import sqlite3
from pathlib import Path

def migrate():
    # データベースパス
    db_path = Path(__file__).parent.parent / "storage" / "database.db"

    if not db_path.exists():
        print(f"データベースが見つかりません: {db_path}")
        return

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    try:
        # 1. original_filename カラムが存在するか確認
        cursor.execute("PRAGMA table_info(drawings)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'original_filename' in columns:
            print("✓ original_filename カラムは既に存在します")
        else:
            print("original_filename カラムを追加中...")

            # 2. カラムを追加（デフォルト値は空文字列）
            cursor.execute("""
                ALTER TABLE drawings
                ADD COLUMN original_filename TEXT NOT NULL DEFAULT ''
            """)

            # 3. 既存レコードの original_filename を pdf_filename から設定
            cursor.execute("""
                UPDATE drawings
                SET original_filename = pdf_filename
                WHERE original_filename = ''
            """)

            conn.commit()
            print("✓ original_filename カラムを追加しました")

        # 4. 更新された件数を表示
        cursor.execute("SELECT COUNT(*) FROM drawings")
        count = cursor.fetchone()[0]
        print(f"✓ {count} 件のレコードを処理しました")

        # 5. サンプルデータを表示
        cursor.execute("""
            SELECT id, original_filename, pdf_filename
            FROM drawings
            LIMIT 5
        """)

        print("\n最初の5件のレコード:")
        print("-" * 80)
        for row in cursor.fetchall():
            print(f"ID: {row[0]}")
            print(f"  元のファイル名: {row[1]}")
            print(f"  保存ファイル名: {row[2]}")
            print("-" * 80)

    except Exception as e:
        print(f"エラーが発生しました: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("データベースマイグレーション開始...")
    print("=" * 80)
    migrate()
    print("=" * 80)
    print("マイグレーション完了!")
