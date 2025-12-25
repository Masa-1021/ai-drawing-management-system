# ビルドステージ
FROM node:20-alpine AS builder

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci

# アプリケーションコードをコピー
COPY . .

# 環境変数を設定（ビルド時）
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# プロダクションビルド
RUN npm run build

# プロダクションステージ
FROM nginx:alpine

# カスタムnginx設定をコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ビルドしたファイルをnginxのドキュメントルートにコピー
COPY --from=builder /app/dist /usr/share/nginx/html

# ポート80を公開
EXPOSE 80

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# nginxを起動
CMD ["nginx", "-g", "daemon off;"]
