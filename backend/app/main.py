"""Точка входа FastAPI. Локальный сервис, без аккаунтов и без внешней аналитики."""

from __future__ import annotations

from fastapi import FastAPI

from app.api.routes import router
from app.config import Settings, load_settings
from app.logging_config import configure_logging
from app.storage.sessions import SessionStore


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    configure_logging(settings.log_level)
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.sessions_dir.mkdir(parents=True, exist_ok=True)
    settings.references_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title="HEMA Motion Coach", version="0.1.0")
    app.state.settings = settings
    app.state.store = SessionStore(settings.database_path)
    app.include_router(router)
    return app


app = create_app()
