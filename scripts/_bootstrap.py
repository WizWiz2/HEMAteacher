"""Общий запуск CLI из корня репозитория."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def bootstrap() -> Path:
    """Локально код лежит в backend/, в Docker-образе пакет app лежит в /app."""
    backend = ROOT / "backend"
    candidate = backend if (backend / "app").exists() else ROOT
    if str(candidate) not in sys.path:
        sys.path.insert(0, str(candidate))
    return ROOT
