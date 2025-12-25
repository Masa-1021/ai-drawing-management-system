"""
Oracle同期用カラム追加マイグレーション

このスクリプトは以下のカラムを追加します：
- lines.synced_from_oracle: OracleDBから同期されたラインかどうか
- lines.last_synced_at: 最後に同期された日時
- equipments.synced_from_oracle: OracleDBから同期された設備かどうか

注意: lines.code と equipments.code は既存のカラムを使用します
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

        # 1. lines テーブルにカラム追加
        print("\n1. lines テーブルにカラム追加中...")

        # 既存カラムの確認
        cursor.execute("PRAGMA table_info(lines)")
        existing_columns = [row[1] for row in cursor.fetchall()]

        if "synced_from_oracle" not in existing_columns:
            cursor.execute("""
                ALTER TABLE lines
                ADD COLUMN synced_from_oracle INTEGER DEFAULT 0
            """)
            print("  - synced_from_oracle カラムを追加しました")
        else:
            print("  - synced_from_oracle カラムは既に存在します")

        if "last_synced_at" not in existing_columns:
            cursor.execute("""
                ALTER TABLE lines
                ADD COLUMN last_synced_at TEXT
            """)
            print("  - last_synced_at カラムを追加しました")
        else:
            print("  - last_synced_at カラムは既に存在します")

        # 2. equipments テーブルにカラム追加
        print("\n2. equipments テーブルにカラム追加中...")

        cursor.execute("PRAGMA table_info(equipments)")
        existing_columns = [row[1] for row in cursor.fetchall()]

        if "synced_from_oracle" not in existing_columns:
            cursor.execute("""
                ALTER TABLE equipments
                ADD COLUMN synced_from_oracle INTEGER DEFAULT 0
            """)
            print("  - synced_from_oracle カラムを追加しました")
        else:
            print("  - synced_from_oracle カラムは既に存在します")

        # 3. インデックス作成
        print("\n3. インデックス作成中...")

        # lines.code にインデックス（既存の場合はスキップ）
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_lines_code
                ON lines(code)
            """)
            print("  - idx_lines_code インデックスを作成しました")
        except sqlite3.Error:
            print("  - idx_lines_code インデックスは既に存在します")

        # equipments.code にインデックス（既存の場合はスキップ）
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_equipments_code
                ON equipments(code)
            """)
            print("  - idx_equipments_code インデックスを作成しました")
        except sqlite3.Error:
            print("  - idx_equipments_code インデックスは既に存在します")

        # コミット
        conn.commit()
        print("\n✓ マイグレーションが正常に完了しました")

        # 4. スキーマ確認
        print("\n4. 更新後のスキーマ確認:")
        print("\n[lines テーブル]")
        cursor.execute("PRAGMA table_info(lines)")
        for row in cursor.fetchall():
            print(f"  - {row[1]} ({row[2]})")

        print("\n[equipments テーブル]")
        cursor.execute("PRAGMA table_info(equipments)")
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


def rollback_migration(db_path: str = "cad_drawings.db"):
    """
    マイグレーションのロールバック（参考用）

    注意: SQLiteはALTER TABLE DROP COLUMNをサポートしていないため、
    ロールバックには再作成が必要です。
    """
    print("警告: SQLiteはカラム削除をサポートしていません")
    print("ロールバックするには、バックアップから復元してください")
    return False


if __name__ == "__main__":
    # コマンドライン引数からDBパスを取得（省略時はデフォルト）
    db_path = sys.argv[1] if len(sys.argv) > 1 else "cad_drawings.db"

    print("=" * 60)
    print("Oracle同期用カラム追加マイグレーション")
    print("=" * 60)

    # マイグレーション実行
    success = run_migration(db_path)

    sys.exit(0 if success else 1)
