"""
設備マスタのサンプルデータ投入スクリプト

実行方法:
    python -m backend.scripts.seed_equipment_data
"""

import sys
from pathlib import Path

# プロジェクトルートをPythonパスに追加
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.app.database import SessionLocal
from backend.app.models.line import Line
from backend.app.models.equipment import Equipment
import uuid


def seed_data():
    """サンプルデータ投入"""
    db = SessionLocal()

    try:
        print("サンプルデータ投入開始...")

        # 既存データをチェック
        existing_lines = db.query(Line).count()
        if existing_lines > 0:
            response = input(
                f"既に{existing_lines}件のラインデータが存在します。続行しますか? (yes/no): "
            )
            if response.lower() != "yes":
                print("キャンセルしました")
                return

        # サンプルライン作成
        print("\n1. ライン作成中...")
        line1 = Line(
            id=str(uuid.uuid4()),
            name="第1製造ライン",
            code="LINE-001",
            description="主力製造ライン",
        )
        line2 = Line(
            id=str(uuid.uuid4()),
            name="第2製造ライン",
            code="LINE-002",
            description="補助製造ライン",
        )
        db.add_all([line1, line2])
        db.flush()
        print(f"   [OK] ライン2件作成: {line1.name}, {line2.name}")

        # サンプル設備作成
        print("\n2. 設備作成中...")
        eq1 = Equipment(
            id=str(uuid.uuid4()),
            line_id=line1.id,
            code="EQ-001",
            name="プレス機A",
            description="主力プレス機",
            manufacturer="株式会社ABC",
            model="PR-1000",
            installed_date="2023-01-15",
        )
        eq2 = Equipment(
            id=str(uuid.uuid4()),
            line_id=line1.id,
            code="EQ-002",
            name="溶接機B",
            description="自動溶接機",
            manufacturer="XYZ製作所",
            model="WD-500",
        )
        eq3 = Equipment(
            id=str(uuid.uuid4()),
            line_id=line2.id,
            code="EQ-003",
            name="組立機C",
            description="自動組立機",
            manufacturer="株式会社DEF",
        )
        db.add_all([eq1, eq2, eq3])
        db.commit()
        print(
            f"   [OK] 設備3件作成: {eq1.code} {eq1.name}, {eq2.code} {eq2.name}, {eq3.code} {eq3.name}"
        )

        print("\nサンプルデータ投入完了!")
        print(f"  - ライン: {line1.name} (ID: {line1.id})")
        print(f"  - ライン: {line2.name} (ID: {line2.id})")
        print(f"  - 設備: {eq1.code} {eq1.name} (ID: {eq1.id})")
        print(f"  - 設備: {eq2.code} {eq2.name} (ID: {eq2.id})")
        print(f"  - 設備: {eq3.code} {eq3.name} (ID: {eq3.id})")

    except Exception as e:
        print(f"\n[ERROR] エラーが発生しました: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
