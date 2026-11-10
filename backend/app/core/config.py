from pydantic import field_validator
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

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("DATABASE_URL não pode ser vazia.")
        valid_schemes = ("postgresql://", "postgresql+psycopg2://", "postgres://")
        if not any(v.startswith(scheme) for scheme in valid_schemes):
            raise ValueError(
                f"DATABASE_URL inválida. Deve iniciar com um dos esquemas suportados do PostgreSQL: {valid_schemes}"
            )
        return v

settings = Settings()
