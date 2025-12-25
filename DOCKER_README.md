# Docker Compose セットアップガイド

CAD図面管理システムをDocker Composeで起動するためのガイドです。

## 前提条件

- Docker Desktop for Windows（WSL2バックエンド）
- WSL2環境（Ubuntu等）

## ファイル構成

```
.
├── docker-compose.yml          # 本番環境用
├── docker-compose.dev.yml      # 開発環境用
├── .env.docker                 # Docker環境変数（コピーして使用）
├── backend/
│   ├── Dockerfile             # バックエンド用Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile             # フロントエンド本番用
│   ├── Dockerfile.dev         # フロントエンド開発用
│   ├── nginx.conf             # Nginx設定
│   └── .dockerignore
└── storage/                   # データ永続化用（ボリュームマウント）
```

## セットアップ手順

### 1. 環境変数の設定

`.env.docker`をコピーして`.env`を作成し、AWS認証情報を設定：

```bash
cp .env.docker .env
```

`.env`ファイルを編集：
```bash
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_actual_access_key
AWS_SECRET_ACCESS_KEY=your_actual_secret_key
MODEL_ID=anthropic.claude-sonnet-4-20250514
LOG_LEVEL=INFO
```

### 2. ストレージディレクトリの作成

```bash
mkdir -p storage/drawings storage/thumbnails storage/logs
```

## 起動方法

### 開発環境（推奨）

ホットリロード対応で、コード変更が即座に反映されます。

```bash
docker-compose -f docker-compose.dev.yml up -d
```

アクセスURL：
- フロントエンド: `http://localhost:5175`
- バックエンドAPI: `http://localhost:8000`
- API ドキュメント: `http://localhost:8000/docs`

### 本番環境（プロファイル指定）

最適化されたビルドで起動します。

```bash
# バックエンド + フロントエンド本番環境
docker-compose --profile prod up -d
```

アクセスURL：
- フロントエンド: `http://localhost` (ポート80)
- バックエンドAPI: `http://localhost:8000`

## コマンド一覧

### ログ確認

```bash
# 全サービスのログ
docker-compose -f docker-compose.dev.yml logs -f

# バックエンドのみ
docker-compose -f docker-compose.dev.yml logs -f backend

# フロントエンドのみ
docker-compose -f docker-compose.dev.yml logs -f frontend
```

### コンテナ状態確認

```bash
docker-compose -f docker-compose.dev.yml ps
```

### 停止

```bash
# 開発環境
docker-compose -f docker-compose.dev.yml down

# 本番環境
docker-compose --profile prod down
```

### 再ビルド

コードやDockerfileを変更した場合：

```bash
# 開発環境
docker-compose -f docker-compose.dev.yml up -d --build

# 本番環境
docker-compose --profile prod up -d --build
```

### データ削除（完全クリーン）

```bash
# コンテナとボリュームを削除
docker-compose -f docker-compose.dev.yml down -v

# イメージも削除
docker-compose -f docker-compose.dev.yml down --rmi all -v
```

## トラブルシューティング

### ポートが使用中

既に5175や8000ポートが使用されている場合：

```bash
# Windowsで使用中のポートを確認
netstat -ano | findstr "5175"
netstat -ano | findstr "8000"

# 不要なプロセスを停止
taskkill /PID <PID> /F
```

### 依存関係のインストールエラー

```bash
# コンテナを削除して再ビルド
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d
```

### データベースの初期化

```bash
# storageディレクトリ内のデータベースを削除
rm storage/database.db*
docker-compose -f docker-compose.dev.yml restart backend
```

### AWS認証エラー

`.env`ファイルのAWS認証情報が正しいか確認：

```bash
# コンテナ内で確認
docker-compose -f docker-compose.dev.yml exec backend env | grep AWS
```

## ヘルスチェック

各サービスのヘルスチェックエンドポイント：

- バックエンド: `http://localhost:8000/api/v1/health`
- フロントエンド（本番）: `http://localhost/`

```bash
# ヘルスチェック状態を確認
docker-compose -f docker-compose.dev.yml ps
```

## 外部PCからのアクセス

WSLのIPアドレスを確認：

```bash
# WSL内で実行
ip addr show eth0 | grep inet
```

外部PCから以下のURLでアクセス：
- `http://<WSL_IP>:5175` (開発環境フロントエンド)
- `http://<WSL_IP>:8000` (バックエンドAPI)

## 本番デプロイ

本番環境では以下の点に注意：

1. **環境変数の管理**: `.env`ファイルをGitにコミットしない
2. **HTTPSの設定**: リバースプロキシ（Nginx/Traefik）でSSL/TLS設定
3. **ログ管理**: ログローテーション設定
4. **バックアップ**: `storage/`ディレクトリの定期バックアップ

## 開発フロー

1. コードを編集（ホストマシン上）
2. 変更が自動的にコンテナに反映（ボリュームマウント）
3. ブラウザで動作確認
4. 必要に応じてコンテナ再起動

```bash
# バックエンドのみ再起動
docker-compose -f docker-compose.dev.yml restart backend

# フロントエンドのみ再起動
docker-compose -f docker-compose.dev.yml restart frontend
```
