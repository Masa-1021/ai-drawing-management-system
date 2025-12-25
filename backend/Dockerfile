FROM python:3.11-slim

WORKDIR /app

# システム依存パッケージをインストール
RUN apt-get update && apt-get install -y     curl     && rm -rf /var/lib/apt/lists/*

# Poetryをインストール
RUN pip install --no-cache-dir poetry==1.7.1

# Poetry設定（仮想環境を作成しない）
RUN poetry config virtualenvs.create false

# 依存関係ファイルをコピー
COPY pyproject.toml ./

# package-mode行を削除（Poetry 1.7.1では未対応）
RUN sed -i '/package-mode = false/d' pyproject.toml

# 依存関係をインストール（開発依存関係は除外）
RUN poetry install --no-interaction --no-ansi --no-root --no-dev

# アプリケーションコードをコピー
COPY . .

# ストレージディレクトリを作成
RUN mkdir -p /app/storage/drawings /app/storage/thumbnails /app/storage/logs

# config.jsonへのシンボリックリンクを作成（パス解決の問題を回避）
RUN ln -sf /app/config.json /config.json

# ポート8000を公開
EXPOSE 8000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3     CMD curl -f http://localhost:8000/health || exit 1

# アプリケーション起動
CMD ["uvicorn", "app.main:combined_asgi_app", "--host", "0.0.0.0", "--port", "8000"]
