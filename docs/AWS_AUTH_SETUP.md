# AWS認証設定ガイド

このドキュメントでは、CAD図面管理システムのAWS Bedrock認証設定方法を説明します。

## 認証方式

2つの認証方式をサポートしています：

| 方式 | メリット | デメリット |
|------|---------|-----------|
| AWS SSO/プロファイル | 認証情報の自動更新、セキュア | 初期設定が必要 |
| 一時認証情報 | 即座に使用可能 | 8-12時間で期限切れ、手動更新が必要 |

---

## 方式1: AWS SSO/プロファイル（推奨）

### Step 1: AWS CLI v2をインストール

1. [AWS CLI v2 インストーラ](https://awscli.amazonaws.com/AWSCLIV2.msi) をダウンロード
2. インストーラを実行
3. コマンドプロンプトを再起動
4. インストール確認:
   ```cmd
   aws --version
   ```

### Step 2: SSOプロファイルを設定

コマンドプロンプトで以下を実行：

```cmd
aws configure sso
```

プロンプトが表示されたら以下を入力：

| 項目 | 入力値 |
|------|--------|
| SSO session name | `my-sso` |
| SSO start URL | `https://your-company.awsapps.com/start`（Access PortalのURL） |
| SSO region | `ap-northeast-1`（またはSSOのリージョン） |
| CLI default client Region | `us-west-2` |
| CLI profile name | `bedrock-sso` |

アカウントとロールの選択画面が表示されたら、Bedrockアクセス権限を持つロールを選択してください。

### Step 3: .envファイルを設定

```bash
# AWS Bedrock設定
AWS_REGION=us-west-2
MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0

# AWS SSO/プロファイル
AWS_PROFILE=bedrock-sso
```

### Step 4: SSOにログイン

```cmd
aws sso login --profile bedrock-sso
```

ブラウザが自動的に開きます。認証を完了してください。

### Step 5: Dockerコンテナを再起動

```bash
wsl bash -c "cd /mnt/c/Users/<username>/Apps/cad-drawing-manager && docker compose -f docker-compose.dev.yml down && docker compose -f docker-compose.dev.yml up -d"
```

### 認証情報の更新

SSOセッションは通常8-12時間有効です。期限切れ時は再度ログイン：

```cmd
aws sso login --profile bedrock-sso
```

Dockerコンテナの再起動は不要です（認証情報は自動的に更新されます）。

---

## 方式2: 一時認証情報（Access Portal）

### Step 1: Access Portalから認証情報を取得

1. AWS Access Portal（`https://your-company.awsapps.com/start`）にログイン
2. 使用するアカウントの「Command line or programmatic access」をクリック
3. 「Option 1」のクレデンシャルをコピー

### Step 2: .envファイルを更新

```bash
# AWS Bedrock設定
AWS_REGION=us-west-2
MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0

# 一時認証情報
AWS_ACCESS_KEY_ID=ASIA...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...

# AWS_PROFILE はコメントアウト
# AWS_PROFILE=bedrock-sso
```

### Step 3: Dockerコンテナを再起動

```bash
wsl bash -c "cd /mnt/c/Users/<username>/Apps/cad-drawing-manager && docker compose -f docker-compose.dev.yml restart backend"
```

### 認証情報の更新

一時認証情報は通常1-12時間で期限切れになります。期限切れ時は：

1. Access Portalから新しい認証情報を取得
2. `.env`ファイルを更新
3. Dockerコンテナを再起動

---

## トラブルシューティング

### 認証エラーが発生する場合

1. **認証情報の確認**
   ```cmd
   aws sts get-caller-identity --profile bedrock-sso
   ```

2. **ログの確認**
   ```bash
   wsl bash -c "docker logs cad-backend-dev --tail 50"
   ```

3. **SSOセッションの更新**
   ```cmd
   aws sso login --profile bedrock-sso
   ```

### Docker環境でプロファイルが認識されない場合

`~/.aws` ディレクトリがDockerコンテナにマウントされているか確認：

```yaml
# docker-compose.dev.yml
volumes:
  - ~/.aws:/root/.aws:ro
```

### ExpiredTokenException エラー

一時認証情報が期限切れです。新しい認証情報を取得して`.env`を更新してください。

---

## 認証期限切れの自動通知

アプリケーションはAWS認証の期限切れを自動検知し、フロントエンドで通知を表示します。

### 動作フロー

1. AI解析時にAWS認証エラーが発生
2. バックエンドが`AWS_AUTH_EXPIRED`エラーコードを返す
3. フロントエンドがエラーを検知し、トースト通知を表示
4. ユーザーがコマンドプロンプトでSSO再ログインを実行

### 再ログインコマンド

```cmd
aws sso login --profile <プロファイル名>
```

例: `aws sso login --profile BootcampDeveloper-096000968966`

### 通知表示

- 画面右上に赤色のトースト通知が10秒間表示されます
- メッセージ: 「AWS認証の有効期限が切れました。コマンドプロンプトで 'aws sso login --profile <profile>' を実行してください。」

---

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| `.env` | 環境変数設定 |
| `docker-compose.dev.yml` | Docker開発環境設定 |
| `backend/app/services/claude_client.py` | AWS認証処理、エラー検知 |
| `frontend/src/api/client.ts` | APIクライアント、エラー通知イベント |
| `frontend/src/App.tsx` | グローバル通知リスナー |
| `~/.aws/config` | AWS CLIプロファイル設定 |
| `~/.aws/sso/cache/` | SSOキャッシュ |
