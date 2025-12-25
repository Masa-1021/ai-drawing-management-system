"""
Claude API クライアント

AWS Bedrock Runtimeを使用してClaude APIを呼び出す
リトライ、エラーハンドリング、タイムアウト処理を実装
"""

import json
import logging
import base64
from typing import Dict, List, Any, Optional
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
import boto3
from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError

logger = logging.getLogger(__name__)


class ClaudeClientError(Exception):
    """Claude API呼び出しエラー"""

    def __init__(self, message: str, error_code: str = "UNKNOWN"):
        super().__init__(message)
        self.error_code = error_code


class AWSAuthenticationError(ClaudeClientError):
    """AWS認証エラー（トークン期限切れ等）"""

    def __init__(self, message: str):
        super().__init__(message, error_code="AWS_AUTH_EXPIRED")


# AWS認証関連のエラーコード
AWS_AUTH_ERROR_CODES = [
    "ExpiredTokenException",
    "ExpiredToken",
    "UnrecognizedClientException",
    "InvalidIdentityToken",
    "AccessDeniedException",
]


class ClaudeClient:
    """Claude API クライアント"""

    def __init__(
        self,
        region: str = "us-west-2",
        model_id: str = "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        max_tokens: int = 4096,
        temperature: float = 0.0,
        retry_attempts: int = 3,
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        aws_session_token: Optional[str] = None,
        aws_profile: Optional[str] = None,
    ):
        """
        初期化

        Args:
            region: AWSリージョン
            model_id: Claudeモデル ID
            max_tokens: 最大トークン数
            temperature: 温度パラメータ（0-1）
            retry_attempts: リトライ回数
            aws_access_key_id: AWSアクセスキーID（オプション）
            aws_secret_access_key: AWSシークレットアクセスキー（オプション）
            aws_session_token: AWSセッショントークン（オプション、一時認証情報用）
            aws_profile: AWSプロファイル名（オプション、SSO用）
        """
        self.region = region
        self.model_id = model_id
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.retry_attempts = retry_attempts

        # Boto3クライアントの初期化
        import os

        profile = aws_profile or os.getenv("AWS_PROFILE")
        access_key = aws_access_key_id or os.getenv("AWS_ACCESS_KEY_ID")
        secret_key = aws_secret_access_key or os.getenv("AWS_SECRET_ACCESS_KEY")
        session_token = aws_session_token or os.getenv("AWS_SESSION_TOKEN")

        # 優先順位: 1. プロファイル, 2. 明示的な認証情報, 3. デフォルト
        if profile:
            # AWS SSO/プロファイルを使用
            session = boto3.Session(profile_name=profile, region_name=region)
            self.client = session.client("bedrock-runtime")
            logger.info(f"Using AWS profile: {profile}")
        elif access_key and secret_key:
            # 明示的な認証情報を使用
            client_kwargs = {
                "region_name": region,
                "aws_access_key_id": access_key,
                "aws_secret_access_key": secret_key,
            }
            # セッショントークンがある場合は追加（一時認証情報用）
            if session_token:
                client_kwargs["aws_session_token"] = session_token
            self.client = boto3.client("bedrock-runtime", **client_kwargs)
            logger.info("Using explicit AWS credentials")
        else:
            # デフォルトの認証方法を使用
            self.client = boto3.client("bedrock-runtime", region_name=region)
            logger.info("Using default AWS credentials")

        logger.info(f"ClaudeClient initialized: region={region}, model={model_id}")

        # 初期化時に接続テストを実行
        self._test_connection()

    def _test_connection(self) -> None:
        """
        AI接続をテスト

        Raises:
            AWSAuthenticationError: AWS認証に失敗した場合
            ClaudeClientError: 接続に失敗した場合
        """
        try:
            # 簡単なテストリクエストを送信
            self.invoke_with_text("Hello")
            logger.info("AI connection test successful")
        except AWSAuthenticationError:
            # AWS認証エラーはそのまま伝播
            raise
        except ClaudeClientError:
            # ClaudeClientErrorもそのまま伝播
            raise
        except Exception as e:
            error_msg = f"AI接続に失敗しました: {str(e)}"
            logger.error(error_msg)
            raise ClaudeClientError(error_msg) from e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(ClientError),
        reraise=True,
    )
    def invoke_with_text(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        テキストプロンプトでClaude APIを呼び出す

        Args:
            prompt: ユーザープロンプト
            system_prompt: システムプロンプト

        Returns:
            {
                "content": "応答テキスト",
                "usage": {"input_tokens": 100, "output_tokens": 200}
            }

        Raises:
            ClaudeClientError: API呼び出しエラー
        """
        try:
            # リクエストボディ作成
            body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "messages": [{"role": "user", "content": prompt}],
            }

            if system_prompt:
                body["system"] = system_prompt

            # API呼び出し
            response = self.client.invoke_model(modelId=self.model_id, body=json.dumps(body))

            # レスポンス解析
            response_body = json.loads(response["body"].read())

            # コンテンツ抽出
            content_blocks = response_body.get("content", [])
            content = ""
            for block in content_blocks:
                if block.get("type") == "text":
                    content += block.get("text", "")

            result = {
                "content": content,
                "usage": response_body.get("usage", {}),
                "stop_reason": response_body.get("stop_reason"),
            }

            logger.info(
                f"Claude API call successful. Input tokens: {result['usage'].get('input_tokens')}, "
                f"Output tokens: {result['usage'].get('output_tokens')}"
            )

            return result

        except (NoCredentialsError, PartialCredentialsError) as e:
            error_msg = "AWS認証情報が設定されていません。環境変数またはAWSプロファイルを確認してください。"
            logger.error(f"AWS credentials error: {e}")
            raise AWSAuthenticationError(error_msg) from e

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_message = e.response.get("Error", {}).get("Message", "Unknown error")

            logger.error(f"Claude API ClientError: {error_code} - {error_message}")

            # AWS認証エラーの場合
            if error_code in AWS_AUTH_ERROR_CODES:
                raise AWSAuthenticationError(
                    f"AWS認証の有効期限が切れました。'aws sso login --profile <profile>'を実行してください。: {error_message}"
                ) from e

            # スロットリングエラーの場合は再試行
            if error_code in ["ThrottlingException", "TooManyRequestsException"]:
                raise  # リトライデコレータが再試行を処理

            raise ClaudeClientError(f"Claude API error: {error_code} - {error_message}") from e

        except Exception as e:
            logger.error(f"Unexpected error in Claude API call: {str(e)}")
            raise ClaudeClientError(f"Unexpected error: {str(e)}") from e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(ClientError),
        reraise=True,
    )
    def invoke_with_image(
        self,
        prompt: str,
        image_data: bytes,
        image_format: str = "image/png",
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        画像付きプロンプトでClaude APIを呼び出す

        Args:
            prompt: ユーザープロンプト
            image_data: 画像データ（バイト）
            image_format: 画像フォーマット（image/png, image/jpeg, image/webp, image/gif）
            system_prompt: システムプロンプト

        Returns:
            {
                "content": "応答テキスト",
                "usage": {"input_tokens": 100, "output_tokens": 200}
            }

        Raises:
            ClaudeClientError: API呼び出しエラー
        """
        try:
            # 画像をBase64エンコード
            image_base64 = base64.b64encode(image_data).decode("utf-8")

            # リクエストボディ作成
            body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": image_format,
                                    "data": image_base64,
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
            }

            if system_prompt:
                body["system"] = system_prompt

            # API呼び出し
            response = self.client.invoke_model(modelId=self.model_id, body=json.dumps(body))

            # レスポンス解析
            response_body = json.loads(response["body"].read())

            # コンテンツ抽出
            content_blocks = response_body.get("content", [])
            content = ""
            for block in content_blocks:
                if block.get("type") == "text":
                    content += block.get("text", "")

            result = {
                "content": content,
                "usage": response_body.get("usage", {}),
                "stop_reason": response_body.get("stop_reason"),
            }

            logger.info(
                f"Claude API call (with image) successful. Input tokens: {result['usage'].get('input_tokens')}, "
                f"Output tokens: {result['usage'].get('output_tokens')}"
            )

            return result

        except (NoCredentialsError, PartialCredentialsError) as e:
            error_msg = "AWS認証情報が設定されていません。環境変数またはAWSプロファイルを確認してください。"
            logger.error(f"AWS credentials error: {e}")
            raise AWSAuthenticationError(error_msg) from e

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_message = e.response.get("Error", {}).get("Message", "Unknown error")

            logger.error(f"Claude API ClientError: {error_code} - {error_message}")

            # AWS認証エラーの場合
            if error_code in AWS_AUTH_ERROR_CODES:
                raise AWSAuthenticationError(
                    f"AWS認証の有効期限が切れました。'aws sso login --profile <profile>'を実行してください。: {error_message}"
                ) from e

            # スロットリングエラーの場合は再試行
            if error_code in ["ThrottlingException", "TooManyRequestsException"]:
                raise  # リトライデコレータが再試行を処理

            raise ClaudeClientError(f"Claude API error: {error_code} - {error_message}") from e

        except Exception as e:
            logger.error(f"Unexpected error in Claude API call with image: {str(e)}")
            raise ClaudeClientError(f"Unexpected error: {str(e)}") from e

    def invoke_with_multiple_images(
        self,
        prompt: str,
        images: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        複数画像付きプロンプトでClaude APIを呼び出す

        Args:
            prompt: ユーザープロンプト
            images: 画像リスト [{"data": bytes, "format": "image/png"}, ...]
            system_prompt: システムプロンプト

        Returns:
            {
                "content": "応答テキスト",
                "usage": {"input_tokens": 100, "output_tokens": 200}
            }

        Raises:
            ClaudeClientError: API呼び出しエラー
        """
        try:
            # コンテンツ配列を構築
            content_blocks: List[Dict[str, Any]] = []

            # 各画像を追加
            for img in images:
                image_base64 = base64.b64encode(img["data"]).decode("utf-8")
                content_blocks.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": img.get("format", "image/png"),
                            "data": image_base64,
                        },
                    }
                )

            # テキストプロンプトを追加
            content_blocks.append({"type": "text", "text": prompt})

            # リクエストボディ作成
            body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "messages": [{"role": "user", "content": content_blocks}],
            }

            if system_prompt:
                body["system"] = system_prompt

            # API呼び出し
            response = self.client.invoke_model(modelId=self.model_id, body=json.dumps(body))

            # レスポンス解析
            response_body = json.loads(response["body"].read())

            # コンテンツ抽出
            response_content_blocks = response_body.get("content", [])
            content = ""
            for block in response_content_blocks:
                if block.get("type") == "text":
                    content += block.get("text", "")

            result = {
                "content": content,
                "usage": response_body.get("usage", {}),
                "stop_reason": response_body.get("stop_reason"),
            }

            logger.info(
                f"Claude API call (with {len(images)} images) successful. "
                f"Input tokens: {result['usage'].get('input_tokens')}, "
                f"Output tokens: {result['usage'].get('output_tokens')}"
            )

            return result

        except (NoCredentialsError, PartialCredentialsError) as e:
            error_msg = "AWS認証情報が設定されていません。環境変数またはAWSプロファイルを確認してください。"
            logger.error(f"AWS credentials error: {e}")
            raise AWSAuthenticationError(error_msg) from e

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_message = e.response.get("Error", {}).get("Message", "Unknown error")

            logger.error(f"Claude API ClientError: {error_code} - {error_message}")

            # AWS認証エラーの場合
            if error_code in AWS_AUTH_ERROR_CODES:
                raise AWSAuthenticationError(
                    f"AWS認証の有効期限が切れました。'aws sso login --profile <profile>'を実行してください。: {error_message}"
                ) from e

            raise ClaudeClientError(f"Claude API error: {error_code} - {error_message}") from e

        except Exception as e:
            logger.error(f"Error in Claude API call with multiple images: {str(e)}")
            raise ClaudeClientError(f"Unexpected error: {str(e)}") from e
