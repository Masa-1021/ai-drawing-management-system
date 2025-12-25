"""
AI解析サービス

Claude APIを使用してCAD図面を解析する
- 図枠情報抽出
- 分類（部品図/ユニット図/組図）
- 風船抽出
- 改訂履歴抽出
- 要約・形状特徴抽出
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from app.services.claude_client import ClaudeClient
from app.services.pdf_converter import PDFConverter
from app.utils.prompt_manager import PromptManager
from app.utils.config_manager import ConfigManager

logger = logging.getLogger(__name__)


class AIAnalysisException(Exception):
    """AI解析エラー"""

    pass


class AIAnalysisService:
    """AI解析サービス"""

    def __init__(
        self,
        config_manager: Optional[ConfigManager] = None,
        claude_client: Optional[ClaudeClient] = None,
        pdf_converter: Optional[PDFConverter] = None,
        prompt_manager: Optional[PromptManager] = None,
    ):
        """
        初期化

        Args:
            config_manager: 設定マネージャー
            claude_client: Claude APIクライアント
            pdf_converter: PDF変換サービス
            prompt_manager: プロンプトマネージャー
        """
        self.config = config_manager or ConfigManager()

        # AWS認証情報の確認（プロファイル or アクセスキー）
        has_profile = bool(self.config.aws_profile)
        has_credentials = bool(self.config.aws_access_key_id and self.config.aws_secret_access_key)

        if not has_profile and not has_credentials:
            error_msg = (
                "AWS認証情報が設定されていません。"
                ".envファイルにAWS_PROFILE（SSO用）またはAWS_ACCESS_KEY_IDとAWS_SECRET_ACCESS_KEYを設定してください。"
            )
            logger.error(error_msg)
            raise AIAnalysisException(error_msg)

        # ClaudeClientの初期化（接続テストも実行される）
        try:
            self.claude = claude_client or ClaudeClient(
                region=self.config.aws_region,
                model_id=self.config.model_id,
                aws_profile=self.config.aws_profile if has_profile else None,
                aws_access_key_id=self.config.aws_access_key_id if has_credentials else None,
                aws_secret_access_key=self.config.aws_secret_access_key if has_credentials else None,
                aws_session_token=self.config.aws_session_token if has_credentials else None,
            )
        except Exception as e:
            error_msg = f"AI接続の初期化に失敗しました: {str(e)}"
            logger.error(error_msg)
            raise AIAnalysisException(error_msg) from e

        self.pdf_converter = pdf_converter or PDFConverter()
        self.prompt_manager = prompt_manager or PromptManager()

        logger.info("AIAnalysisService initialized successfully")

    def analyze_drawing(self, pdf_path: str | Path, page_num: int = 0) -> Dict[str, Any]:
        """
        図面を解析（図枠情報抽出）

        Args:
            pdf_path: PDFファイルパス
            page_num: ページ番号（0始まり）

        Returns:
            {
                "fields": [
                    {"name": "図番", "value": "AB-1234", "confidence": 95, "coordinates": {...}},
                    ...
                ]
            }

        Raises:
            AIAnalysisException: 解析エラー
        """
        try:
            logger.info(f"Starting drawing analysis: {pdf_path}, page {page_num}")

            # PDFを画像に変換
            image_data = self.pdf_converter.pdf_page_to_image(pdf_path, page_num)

            # プロンプト取得
            extraction_fields_config = self.config.extraction_fields
            fields_str = "\n".join(
                [
                    f"- {field['name']}: {'必須' if field.get('required', False) else 'オプション'}"
                    for field in extraction_fields_config
                ]
            )

            prompt = self.prompt_manager.format_prompt("extraction", extraction_fields=fields_str)

            # Claude API呼び出し
            response = self.claude.invoke_with_image(
                prompt=prompt, image_data=image_data, image_format="image/png"
            )

            # JSON解析
            content = response["content"]
            result = self._parse_json_response(content)

            logger.info(
                f"Drawing analysis completed: {len(result.get('fields', []))} fields extracted"
            )

            return result

        except Exception as e:
            logger.error(f"Drawing analysis error: {str(e)}")
            raise AIAnalysisException(f"図面解析エラー: {str(e)}") from e

    def classify_drawing(self, pdf_path: str | Path, page_num: int = 0) -> Dict[str, Any]:
        """
        図面を分類

        Args:
            pdf_path: PDFファイルパス
            page_num: ページ番号

        Returns:
            {
                "category": "部品図 | ユニット図 | 組図",
                "confidence": 85,
                "reasoning": "分類理由"
            }

        Raises:
            AIAnalysisException: 分類エラー
        """
        try:
            logger.info(f"Starting drawing classification: {pdf_path}")

            # PDFを画像に変換
            image_data = self.pdf_converter.pdf_page_to_image(pdf_path, page_num)

            # プロンプト取得
            prompt = self.prompt_manager.format_prompt("classification")

            # Claude API呼び出し
            response = self.claude.invoke_with_image(
                prompt=prompt, image_data=image_data, image_format="image/png"
            )

            # JSON解析
            content = response["content"]
            result = self._parse_json_response(content)

            logger.info(
                f"Classification completed: {result.get('category')} (confidence: {result.get('confidence')}%)"
            )

            return result

        except Exception as e:
            logger.error(f"Classification error: {str(e)}")
            raise AIAnalysisException(f"分類エラー: {str(e)}") from e

    def extract_balloons(
        self, pdf_path: str | Path, page_num: int = 0, rotation_angle: int = 0
    ) -> Dict[str, Any]:
        """
        風船情報を抽出

        Args:
            pdf_path: PDFファイルパス
            page_num: ページ番号
            rotation_angle: 回転角度（0, 90, 180, 270）- 正しい向きにするための回転

        Returns:
            {
                "balloons": [
                    {
                        "balloon_number": "1",
                        "part_name": "ボルト",
                        "quantity": 4,
                        "confidence": 92,
                        "coordinates": {"x": 250, "y": 180}
                    },
                    ...
                ]
            }

        Raises:
            AIAnalysisException: 抽出エラー
        """
        try:
            logger.info(f"Starting balloon extraction: {pdf_path} (rotation: {rotation_angle})")

            # PDFを画像に変換（回転補正を適用）
            image_data = self.pdf_converter.pdf_page_to_image(
                pdf_path, page_num, rotation_angle=rotation_angle
            )

            # プロンプト取得
            prompt = self.prompt_manager.format_prompt("balloon_extraction")

            # Claude API呼び出し
            response = self.claude.invoke_with_image(
                prompt=prompt, image_data=image_data, image_format="image/png"
            )

            # JSON解析
            content = response["content"]
            result = self._parse_json_response(content)

            logger.info(
                f"Balloon extraction completed: {len(result.get('balloons', []))} balloons found"
            )

            return result

        except Exception as e:
            logger.error(f"Balloon extraction error: {str(e)}")
            raise AIAnalysisException(f"風船抽出エラー: {str(e)}") from e

    def extract_revisions(self, pdf_path: str | Path, page_num: int = 0) -> Dict[str, Any]:
        """
        改訂履歴を抽出

        Args:
            pdf_path: PDFファイルパス
            page_num: ページ番号

        Returns:
            {
                "revisions": [
                    {
                        "revision_number": "Rev.1",
                        "revision_date": "2024-11-10",
                        "description": "寸法変更",
                        "author": "田中太郎",
                        "confidence": 92
                    },
                    ...
                ]
            }

        Raises:
            AIAnalysisException: 抽出エラー
        """
        try:
            logger.info(f"Starting revision extraction: {pdf_path}")

            # PDFを画像に変換
            image_data = self.pdf_converter.pdf_page_to_image(pdf_path, page_num)

            # プロンプト取得
            prompt = self.prompt_manager.format_prompt("revision_extraction")

            # Claude API呼び出し
            response = self.claude.invoke_with_image(
                prompt=prompt, image_data=image_data, image_format="image/png"
            )

            # JSON解析
            content = response["content"]
            result = self._parse_json_response(content)

            logger.info(
                f"Revision extraction completed: {len(result.get('revisions', []))} revisions found"
            )

            return result

        except Exception as e:
            logger.error(f"Revision extraction error: {str(e)}")
            raise AIAnalysisException(f"改訂履歴抽出エラー: {str(e)}") from e

    def detect_rotation(self, pdf_path: str | Path, page_num: int = 0) -> Dict[str, Any]:
        """
        図面の回転角度をAIで検出（画像内容を解析）

        Args:
            pdf_path: PDFファイルパス
            page_num: ページ番号

        Returns:
            {
                "rotation": 0,
                "confidence": 95,
                "reason": "図枠が右下に正しく配置され、文字も正しく読めるため"
            }

        Raises:
            AIAnalysisException: 検出エラー
        """
        try:
            logger.info(f"Starting AI rotation detection: {pdf_path}")

            # PDFを画像に変換
            # ignore_rotation=True: PDFメタデータの回転を無視し、生のコンテンツをAIに見せる
            # AIが実際の画像内容を見て「正しい向きにするには○度回転が必要」と判定する
            # その結果に基づいてPDFコンテンツ自体を回転補正する
            image_data = self.pdf_converter.pdf_page_to_image(
                pdf_path, page_num, ignore_rotation=True
            )

            # プロンプト取得
            prompt = self.prompt_manager.format_prompt("rotation_detection")

            # Claude API呼び出し
            response = self.claude.invoke_with_image(
                prompt=prompt, image_data=image_data, image_format="image/png"
            )

            # JSON解析
            content = response["content"]
            result = self._parse_json_response(content)

            logger.info(
                f"AI rotation detection completed: {result.get('rotation')} degrees "
                f"(confidence: {result.get('confidence')}%)"
            )

            return result

        except Exception as e:
            logger.error(f"AI rotation detection error: {str(e)}")
            raise AIAnalysisException(f"回転検出エラー: {str(e)}") from e

    def generate_summary(self, pdf_path: str | Path, page_num: int = 0) -> Dict[str, Any]:
        """
        図面の要約と形状特徴を生成

        Args:
            pdf_path: PDFファイルパス
            page_num: ページ番号

        Returns:
            {
                "summary": "図面の要約",
                "shape_features": {
                    "type": "プレート",
                    "dimensions": {...},
                    "holes": {...},
                    ...
                },
                "confidence": 85
            }

        Raises:
            AIAnalysisException: 生成エラー
        """
        try:
            logger.info(f"Starting summary generation: {pdf_path}")

            # PDFを画像に変換
            image_data = self.pdf_converter.pdf_page_to_image(pdf_path, page_num)

            # プロンプト取得
            prompt = self.prompt_manager.format_prompt("summary_extraction")

            # Claude API呼び出し
            response = self.claude.invoke_with_image(
                prompt=prompt, image_data=image_data, image_format="image/png"
            )

            # JSON解析
            content = response["content"]
            result = self._parse_json_response(content)

            logger.info("Summary generation completed")

            return result

        except Exception as e:
            logger.error(f"Summary generation error: {str(e)}")
            raise AIAnalysisException(f"要約生成エラー: {str(e)}") from e

    def analyze_drawing_full(self, pdf_path: str | Path, page_num: int = 0) -> Dict[str, Any]:
        """
        図面の完全解析（全機能統合）

        Args:
            pdf_path: PDFファイルパス
            page_num: ページ番号

        Returns:
            {
                "fields": [...],
                "classification": {...},
                "balloons": [...],
                "revisions": [...],
                "summary": {...}
            }

        Raises:
            AIAnalysisException: 解析エラー
        """
        try:
            logger.info(f"Starting full drawing analysis: {pdf_path}")

            # まず回転検出を実行
            rotation_result = self.detect_rotation(pdf_path, page_num)
            detected_rotation = rotation_result.get("rotation", 0)
            logger.info(f"Detected rotation: {detected_rotation} degrees")

            # 各解析を実行（風船抽出は回転補正後の画像で実行）
            fields_result = self.analyze_drawing(pdf_path, page_num)
            classification_result = self.classify_drawing(pdf_path, page_num)
            balloons_result = self.extract_balloons(
                pdf_path, page_num, rotation_angle=detected_rotation
            )
            revisions_result = self.extract_revisions(pdf_path, page_num)
            summary_result = self.generate_summary(pdf_path, page_num)

            # 統合
            full_result = {
                "fields": fields_result.get("fields", []),
                "classification": classification_result,
                "balloons": balloons_result.get("balloons", []),
                "revisions": revisions_result.get("revisions", []),
                "summary": summary_result.get("summary", ""),
                "shape_features": summary_result.get("shape_features", {}),
                "rotation": detected_rotation,  # 回転角度を含める
                "rotation_confidence": rotation_result.get("confidence", 0),
            }

            logger.info("Full drawing analysis completed")

            return full_result

        except Exception as e:
            logger.error(f"Full analysis error: {str(e)}")
            raise AIAnalysisException(f"完全解析エラー: {str(e)}") from e

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """
        Claude APIのレスポンスからJSONを抽出

        Args:
            content: レスポンステキスト

        Returns:
            パースされたJSON

        Raises:
            AIAnalysisException: JSON解析エラー
        """
        try:
            # JSONブロックを探す（```json ... ```）
            if "```json" in content:
                start = content.index("```json") + 7
                end = content.index("```", start)
                json_str = content[start:end].strip()
            elif "```" in content:
                start = content.index("```") + 3
                end = content.index("```", start)
                json_str = content[start:end].strip()
            else:
                # JSONブロックがない場合は全体を試す
                json_str = content.strip()

            # JSON解析
            result = json.loads(json_str)
            return result

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {str(e)}\nContent: {content}")
            raise AIAnalysisException("JSON解析エラー: レスポンスが正しいJSON形式ではありません") from e
        except Exception as e:
            logger.error(f"Unexpected error parsing JSON: {str(e)}")
            raise AIAnalysisException(f"予期しないエラー: {str(e)}") from e
