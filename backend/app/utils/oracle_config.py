"""
Oracle DB接続設定管理
"""

from pydantic_settings import BaseSettings


class OracleConfig(BaseSettings):
    """Oracle DB接続設定"""

    oracle_host: str
    oracle_port: int = 1521
    oracle_service_name: str
    oracle_user: str
    oracle_password: str
    oracle_sta_no1: str  # 拠点コード（固定値: "SAND"）

    # 接続プール設定
    oracle_pool_min: int = 2
    oracle_pool_max: int = 10
    oracle_connection_timeout: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def dsn(self) -> str:
        """Data Source Name を構築"""
        return f"{self.oracle_host}:{self.oracle_port}/{self.oracle_service_name}"

    def __repr__(self) -> str:
        return (
            f"<OracleConfig(host={self.oracle_host}, "
            f"port={self.oracle_port}, "
            f"service={self.oracle_service_name}, "
            f"user={self.oracle_user})>"
        )
