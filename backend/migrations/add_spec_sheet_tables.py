"""
マイグレーション: 摘要表関連テーブルの追加

実行方法:
    cd backend
    python -m migrations.add_spec_sheet_tables
"""

import sys
from pathlib import Path

# プロジェクトルートをPythonパスに追加
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL


def upgrade():
    """マイグレーション: 摘要表関連テーブルの追加"""
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
    )

    with engine.connect() as conn:
        print("マイグレーション開始: 摘要表関連テーブル")

        # 1. spec_numbers テーブル作成（摘番マスタ）
        print("1. spec_numbers テーブル作成中...")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS spec_numbers (
                id TEXT PRIMARY KEY,
                spec_number TEXT NOT NULL UNIQUE,
                title TEXT,
                model_name TEXT,
                material_code TEXT,
                usage_location TEXT,
                line_name TEXT,
                equipment_name TEXT,
                design_date TEXT,
                designer TEXT,
                reference_drawing TEXT,
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_numbers_spec_number ON spec_numbers(spec_number)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_numbers_line_name ON spec_numbers(line_name)"))
        print("   [OK] spec_numbers テーブル作成完了")

        # 2. spec_sheets テーブル作成（摘要表）
        print("2. spec_sheets テーブル作成中...")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS spec_sheets (
                id TEXT PRIMARY KEY,
                equipment_id TEXT,
                spec_number TEXT NOT NULL,
                equipment_name TEXT,
                line_name TEXT,
                model_name TEXT,
                order_number TEXT,
                created_by TEXT,
                checked_by TEXT,
                designed_by TEXT,
                approved_by TEXT,
                current_revision TEXT,
                file_path TEXT,
                original_filename TEXT,
                status TEXT DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (equipment_id) REFERENCES equipments(id) ON DELETE SET NULL
            )
        """)
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheets_spec_number ON spec_sheets(spec_number)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheets_equipment_id ON spec_sheets(equipment_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheets_line_name ON spec_sheets(line_name)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheets_status ON spec_sheets(status)"))
        print("   [OK] spec_sheets テーブル作成完了")

        # 3. spec_sheet_revisions テーブル作成（改定履歴）
        print("3. spec_sheet_revisions テーブル作成中...")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS spec_sheet_revisions (
                id TEXT PRIMARY KEY,
                spec_sheet_id TEXT NOT NULL,
                revision_symbol TEXT NOT NULL,
                revision_date TEXT,
                description TEXT,
                created_by TEXT,
                checked_by TEXT,
                approved_by TEXT,
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (spec_sheet_id) REFERENCES spec_sheets(id) ON DELETE CASCADE
            )
        """)
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheet_revisions_spec_sheet_id ON spec_sheet_revisions(spec_sheet_id)"))
        print("   [OK] spec_sheet_revisions テーブル作成完了")

        # 4. spec_sheet_items テーブル作成（部品リスト）
        print("4. spec_sheet_items テーブル作成中...")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS spec_sheet_items (
                id TEXT PRIMARY KEY,
                spec_sheet_id TEXT NOT NULL,
                row_number INTEGER NOT NULL,
                part_name TEXT,
                drawing_number TEXT,
                sub_number TEXT,
                item_number TEXT,
                material TEXT,
                heat_treatment TEXT,
                surface_treatment TEXT,
                quantity_per_set INTEGER,
                required_quantity INTEGER,
                revision TEXT,
                part_type TEXT NOT NULL,
                parent_item_id TEXT,
                parent_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (spec_sheet_id) REFERENCES spec_sheets(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_item_id) REFERENCES spec_sheet_items(id) ON DELETE SET NULL
            )
        """)
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheet_items_spec_sheet_id ON spec_sheet_items(spec_sheet_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheet_items_drawing_number ON spec_sheet_items(drawing_number)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheet_items_part_type ON spec_sheet_items(part_type)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheet_items_parent_item_id ON spec_sheet_items(parent_item_id)"))
        print("   [OK] spec_sheet_items テーブル作成完了")

        # 5. drawings テーブルにカラム追加
        print("5. drawings テーブルに spec_sheet_item_id, spec_number カラム追加中...")
        try:
            result = conn.execute(text("PRAGMA table_info(drawings)"))
            columns = [row[1] for row in result]

            if "spec_sheet_item_id" not in columns:
                conn.execute(
                    text(
                        "ALTER TABLE drawings ADD COLUMN spec_sheet_item_id TEXT REFERENCES spec_sheet_items(id) ON DELETE SET NULL"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_drawings_spec_sheet_item_id ON drawings(spec_sheet_item_id)"
                    )
                )
                print("   [OK] spec_sheet_item_id カラム追加完了")
            else:
                print("   [INFO] spec_sheet_item_id カラムは既に存在します")

            if "spec_number" not in columns:
                conn.execute(
                    text(
                        "ALTER TABLE drawings ADD COLUMN spec_number TEXT"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_drawings_spec_number ON drawings(spec_number)"
                    )
                )
                print("   [OK] spec_number カラム追加完了")
            else:
                print("   [INFO] spec_number カラムは既に存在します")

        except Exception as e:
            print(f"   [WARN] カラム追加でエラー: {e}")
            print("   [INFO] カラムが既に存在する可能性があります")

        # 6. 複合インデックス作成（パフォーマンス最適化）
        print("6. 複合インデックス作成中...")
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheets_composite ON spec_sheets(line_name, equipment_name, status)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_spec_sheet_items_drawing ON spec_sheet_items(drawing_number, spec_sheet_id)"))
            print("   [OK] 複合インデックス作成完了")
        except Exception as e:
            print(f"   [WARN] 複合インデックス作成でエラー: {e}")

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
        conn.execute(text("DROP INDEX IF EXISTS idx_drawings_spec_sheet_item_id"))
        conn.execute(text("DROP INDEX IF EXISTS idx_drawings_spec_number"))
        conn.execute(text("DROP INDEX IF EXISTS idx_spec_sheets_composite"))
        conn.execute(text("DROP INDEX IF EXISTS idx_spec_sheet_items_drawing"))

        # SQLiteではALTER TABLE DROP COLUMNが制限されているため警告のみ
        print("[WARN] SQLiteの制約により、spec_sheet_item_id, spec_numberカラムの削除は手動で行う必要があります")

        # テーブル削除（依存関係順）
        conn.execute(text("DROP TABLE IF EXISTS spec_sheet_items"))
        conn.execute(text("DROP TABLE IF EXISTS spec_sheet_revisions"))
        conn.execute(text("DROP TABLE IF EXISTS spec_sheets"))
        conn.execute(text("DROP TABLE IF EXISTS spec_numbers"))

        conn.commit()
        print("ロールバック完了!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="摘要表関連テーブルのマイグレーション")
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
