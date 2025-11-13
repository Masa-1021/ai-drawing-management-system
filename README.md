# CAD図面管理システム

AI駆動型CAD図面管理システム - AWS Claude Sonnet 4を使用した自動図面解析・分類・管理

## 概要

このシステムは、CAD図面（PDF形式）を自動で解析し、図枠情報を抽出、分類を行い、効率的に管理するローカルWebアプリケーションです。

### 主な機能

- **自動図枠情報抽出**: 図番、タイトル、作成日、承認者などを自動抽出
- **自動分類**: 部品図/ユニット図/組図を自動判定
- **風船情報抽出**: 組図・ユニット図の風船番号、部品名、数量を抽出
- **改訂履歴抽出**: 改訂番号、日付、内容を自動抽出
- **自然言語検索**: 「作成者が〇〇の図面」などの自然言語で検索
- **類似図面検索**: 形状の類似性に基づく図面検索
- **複数ユーザー対応**: 編集ロック機能付きの同時アクセス
- **承認ワークフロー**: 解析結果の確認・編集・承認フロー

## 技術スタック

### バックエンド
- Python 3.11+
- FastAPI
- SQLAlchemy + SQLite
- AWS Bedrock (Claude Sonnet 4)
- PyMuPDF (PDF処理)

### フロントエンド
- React 18 + TypeScript
- Vite
- Zustand (状態管理)
- Tailwind CSS (青/白テーマ)
- PDF.js

## セットアップ

### 前提条件

- Python 3.11以上
- Node.js 18以上
- Poetry
- AWS Bedrockへのアクセス権限

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd cad-drawing-manager
```

### 2. 環境変数の設定

`.env`ファイルを編集して、AWS認証情報を設定してください：

```bash
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
MODEL_ID=anthropic.claude-sonnet-4-20250514
```

### 3. バックエンドのセットアップ

```bash
cd backend
poetry install
```

### 4. フロントエンドのセットアップ

```bash
cd frontend
npm install
```

## 起動方法

### バックエンド起動

```bash
cd backend
poetry run uvicorn app.main:app --reload --port 8000
```

### フロントエンド起動（別ターミナル）

```bash
cd frontend
npm run dev
```

ブラウザで http://localhost:5173 を開いてください。

## 設定

### 抽出フィールドのカスタマイズ

`config.json`を編集して、図枠から抽出するフィールドをカスタマイズできます：

```json
{
  "extractionFields": [
    {"name": "図番", "required": true},
    {"name": "図面タイトル", "required": true},
    ...
  ]
}
```

### プロンプトのカスタマイズ

`backend/prompts/`ディレクトリ内の`.txt`ファイルを編集して、AI解析のプロンプトをカスタマイズできます：

- `extraction.txt`: 図枠情報抽出用
- `classification.txt`: 図面分類用
- `balloon_extraction.txt`: 風船抽出用
- `similarity_search.txt`: 類似検索用
- `natural_language_query.txt`: 自然言語クエリ解析用

## プロジェクト構造

```
cad-drawing-manager/
├── backend/
│   ├── app/
│   │   ├── api/           # API routers
│   │   ├── services/      # Business logic
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── utils/         # Utilities
│   ├── prompts/           # Claude prompt templates
│   └── tests/             # Tests
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── views/         # Page components
│   │   ├── stores/        # Zustand stores
│   │   └── api/           # API client
├── storage/
│   ├── drawings/          # PDF files
│   ├── thumbnails/        # Thumbnails
│   ├── logs/              # Log files
│   └── database.db        # SQLite database
├── config.json            # Configuration
└── .env                   # Environment variables
```

## 開発

### テスト実行

#### バックエンド
```bash
cd backend
poetry run pytest
poetry run pytest --cov=app  # カバレッジ付き
```

#### フロントエンド
```bash
cd frontend
npm run test
```

### コードフォーマット

```bash
# バックエンド
cd backend
poetry run black app/
poetry run ruff check app/

# フロントエンド
cd frontend
npm run lint
```

## ライセンス

MIT

## 作成者

Created with Claude Code
