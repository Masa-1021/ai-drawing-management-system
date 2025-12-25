"""
設備添付ファイルにsoft_type(ソフト種別)カラム追加マイグレーション

このスクリプトは以下のカラムを追加します：
- equipment_attachments.soft_type: ソフト種別（PLC, GOT, サーボなど）
"""

import sqlite3
import sys
from pathlib import Path


def run_migration(db_path: str = "cad_drawings.db"):
    """マイグレーションを実行"""

    # データベースファイルのパスを確認
    db_file = Path(db_path)
    if not db_file.exists():
        print(f"エラー: データベースファイル '{db_path}' が見つかりません")
        return False

    print(f"データベース: {db_path}")
    print("マイグレーション開始...")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # トランザクション開始
        cursor.execute("BEGIN TRANSACTION")

        # equipment_attachments テーブルにカラム追加
        print("\n1. equipment_attachments テーブルにカラム追加中...")

        # テーブル存在確認
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='equipment_attachments'
        """)
        if not cursor.fetchone():
            print("  - equipment_attachments テーブルが存在しません")
            print("  - テーブルは初回起動時に自動作成されます")
            conn.rollback()
            conn.close()
            return True

        # 既存カラムの確認
        cursor.execute("PRAGMA table_info(equipment_attachments)")
        existing_columns = [row[1] for row in cursor.fetchall()]

        if "soft_type" not in existing_columns:
            cursor.execute("""
                ALTER TABLE equipment_attachments
                ADD COLUMN soft_type TEXT
            """)
            print("  - soft_type カラムを追加しました")
        else:
            print("  - soft_type カラムは既に存在します")

        # コミット
        conn.commit()
        print("\n✓ マイグレーションが正常に完了しました")

        # スキーマ確認
        print("\n2. 更新後のスキーマ確認:")
        print("\n[equipment_attachments テーブル]")
        cursor.execute("PRAGMA table_info(equipment_attachments)")
        for row in cursor.fetchall():
            print(f"  - {row[1]} ({row[2]})")

        cursor.close()
        conn.close()

        return True

    except sqlite3.Error as e:
        print(f"\nエラー: マイグレーション中にエラーが発生しました: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False
    except Exception as e:
        print(f"\n予期しないエラー: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False


if __name__ == "__main__":
    # コマンドライン引数からDBパスを取得（省略時はデフォルト）
    db_path = sys.argv[1] if len(sys.argv) > 1 else "cad_drawings.db"

    print("=" * 60)
    print("ソフト種別(soft_type)カラム追加マイグレーション")
    print("=" * 60)

    # マイグレーション実行
    success = run_migration(db_path)

    sys.exit(0 if success else 1)
