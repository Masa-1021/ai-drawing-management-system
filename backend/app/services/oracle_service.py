"""
Oracle DBサービス

OracleDBとの接続、データ取得を管理するサービスクラス
"""

import oracledb
from tenacity import retry, stop_after_attempt, wait_exponential
from typing import Optional

from ..utils.oracle_config import OracleConfig
from ..schemas.oracle import OracleLineData, OracleEquipmentData


class OracleService:
    """Oracle DBサービスクラス"""

    def __init__(self, config: OracleConfig):
        """
        初期化

        Args:
            config: Oracle DB接続設定
        """
        self.config = config
        self.pool: Optional[oracledb.ConnectionPool] = None
        self._initialize_pool()

    def _initialize_pool(self) -> None:
        """接続プールを初期化"""
        try:
            # python-oracledb v2.x以降では encoding/nencoding パラメータは不要
            # デフォルトでUTF-8が使用される
            self.pool = oracledb.create_pool(
                user=self.config.oracle_user,
                password=self.config.oracle_password,
                dsn=self.config.dsn,
                min=self.config.oracle_pool_min,
                max=self.config.oracle_pool_max,
            )
            print(f"Oracle接続プールを作成しました: {self.config.dsn}")
        except oracledb.Error as e:
            print(f"Oracle接続プール作成エラー: {e}")
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def get_lines(self) -> list[OracleLineData]:
        """
        OracleDBからライン一覧を取得

        Returns:
            ライン情報のリスト

        Raises:
            oracledb.Error: DB接続エラー
        """
        if not self.pool:
            raise RuntimeError("接続プールが初期化されていません")

        with self.pool.acquire() as connection:
            cursor = connection.cursor()
            try:
                # HF1SEM01テーブルからライン一覧を取得
                query = """
                    SELECT DISTINCT STA_NO2, LINE_NAME
                    FROM HF1SEM01
                    WHERE STA_NO1 = :sta_no1
                    ORDER BY STA_NO2
                """
                cursor.execute(query, sta_no1=self.config.oracle_sta_no1)

                rows = cursor.fetchall()
                return [OracleLineData(line_code=row[0], line_name=row[1]) for row in rows]
            finally:
                cursor.close()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def get_equipments(self, line_code: str) -> list[OracleEquipmentData]:
        """
        指定ラインの設備一覧を取得

        Args:
            line_code: ラインコード (STA_NO2)

        Returns:
            設備情報のリスト

        Raises:
            oracledb.Error: DB接続エラー
        """
        if not self.pool:
            raise RuntimeError("接続プールが初期化されていません")

        with self.pool.acquire() as connection:
            cursor = connection.cursor()
            try:
                # HF1SFM01テーブルから設備一覧を取得
                query = """
                    SELECT DISTINCT STA_NO3, ST_NAME
                    FROM HF1SFM01
                    WHERE STA_NO1 = :sta_no1
                      AND STA_NO2 = :sta_no2
                    ORDER BY STA_NO3
                """
                cursor.execute(
                    query,
                    sta_no1=self.config.oracle_sta_no1,
                    sta_no2=line_code,
                )

                rows = cursor.fetchall()
                return [
                    OracleEquipmentData(equipment_code=row[0], equipment_name=row[1])
                    for row in rows
                ]
            finally:
                cursor.close()

    def test_connection(self) -> tuple[bool, str, Optional[str]]:
        """
        Oracle DB接続テスト

        Returns:
            (成功フラグ, メッセージ, Oracleバージョン)
        """
        if not self.pool:
            return False, "接続プールが初期化されていません", None

        try:
            with self.pool.acquire() as connection:
                cursor = connection.cursor()
                try:
                    # バージョン情報を取得
                    cursor.execute("SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1")
                    version_row = cursor.fetchone()
                    version = version_row[0] if version_row else "不明"

                    return True, "Oracle DBへの接続に成功しました", version
                finally:
                    cursor.close()
        except oracledb.Error as e:
            error_message = f"接続エラー: {e}"
            return False, error_message, None

    def close(self) -> None:
        """接続プールをクローズ"""
        if self.pool:
            self.pool.close()
            print("Oracle接続プールをクローズしました")
            self.pool = None

    def __enter__(self):
        """コンテキストマネージャ - 開始"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """コンテキストマネージャ - 終了"""
        self.close()

    def __del__(self):
        """デストラクタ"""
        self.close()
