"""
マイグレーション: 設備関連テーブルの追加

実行方法:
    python -m backend.migrations.add_equipment_tables
"""

import sys
from pathlib import Path

# プロジェクトルートをPythonパスに追加
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text
from backend.app.database import DATABASE_URL


def upgrade():
    """マイグレーション: 設備関連テーブルの追加"""
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
    )

    with engine.connect() as conn:
        print("マイグレーション開始...")

        # lines テーブル作成
        print("1. lines テーブル作成中...")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS lines (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                code TEXT UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_lines_name ON lines(name)"))
        print("   [OK] lines テーブル作成完了")

        # equipments テーブル作成
        print("2. equipments テーブル作成中...")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS equipments (
                id TEXT PRIMARY KEY,
                line_id TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                description TEXT,
                manufacturer TEXT,
                model TEXT,
                installed_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (line_id) REFERENCES lines(id) ON DELETE CASCADE
            )
        """)
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_equipments_line_id ON equipments(line_id)"
            )
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS idx_equipments_code ON equipments(code)")
        )
        print("   [OK] equipments テーブル作成完了")

        # drawings テーブルにカラム追加
        print("3. drawings テーブルに equipment_id カラム追加中...")
        try:
            # カラムが既に存在するかチェック
            result = conn.execute(text("PRAGMA table_info(drawings)"))
            columns = [row[1] for row in result]

            if "equipment_id" not in columns:
                conn.execute(
                    text(
                        "ALTER TABLE drawings ADD COLUMN equipment_id TEXT REFERENCES equipments(id) ON DELETE SET NULL"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_drawings_equipment_id ON drawings(equipment_id)"
                    )
                )
                print("   [OK] equipment_id カラム追加完了")
            else:
                print("   [INFO] equipment_id カラムは既に存在します")
        except Exception as e:
            print(f"   [WARN] カラム追加でエラー: {e}")
            print("   [INFO] カラムが既に存在する可能性があります")

        conn.commit()
        print("\nマイグレーション完了!")


def downgrade():
    """ロールバック"""
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
    )

    with engine.connect() as conn:
        print("ロールバック開始...")

        # インデックス削除
        conn.execute(text("DROP INDEX IF EXISTS idx_drawings_equipment_id"))

        # SQLiteではALTER TABLE DROP COLUMNが制限されているため警告のみ
        print("[WARN] SQLiteの制約により、equipment_idカラムの削除は手動で行う必要があります")

        # テーブル削除
        conn.execute(text("DROP TABLE IF EXISTS equipments"))
        conn.execute(text("DROP TABLE IF EXISTS lines"))

        conn.commit()
        print("ロールバック完了!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="設備関連テーブルのマイグレーション")
    parser.add_argument(
        "--downgrade", action="store_true", help="ロールバックを実行"
    )

    args = parser.parse_args()

    if args.downgrade:
        response = input("本当にロールバックしますか? (yes/no): ")
        if response.lower() == "yes":
            downgrade()
        else:
            print("ロールバックをキャンセルしました")
    else:
        upgrade()
