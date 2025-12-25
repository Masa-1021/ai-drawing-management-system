# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

AI駆動型CAD図面管理システム。AWS Bedrock (Claude Sonnet 4.5)を使用してPDF形式のCAD図面を自動解析し、図枠情報の抽出、分類、管理を行うローカルWebアプリケーション。

### 主要機能
- 図枠情報の自動抽出（図番、タイトル、作成日、承認者など）
- 図面の自動分類（部品図/ユニット図/組図）
- 風船情報・改訂履歴の抽出
- 自然言語検索・類似図面検索
- 編集ロック機能付き複数ユーザー対応
- WebSocket経由のリアルタイム進捗通知
- **OracleDB連携**: 既存生産管理システムからライン・設備情報をインポート
- **複数選択削除**: チェックボックスによるライン・設備の一括削除

## 技術スタック

- **バックエンド**: Python 3.11+, FastAPI, SQLAlchemy (SQLite), AWS Bedrock, PyMuPDF, python-oracledb
- **フロントエンド**: React 18, TypeScript, Vite, Zustand, Tailwind CSS, MUI, PDF.js
- **通信**: RESTful API, Socket.IO (WebSocket)
- **外部DB**: Oracle Database 19c (生産管理システム連携)
- **コンテナ化**: Docker Compose (開発・本番環境対応)

## 開発環境セットアップ

### Docker環境（推奨）

```bash
# 環境変数設定
cp .env.docker .env
# .envファイルを編集してAWS認証情報を設定

# 開発環境起動（ホットリロード有効）
wsl bash -c "cd /mnt/c/Users/<username>/Apps/cad-drawing-manager && docker compose -f docker-compose.dev.yml up -d"

# ログ確認
wsl bash -c "docker logs cad-backend-dev -f"
wsl bash -c "docker logs cad-frontend-dev -f"

# 停止
wsl bash -c "cd /mnt/c/Users/<username>/Apps/cad-drawing-manager && docker compose -f docker-compose.dev.yml down"
```

アクセスURL:
- フロントエンド: http://localhost:5175
- バックエンドAPI: http://localhost:8000
- API ドキュメント: http://localhost:8000/docs

### ローカル環境（非Docker）

```bash
# バックエンド
cd backend
poetry install
poetry run uvicorn app.main:app --reload --port 8000

# フロントエンド（別ターミナル）
cd frontend
npm install
npm run dev
```

## 必須コマンド

### テスト

```bash
# バックエンド単体テスト
cd backend
poetry run pytest
poetry run pytest --cov=app  # カバレッジ付き
poetry run pytest tests/test_specific.py  # 特定テスト実行

# フロントエンドE2Eテスト（Playwright）
cd frontend
npx playwright test  # 全テスト実行
npx playwright test tests/e2e/specific.spec.ts  # 特定テスト
npx playwright test --headed  # ブラウザ表示
npx playwright show-report  # レポート表示
```

### リント・型チェック

```bash
# バックエンド
cd backend
poetry run black app/  # フォーマット
poetry run ruff check app/  # リント

# フロントエンド
cd frontend
npm run lint  # ESLint
npm run typecheck  # TypeScript型チェック（tsc --noEmit）
```

### ビルド

```bash
# フロントエンド
cd frontend
npm run build  # 本番ビルド → dist/
npm run preview  # ビルド結果のプレビュー
```

### マイグレーション

```bash
# バックエンド - マイグレーションスクリプト実行
cd backend
poetry run python migrations/add_equipment_tables.py
poetry run python migrations/add_oracle_sync_columns.py
poetry run python migrations/add_spec_sheet_tables.py
```

## アーキテクチャ

### バックエンド構造

**レイヤー構成**:
- `app/api/v1/`: APIルーター（エンドポイント定義）
  - `drawings.py`: 図面CRUD、承認、削除
  - `search.py`: 自然言語検索、類似検索
  - `locks.py`: 編集ロック取得・解放
  - `lines.py`: ライン CRUD、削除
  - `equipments.py`: 設備 CRUD、削除
  - `oracle.py`: OracleDB連携（ライン取得、設備取得、インポート）
- `app/services/`: ビジネスロジック層
  - `ai_analysis_service.py`: Claude APIによる図面解析の中心
  - `drawing_service.py`: 図面CRUD操作
  - `search_service.py`: 検索機能（自然言語、類似度）
  - `claude_client.py`: AWS Bedrock Claude APIクライアント
  - `pdf_converter.py`: PDF→画像変換（PyMuPDF）
  - `lock_manager.py`: 編集ロック管理
  - `websocket_manager.py`: Socket.IO管理（進捗通知）
  - `oracle_service.py`: OracleDB接続プール管理、クエリ実行
- `app/models/`: SQLAlchemyモデル（DB定義）
  - `line.py`: ラインモデル（Oracle同期情報含む）
  - `equipment.py`: 設備モデル（Oracle同期情報含む）
- `app/schemas/`: Pydanticスキーマ（バリデーション・シリアライズ）
  - `oracle.py`: OracleDB連携用スキーマ
  - `line.py`: ラインスキーマ
  - `equipment.py`: 設備スキーマ
