import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Quality Control API"
    PROJECT_DESCRIPTION: str = "API for industrial quality control with AI-powered defect detection."
    SECRET_KEY: str = os.getenv("SECRET_KEY")  # Must be set in environment
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Dynamically locate the backend base directory absolutely
    _BACKEND_DIR = Path(__file__).resolve().parents[2]
    _DEFAULT_SQLITE_PATH = f"sqlite:///{(_BACKEND_DIR / 'sql_app.db').as_posix()}"
    DATABASE_URL: str = os.getenv("DATABASE_URL", _DEFAULT_SQLITE_PATH)

    # AI Model Settings
    AI_MODEL_PATH: str = os.getenv("AI_MODEL_PATH", "ai_model/models/yolov8n_saved_model") # Default path for AI model
    # TensorFlow classifier path for binary defect detection.
    TF_DEFECT_MODEL_PATH: str = os.getenv("TF_DEFECT_MODEL_PATH", "backend/model/defect_model.h5")
    # filter: "drop-shadow(0 0 8px rgba(6, 182, 212, 0.6))". Increase to reduce false positives.
    AI_FALLBACK_THRESHOLD: float = 0.45

    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
