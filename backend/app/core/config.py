from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Estoque Modular API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Database (PostgreSQL como padrão via Docker)
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/estoque_db"
    
    # Domain configs
    QUANTITY_SCALE: int = 1000  # 1 unidade = 1000 (3 casas decimais)
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    
    # Idempotency window in seconds for deduplication
    IDEMPOTENCY_EXPIRATION_HOURS: int = 24

settings = Settings()