- `app/utils/`: ユーティリティ（設定、プロンプト管理、ロギング）
  - `oracle_config.py`: OracleDB接続設定（BaseSettings）

**重要な設定ファイル**:
- `config.json`: 抽出フィールド定義、信頼度閾値、ロックタイムアウトなど
- `backend/prompts/*.txt`: Claude APIに送信するプロンプトテンプレート
  - `extraction.txt`: 図枠情報抽出
  - `classification.txt`: 図面分類
  - `balloon_extraction.txt`: 風船抽出
  - `rotation_detection.txt`: 回転検出
  - `natural_language_query.txt`: 自然言語クエリ解析

**AIワークフロー**:
1. PDFアップロード → PDF→PNG変換（`pdf_converter.py`）
2. 回転検出 → 必要に応じて補正
3. 分類（部品図/組図/ユニット図）→ `ai_analysis_service.classify_drawing()`
4. 図枠情報抽出 → `ai_analysis_service.analyze_drawing()`
5. 風船抽出（組図・ユニット図のみ）→ `ai_analysis_service.extract_balloons()`
6. WebSocketで進捗を通知 → `websocket_manager.emit()`
7. DB保存（`drawing_service.py`）

### フロントエンド構造

**ページ**:
- `/upload` (UploadPage.tsx): ファイルアップロード、進捗表示（WebSocket接続）
- `/list` (ListPage.tsx): 図面一覧、サムネイル表示、承認・削除
- `/edit/:id` (EditPage.tsx): 図面編集、編集ロック取得、PDF閲覧、風船クリック
- `/search` (SearchPage.tsx): 自然言語検索、類似検索
- `/equipment` (EquipmentListPage.tsx): ライン一覧、OracleDBインポート、複数選択削除
- `/equipment/:id` (EquipmentDetailPage.tsx): 設備詳細（左ペイン：設備ツリー、右ペイン：詳細タブ）

**主要コンポーネント**:
- `OracleLineImportDialog.tsx`: OracleDBからライン・設備をインポートするダイアログ
- `EquipmentTree.tsx`: ライン>設備の階層ツリー表示、複数選択削除対応
- `EquipmentDetailPanel.tsx`: 設備詳細タブビュー（基本情報、図面一覧）
- `DrawingDataGrid.tsx`: 設備に紐づく図面一覧（MUI DataGrid）

**状態管理**: Zustand + React Query
- Zustand: グローバル状態（認証など）
- React Query: サーバー状態（キャッシュ、リフェッチ）

**API通信**:
- `src/api/client.ts`: Axios設定（baseURL: `/api`）
- `src/api/*.ts`: APIクライアント関数
  - `drawings.ts`: 図面CRUD、承認、削除
  - `search.ts`: 検索API
  - `locks.ts`: 編集ロック
  - `equipments.ts`: 設備CRUD、削除
  - `lines.ts`: ラインCRUD、削除
  - `oracle.ts`: OracleDB連携（ライン取得、設備取得、インポート）
- Viteプロキシ設定（`vite.config.ts`）:
  - `/api` → `http://backend:8000` (Docker環境)
  - `/storage` → 静的ファイル配信
  - `/ws` → WebSocket

**重要な注意事項**:
- **URLパス**: APIクライアントは`/v1/...`を使用（baseURLが`/api`を追加するため）
- **サムネイル**: `/storage/thumbnails/...`でアクセス（Viteプロキシ経由）
- **Docker環境**: 相対パスを使用（`.env`で`VITE_API_BASE_URL=/api`）

### データベーススキーマ

**主要テーブル**:
- `drawings`: 図面メタデータ（PDF情報、分類、抽出結果、承認状態）
- `balloons`: 風船情報（図面ID、番号、部品名、数量、座標）
- `revisions`: 改訂履歴
- `lines`: ライン情報（`synced_from_oracle`, `last_synced_at`列でOracle同期管理）
- `equipments`: 設備情報（`synced_from_oracle`, `last_synced_at`列でOracle同期管理）
- `locks`: 編集ロック（ユーザー、図面ID、タイムスタンプ）

ストレージパス（`storage/`）:
- `drawings/`: PDF原本
- `thumbnails/`: サムネイル画像（PNG）
- `logs/`: アプリケーションログ
- `database.db`: SQLiteデータベース

## Docker環境の特記事項

### 開発環境 (docker-compose.dev.yml)
- バックエンド: ボリュームマウントで`./backend:/app`、Uvicorn `--reload`有効
- フロントエンド: ボリュームマウントで`./frontend:/app`、Vite HMR有効
- ポート: 5175 (フロント), 8000 (バック)
- ネットワーク: `cad-network` (コンテナ間通信に`backend:8000`使用)

### storage_path の計算
Docker環境では `Path(__file__).parent.parent / "storage"` を使用:
- `__file__` = `/app/app/main.py`
- `.parent.parent` = `/app`
- 結果: `/app/storage` (docker-compose.ymlで`./storage:/app/storage`マウント)

### Viteプロキシ設定
環境変数で柔軟に対応:
```typescript
'/api': {
  target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
  changeOrigin: true
}
```

