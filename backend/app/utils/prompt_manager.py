"""
プロンプト管理マネージャー

.txtファイルからプロンプトを読み込み、変数置換を行う
"""

from pathlib import Path
from typing import Optional


class PromptManager:
    """プロンプト管理クラス"""

    def __init__(self, prompts_dir: Optional[str] = None):
        """
        初期化

        Args:
            prompts_dir: プロンプトディレクトリのパス。Noneの場合はデフォルトパスを使用
        """
        if prompts_dir:
            self.prompts_dir = Path(prompts_dir)
        else:
            # backend/prompts/ ディレクトリ
            self.prompts_dir = Path(__file__).parent.parent.parent / "prompts"

        # ディレクトリが存在しない場合は作成
        self.prompts_dir.mkdir(parents=True, exist_ok=True)

    def load_prompt(self, prompt_name: str) -> str:
        """
        プロンプトファイルを読み込み

        Args:
            prompt_name: プロンプト名（拡張子なし）
                例: "extraction", "classification"

        Returns:
            プロンプトテンプレート文字列

        Raises:
            FileNotFoundError: プロンプトファイルが見つからない場合
        """
        prompt_path = self.prompts_dir / f"{prompt_name}.txt"

        if not prompt_path.exists():
            raise FileNotFoundError(
                f"プロンプトファイルが見つかりません: {prompt_path}\n" f"backend/prompts/{prompt_name}.txt を作成してください"
            )

        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()

    def format_prompt(self, prompt_name: str, **kwargs) -> str:
        """
        プロンプトをフォーマット（変数置換）

        Args:
            prompt_name: プロンプト名
            **kwargs: 置換する変数
                例: extraction_fields=["図番", "タイトル"]

        Returns:
            フォーマット済みプロンプト

        Example:
            >>> manager = PromptManager()
            >>> prompt = manager.format_prompt(
            ...     "extraction",
            ...     extraction_fields=["図番", "タイトル", "作成日"]
            ... )
        """
        template = self.load_prompt(prompt_name)
        return template.format(**kwargs)

    def list_prompts(self) -> list[str]:
        """
        利用可能なプロンプトのリストを取得

        Returns:
            プロンプト名のリスト（拡張子なし）
        """
        prompts = []
        for file in self.prompts_dir.glob("*.txt"):
            prompts.append(file.stem)
        return sorted(prompts)

    def __repr__(self):
        return f"<PromptManager(prompts_dir={self.prompts_dir})>"
