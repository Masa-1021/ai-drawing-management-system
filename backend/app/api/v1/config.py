"""
設定API
"""

import logging
from fastapi import APIRouter
from typing import List, Dict, Any

from app.utils.config_manager import ConfigManager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/extraction-fields", response_model=List[Dict[str, Any]])
def get_extraction_fields():
    """
    抽出フィールド設定を取得

    Returns:
        [{"name": "図番", "required": True}, ...]
    """
    config = ConfigManager()
    return config.extraction_fields


@router.get("/settings")
def get_settings():
    """
    全設定を取得
    """
    config = ConfigManager()
    return {
        "extraction_fields": config.extraction_fields,
        "lock_timeout": config.lock_timeout,
        "retry_attempts": config.retry_attempts,
        "confidence_threshold": config.confidence_threshold,
    }
