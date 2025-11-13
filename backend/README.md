# CAD Drawing Manager - Backend

AI駆動型CAD図面管理システムのバックエンド

## セットアップ

```bash
# 依存関係のインストール
poetry install

# 環境変数の設定
# プロジェクトルートに .env ファイルを作成してください

# 起動
poetry run uvicorn app.main:app --reload --port 8000
```

## 開発

```bash
# テスト実行
poetry run pytest

# カバレッジ
poetry run pytest --cov=app

# コードフォーマット
poetry run black app/
poetry run ruff check app/

# 型チェック
poetry run mypy app/
```
