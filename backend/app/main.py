import os
import logging

# FastAPI and middleware imports
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .middleware.rate_limit import RateLimitMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path

# Core settings
from .core.config import settings

logger = logging.getLogger("app.main")

# Database imports
from .database.base import Base, engine
from .database.migrations import migrate_sqlite_schema

# Model imports (ensure registration)
from .models.activity import Activity  # noqa
from .models.camera_session import CameraSession  # noqa
from .models.notification import Notification  # noqa
from .models.user import User  # noqa
from .models.prediction import Prediction  # noqa
from .models.system_log import SystemLog  # noqa
from .models.uploaded_file import UploadedFile  # noqa
from .models.user_setting import UserSetting  # noqa

# Router imports
from .api import (
    admin_router,
    analytics_router,
    auth_router,
    notifications_router,
    predictions_router,
    realtime_router,
    reports_router,
    settings_router,
    users_router,
)

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic: Create database tables
    Base.metadata.create_all(bind=engine)
    migrate_sqlite_schema(engine)
    logger.info("Database tables verified and schema migration complete.")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    lifespan=lifespan,
)

# CORS configuration – restrict to frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

# Serve uploaded files and heatmaps as static assets
UPLOADS_PATH = Path(__file__).resolve().parents[3] / "uploads"
HEATMAPS_PATH = Path(__file__).resolve().parents[3] / "analytics" / "heatmaps"
UPLOADS_PATH.mkdir(parents=True, exist_ok=True)
HEATMAPS_PATH.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_PATH)), name="uploads")
app.mount("/heatmaps", StaticFiles(directory=str(HEATMAPS_PATH)), name="heatmaps")

@app.get("/", tags=["Root"])
async def read_root():
    return {"status": "online", "message": "AI Quality Control API Active"}

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/users", tags=["Users"])
app.include_router(predictions_router, prefix="/predictions", tags=["Predictions"])
app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
app.include_router(settings_router, prefix="/settings", tags=["Settings"])
app.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
app.include_router(reports_router, prefix="/reports", tags=["Reports"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])
from .api import health

app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(realtime_router, prefix="/ws", tags=["Realtime"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