Docker環境では`VITE_API_PROXY_TARGET=http://backend:8000`を設定。

## よくある問題

### AWS認証エラー
`.env`ファイルに正しいAWS認証情報が設定されているか確認:
```bash
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0
```

### OracleDB接続エラー
`backend/.env`にOracle接続情報が正しく設定されているか確認:
```bash
ORACLE_HOST=your_oracle_host
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=your_service_name
ORACLE_USER=your_user
ORACLE_PASSWORD=your_password
ORACLE_STA_NO1=your_sta_no1
ORACLE_POOL_MIN=2
ORACLE_POOL_MAX=10
```

**トラブルシューティング**:
- `python-oracledb`ライブラリがインストールされているか確認（`poetry show oracledb`）
- Oracle 19cとの接続性を確認（`telnet <oracle_host> 1521`）
- アプリケーション起動時のログで"Oracle service initialization failed"エラーがないか確認

### Docker環境でのAPI接続エラー
- フロントエンドの`.env`で`VITE_API_BASE_URL=/api`を確認
- Viteプロキシが正しく`backend:8000`に転送しているか確認
- `docker logs cad-backend-dev`でバックエンドログを確認

### サムネイル404エラー
- `backend/app/main.py`で`storage_path`が正しく計算されているか確認
- Docker環境では`.parent.parent`を使用（`.parent.parent.parent`ではない）
- Vite設定で`/storage`プロキシが定義されているか確認

### ポート使用中エラー
```bash
# Windows
netstat -ano | findstr "5175"
taskkill /PID <PID> /F
```

## カスタマイズ

### 抽出フィールドの追加
`config.json`の`extractionFields`配列に追加:
```json
{"name": "新フィールド名", "required": false, "location": "図面内位置"}
```

### AIプロンプトの調整
`backend/prompts/*.txt`を編集してClaude APIへの指示を変更。プロンプトは`PromptManager`クラスで管理され、`{field_list}`などのプレースホルダーが実行時に置換される。

### UIテーマ
Tailwind CSSの三菱電機カラーパレット（`tailwind.config.js`で定義）:
- `me-blue`: プライマリカラー
- `me-red`: アクセントカラー
- `me-grey-*`: グレースケール

MUI Themeは`@mui/material`のデフォルトテーマを使用。

## OracleDB連携機能

### 概要
既存の生産管理システム（Oracle Database 19c）からライン・設備情報をインポートする機能。

### 対象テーブル
- **HF1SEM01**: ライン情報（STA_NO2=ラインコード、LINE_NAME=ライン名）
- **HF1SFM01**: 設備情報（STA_NO3=設備コード、ST_NAME=設備名）

### 実装詳細

**バックエンド**:
1. `oracle_service.py`: 接続プール管理（min=2, max=10）、Tenacyによるリトライ（3回、指数バックオフ）
2. `oracle.py` APIエンドポイント:
   - `GET /api/v1/oracle/health`: OracleDB接続ヘルスチェック
   - `GET /api/v1/oracle/lines`: ライン一覧取得（WHERE STA_NO1={ORACLE_STA_NO1}）
   - `GET /api/v1/oracle/equipments?line_code={code}`: 指定ラインの設備一覧取得
   - `POST /api/v1/oracle/import`: ライン・設備をSQLiteにインポート（重複チェック、トランザクション）
3. `migrations/add_oracle_sync_columns.py`: `lines`と`equipments`テーブルに同期メタデータ列を追加

**フロントエンド**:
1. `OracleLineImportDialog.tsx`: ライン選択ダイアログ（検索フィルタ、設備プレビュー）
2. `useOracleImport.ts`: React Queryによるデータフェッチ、インポート処理
3. `EquipmentListPage.tsx`: "OracleDBから新規ライン登録"ボタン

### 使用方法
1. 設備一覧ページ（`/equipment`）で"OracleDBから新規ライン登録"ボタンをクリック
2. ダイアログでライン一覧が表示される（検索フィルタ可能）
3. ラインを選択すると、設備プレビューが表示される
4. "登録"ボタンでライン・設備をSQLiteに一括登録
5. 登録成功後、設備詳細ページ（`/equipment/{line_id}`）に遷移

## 削除機能

### 複数選択削除機能
チェックボックスによる複数ライン・設備の一括削除に対応。

**EquipmentListPage（ライン削除）**:
- ページヘッダーに"すべて選択"チェックボックスと削除ボタン
- 各ラインカードの左側にチェックボックス
- 選択数を表示（例: "選択を削除 (3)"）
- 削除確認ダイアログで警告メッセージ表示
- `Promise.all`で複数ラインを並列削除

**EquipmentTree（設備削除）**:
- ツリーヘッダーに"すべて選択"チェックボックスと削除ボタン
- 各設備項目の左側にチェックボックス
- indeterminateプロパティで部分選択状態を表現
- `Promise.all`で複数設備を並列削除
- 削除後は自動的にリストを再読み込み

**注意事項**:
- ライン削除時は配下の設備も連鎖削除される
- 削除操作は取り消せない
- チェックボックスのクリックは`stopPropagation()`でイベントバブリング防止
