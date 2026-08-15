"""Application configuration: read from .env, centrally managing all configurable items."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Application basics
    app_name: str = "Enterprise RAG Knowledge Base System"
    app_secret_key: str = "change-me"
    access_token_expire_minutes: int = 120
    refresh_token_expire_days: int = 7
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173"

    # MySQL
    database_url: str = "mysql+pymysql://root:root@127.0.0.1:3306/rag_kb?charset=utf8mb4"

    # Redis
    redis_url: str = "redis://127.0.0.1:6379/0"

    # Elasticsearch
    elasticsearch_url: str = "http://127.0.0.1:9200"
    elasticsearch_username: str = "elastic"
    elasticsearch_password: str = "changeme"
    es_index_prefix: str = "rag_kb"
    es_verify_certs: bool = False

    # LLM (DeepSeek)
    llm_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com"
    llm_model: str = "deepseek-v4-pro"
    llm_enabled: bool = True

    # Vector embedding
    embedding_dim: int = 256

    # Files and tasks
    upload_dir: str = "./data/uploads"
    task_mode: str = "thread"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_ready(self) -> bool:
        """Whether the real LLM can be invoked."""
        return bool(self.llm_enabled and self.llm_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
