"""
設定管理マネージャー

config.jsonと.envファイルから設定を読み込み、アプリケーション全体で使用できるようにする
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """環境変数の設定"""

    aws_region: str = Field(default="us-west-2", alias="AWS_REGION")
    aws_access_key_id: str = Field(default="", alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(default="", alias="AWS_SECRET_ACCESS_KEY")
    model_id: str = Field(
        default="anthropic.claude-3-5-sonnet-20241022-v2:0", alias="MODEL_ID"
    )
    database_url: str = Field(
        default="sqlite:///./storage/database.db", alias="DATABASE_URL"
    )
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


class ConfigManager:
    """設定管理クラス"""

    def __init__(self, config_path: Optional[str] = None):
        """
        初期化

        Args:
            config_path: config.jsonのパス。Noneの場合はプロジェクトルートから検索
        """
        # プロジェクトルートを取得
        self.project_root = Path(__file__).parent.parent.parent.parent

        # config.jsonのパス
        if config_path:
            self.config_path = Path(config_path)
        else:
            self.config_path = self.project_root / "config.json"

        # 設定を読み込み
        self.config_data: Dict[str, Any] = self._load_config()
        self.settings = Settings()

    def _load_config(self) -> Dict[str, Any]:
        """
        config.jsonを読み込み

        Returns:
            設定データ

        Raises:
            FileNotFoundError: config.jsonが見つからない場合
            json.JSONDecodeError: JSONのパースに失敗した場合
        """
        if not self.config_path.exists():
            raise FileNotFoundError(
                f"設定ファイルが見つかりません: {self.config_path}"
            )

        with open(self.config_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def get(self, key: str, default: Any = None) -> Any:
        """
        設定値を取得

        Args:
            key: 設定キー
            default: デフォルト値

        Returns:
            設定値
        """
        return self.config_data.get(key, default)

    @property
    def extraction_fields(self) -> List[Dict[str, Any]]:
        """
        抽出フィールドのリストを取得

        Returns:
            [{"name": "図番", "required": True}, ...]
        """
        return self.config_data.get("extractionFields", [])

    @property
    def storage_path(self) -> Path:
        """
        ストレージパスを取得

        Returns:
            Pathオブジェクト
        """
        path_str = self.config_data.get("storagePath", "./storage/drawings/")
        return self.project_root / path_str

    @property
    def lock_timeout(self) -> int:
        """
        ロックタイムアウト秒数を取得

        Returns:
            秒数（デフォルト: 300）
        """
        return self.config_data.get("lockTimeout", 300)

    @property
    def retry_attempts(self) -> int:
        """
        リトライ回数を取得

        Returns:
            リトライ回数（デフォルト: 3）
        """
        return self.config_data.get("retryAttempts", 3)

    @property
    def confidence_threshold(self) -> int:
        """
        信頼度閾値を取得

        Returns:
            閾値（デフォルト: 70）
        """
        return self.config_data.get("confidenceThreshold", 70)

    @property
    def aws_region(self) -> str:
        """AWS リージョン"""
        return self.settings.aws_region

    @property
    def aws_access_key_id(self) -> str:
        """AWS アクセスキーID"""
        return self.settings.aws_access_key_id

    @property
    def aws_secret_access_key(self) -> str:
        """AWS シークレットアクセスキー"""
        return self.settings.aws_secret_access_key

    @property
    def model_id(self) -> str:
        """Claude モデルID"""
        return self.settings.model_id

    @property
    def database_url(self) -> str:
        """データベースURL"""
        return self.settings.database_url

    @property
    def log_level(self) -> str:
        """ログレベル"""
        return self.settings.log_level

    def __repr__(self):
        return f"<ConfigManager(config_path={self.config_path})>"
