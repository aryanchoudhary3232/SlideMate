from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str
    aws_region: str = "ap-south-1"
    aws_access_key_id: str
    aws_secret_access_key: str
    s3_bucket_name: str
    s3_public_base_url: str = ""
    gemini_api_key: str
    gemini_chat_model: str = "gemini-2.5-flash"
    gemini_embedding_model: str = "gemini-embedding-exp-03-07"
    process_documents_on_upload: bool = True
    nextjs_url: str = "http://localhost:3000"
    fastapi_port: int = 8000
    db_min_pool_size: int = 2
    db_max_pool_size: int = 10
    db_command_timeout: int = 60

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

