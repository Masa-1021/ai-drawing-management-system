"""
検索サービス

自然言語検索、類似検索を提供
"""

import logging
import json
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.drawing import Drawing
from app.services.claude_client import ClaudeClient
from app.services.pdf_converter import PDFConverter
from app.utils.prompt_manager import PromptManager
from app.utils.config_manager import ConfigManager

logger = logging.getLogger(__name__)


class SearchServiceException(Exception):
    """検索サービスエラー"""

    pass


class SearchService:
    """検索サービスクラス"""

    def __init__(
        self,
        db: Session,
        claude_client: Optional[ClaudeClient] = None,
        pdf_converter: Optional[PDFConverter] = None,
        prompt_manager: Optional[PromptManager] = None,
        config_manager: Optional[ConfigManager] = None,
    ):
        """
        初期化

        Args:
            db: データベースセッション
            claude_client: Claude APIクライアント
            pdf_converter: PDF変換サービス
            prompt_manager: プロンプトマネージャー
            config_manager: 設定マネージャー
        """
        self.db = db
        self.config = config_manager or ConfigManager()

        # ClaudeClientの初期化（ConfigManagerから認証情報を取得）
        self.claude = claude_client or ClaudeClient(
            region=self.config.aws_region,
            model_id=self.config.model_id,
            aws_access_key_id=self.config.aws_access_key_id,
            aws_secret_access_key=self.config.aws_secret_access_key,
        )
        self.pdf_converter = pdf_converter or PDFConverter()
        self.prompt_manager = prompt_manager or PromptManager()

    def natural_language_search(self, query: str) -> List[Drawing]:
        """
        自然言語で検索

        Args:
            query: 自然言語クエリ（例: "作成者が田中の図面"）

        Returns:
            Drawingリスト

        Raises:
            SearchServiceException: 検索エラー
        """
        try:
            logger.info(f"Natural language search: {query}")

            # プロンプト取得
            prompt = (
                self.prompt_manager.format_prompt("natural_language_query")
                + f"\n\n入力: {query}\n出力:"
            )

            # Claude APIで構造化クエリに変換
            response = self.claude.invoke_with_text(prompt)
            content = response["content"]

            # JSON解析
            structured_query = self._parse_json_response(content)

            logger.info(f"Structured query: {structured_query}")

            # SQLクエリ生成・実行
            drawings = self._execute_structured_query(structured_query)

            logger.info(f"Found {len(drawings)} drawings")

            return drawings

        except Exception as e:
            logger.error(f"Natural language search error: {e}")
            raise SearchServiceException(f"検索エラー: {str(e)}") from e

    def _execute_structured_query(self, structured_query: Dict[str, Any]) -> List[Drawing]:
        """
        構造化クエリを実行

        Args:
            structured_query: 構造化クエリ

        Returns:
            Drawingリスト
        """
        query = self.db.query(Drawing)

        conditions = structured_query.get("conditions", [])
        logic = structured_query.get("logic", "AND")

        # 条件を構築
        filter_conditions = []

        for condition in conditions:
            table = condition.get("table")
            field = condition.get("field")
            operator = condition.get("operator")
            value = condition.get("value")

            if table == "drawings":
                # drawingsテーブルの条件
                column = getattr(Drawing, field, None)
                if column is not None:
                    if operator == "=":
                        filter_conditions.append(column == value)
                    elif operator == "!=":
                        filter_conditions.append(column != value)
                    elif operator == "LIKE":
                        filter_conditions.append(column.like(value))
                    elif operator == ">":
                        filter_conditions.append(column > value)
                    elif operator == ">=":
                        filter_conditions.append(column >= value)
                    elif operator == "<":
                        filter_conditions.append(column < value)
                    elif operator == "<=":
                        filter_conditions.append(column <= value)

        # AND/OR条件を適用
        if filter_conditions:
            if logic == "AND":
                query = query.filter(and_(*filter_conditions))
            else:
                query = query.filter(or_(*filter_conditions))

        return query.all()

    def similarity_search(self, query_drawing_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        類似図面を検索

        Args:
            query_drawing_id: 検索元の図面ID
            limit: 取得件数

        Returns:
            類似図面リスト [{"drawing": Drawing, "similarity_score": 85, ...}, ...]

        Raises:
            SearchServiceException: 検索エラー
        """
        try:
            logger.info(f"Similarity search for drawing {query_drawing_id}")

            # 検索元図面を取得
            query_drawing = self.db.query(Drawing).filter(Drawing.id == query_drawing_id).first()

            if not query_drawing:
                raise SearchServiceException(f"図面が見つかりません: {query_drawing_id}")

            # 検索元画像を取得
            from app.utils.file_manager import FileManager

            file_manager = FileManager()
            query_pdf_path = file_manager.get_pdf_path(query_drawing.pdf_filename)
            query_image = self.pdf_converter.pdf_page_to_image(
                query_pdf_path, query_drawing.page_number
            )

            # 全図面と比較
            all_drawings = self.db.query(Drawing).all()

            results: List[Dict[str, Any]] = []

            for target_drawing in all_drawings:
                if target_drawing.id == query_drawing_id:
                    continue

                # 対象画像を取得
                target_pdf_path = file_manager.get_pdf_path(target_drawing.pdf_filename)
                target_image = self.pdf_converter.pdf_page_to_image(
                    target_pdf_path, target_drawing.page_number
                )

                # 類似度を計算
                similarity_result = self._calculate_similarity(query_image, target_image)

                results.append(
                    {
                        "drawing": target_drawing,
                        "similarity_score": similarity_result.get("similarity_score", 0),
                        "reason": similarity_result.get("reason", ""),
                        "common_features": similarity_result.get("common_features", []),
                        "differences": similarity_result.get("differences", []),
                    }
                )

            # 類似度順にソート
            results.sort(key=lambda x: x["similarity_score"], reverse=True)

            # 上位limit件を返す
            return results[:limit]

        except Exception as e:
            logger.error(f"Similarity search error: {e}")
            raise SearchServiceException(f"類似検索エラー: {str(e)}") from e

    def _calculate_similarity(self, query_image: bytes, target_image: bytes) -> Dict[str, Any]:
        """
        2つの画像の類似度を計算

        Args:
            query_image: 検索元画像
            target_image: 対象画像

        Returns:
            類似度情報
        """
        try:
            # プロンプト取得
            prompt = self.prompt_manager.load_prompt("similarity_search")

            # Claude APIで比較
            response = self.claude.invoke_with_multiple_images(
                prompt=prompt,
                images=[
                    {"data": query_image, "format": "image/png"},
                    {"data": target_image, "format": "image/png"},
                ],
            )

            # JSON解析
            result = self._parse_json_response(response["content"])

            return result

        except Exception as e:
            logger.error(f"Similarity calculation error: {e}")
            return {
                "similarity_score": 0,
                "reason": f"エラー: {str(e)}",
                "common_features": [],
                "differences": [],
            }

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """
        Claude APIレスポンスからJSONを抽出

        Args:
            content: レスポンステキスト

        Returns:
            パースされたJSON
        """
        try:
            # JSONブロックを探す
            if "```json" in content:
                start = content.index("```json") + 7
                end = content.index("```", start)
                json_str = content[start:end].strip()
            elif "```" in content:
                start = content.index("```") + 3
                end = content.index("```", start)
                json_str = content[start:end].strip()
            else:
                json_str = content.strip()

            return json.loads(json_str)

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}\nContent: {content}")
            raise SearchServiceException("JSON解析エラー") from e
