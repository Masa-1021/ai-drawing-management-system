"""
ロギング設定

3種類のログファイルを管理:
- operation.log: 操作ログ (図面登録、編集、承認など)
- error.log: エラーログ
- access.log: APIアクセスログ
"""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import sys


def setup_logging(log_dir: str = None, log_level: str = "INFO"):
    """
    ロギングを設定

    Args:
        log_dir: ログディレクトリのパス。Noneの場合はデフォルトパス
        log_level: ログレベル ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")
    """
    # ログディレクトリ
    if log_dir is None:
        project_root = Path(__file__).parent.parent.parent.parent
        log_dir = project_root / "storage" / "logs"
    else:
        log_dir = Path(log_dir)

    # ディレクトリが存在しない場合は作成
    log_dir.mkdir(parents=True, exist_ok=True)

    # ログレベル
    level = getattr(logging, log_level.upper(), logging.INFO)

    # ログフォーマット
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # 操作ログの設定
    operation_logger = logging.getLogger("operation")
    operation_logger.setLevel(level)
    operation_logger.handlers.clear()  # 既存のハンドラをクリア

    operation_handler = RotatingFileHandler(
        log_dir / "operation.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8",
    )
    operation_handler.setFormatter(logging.Formatter(log_format, datefmt=date_format))
    operation_logger.addHandler(operation_handler)

    # コンソールにも出力
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(log_format, datefmt=date_format))
    operation_logger.addHandler(console_handler)

    # エラーログの設定
    error_logger = logging.getLogger("error")
    error_logger.setLevel(logging.ERROR)
    error_logger.handlers.clear()

    error_handler = RotatingFileHandler(
        log_dir / "error.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8",
    )
    error_handler.setFormatter(logging.Formatter(log_format, datefmt=date_format))
    error_logger.addHandler(error_handler)

    # アクセスログの設定
    access_logger = logging.getLogger("access")
    access_logger.setLevel(logging.INFO)
    access_logger.handlers.clear()

    access_handler = RotatingFileHandler(
        log_dir / "access.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8",
    )
    access_format = "%(asctime)s - %(message)s"
    access_handler.setFormatter(logging.Formatter(access_format, datefmt=date_format))
    access_logger.addHandler(access_handler)

    # ルートロガーの設定
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    print(f"[OK] ロギング設定完了: {log_dir}")


def get_operation_logger():
    """操作ログのロガーを取得"""
    return logging.getLogger("operation")


def get_error_logger():
    """エラーログのロガーを取得"""
    return logging.getLogger("error")


def get_access_logger():
    """アクセスログのロガーを取得"""
    return logging.getLogger("access")
