"""
プロンプト管理API
"""

from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime

from app.schemas.prompt import PromptResponse, PromptListItem, PromptUpdate
from app.utils.prompt_manager import PromptManager

router = APIRouter()

# PromptManagerインスタンス
prompt_manager = PromptManager()

# プロンプト名と日本語表示名のマッピング
PROMPT_LABELS = {
    "extraction": "図枠情報抽出",
    "classification": "図面分類",
    "balloon_extraction": "風船抽出",
    "rotation_detection": "回転検出",
    "natural_language_query": "自然言語クエリ",
    "revision_extraction": "改訂履歴抽出",
    "similarity_search": "類似検索",
    "summary_extraction": "サマリー抽出",
}


def get_prompt_label(name: str) -> str:
    """プロンプト名から日本語ラベルを取得"""
    return PROMPT_LABELS.get(name, name)


@router.get("", response_model=List[PromptListItem])
async def get_prompts():
    """
    プロンプト一覧取得

    Returns:
        List[PromptListItem]: プロンプト一覧
    """
    prompts = []
    for name in prompt_manager.list_prompts():
        prompt_path = prompt_manager.prompts_dir / f"{name}.txt"
        content = prompt_manager.load_prompt(name)
        preview = content[:100] + "..." if len(content) > 100 else content

        # ファイルの更新日時を取得
        updated_at = None
        if prompt_path.exists():
            stat = prompt_path.stat()
            updated_at = datetime.fromtimestamp(stat.st_mtime)

        prompts.append(
            PromptListItem(
                name=name,
                label=get_prompt_label(name),
                preview=preview.replace("\n", " "),
                updated_at=updated_at,
            )
        )

    return prompts


@router.get("/{prompt_name}", response_model=PromptResponse)
async def get_prompt(prompt_name: str):
    """
    プロンプト詳細取得

    Args:
        prompt_name: プロンプト名

    Returns:
        PromptResponse: プロンプト詳細

    Raises:
        HTTPException: プロンプトが見つからない場合
    """
    try:
        content = prompt_manager.load_prompt(prompt_name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Prompt '{prompt_name}' not found")

    prompt_path = prompt_manager.prompts_dir / f"{prompt_name}.txt"
    updated_at = None
    if prompt_path.exists():
        stat = prompt_path.stat()
        updated_at = datetime.fromtimestamp(stat.st_mtime)

    return PromptResponse(
        name=prompt_name,
        label=get_prompt_label(prompt_name),
        content=content,
        file_path=str(prompt_path),
        updated_at=updated_at,
    )


@router.put("/{prompt_name}", response_model=PromptResponse)
async def update_prompt(prompt_name: str, prompt: PromptUpdate):
    """
    プロンプト更新

    Args:
        prompt_name: プロンプト名
        prompt: 更新データ

    Returns:
        PromptResponse: 更新されたプロンプト

    Raises:
        HTTPException: プロンプトが見つからない場合
    """
    prompt_path = prompt_manager.prompts_dir / f"{prompt_name}.txt"

    if not prompt_path.exists():
        raise HTTPException(status_code=404, detail=f"Prompt '{prompt_name}' not found")

    # ファイルに書き込み
    with open(prompt_path, "w", encoding="utf-8") as f:
        f.write(prompt.content)

    # 更新日時を取得
    stat = prompt_path.stat()
    updated_at = datetime.fromtimestamp(stat.st_mtime)

    return PromptResponse(
        name=prompt_name,
        label=get_prompt_label(prompt_name),
        content=prompt.content,
        file_path=str(prompt_path),
        updated_at=updated_at,
    )
