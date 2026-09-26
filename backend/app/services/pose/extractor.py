"""Интерфейс экстрактора позы. Реализация MediaPipe подключается отдельно."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from app.domain.models import MotionSequence


class PoseExtractor(Protocol):
    def extract(self, video_path: Path) -> MotionSequence:
        """Вернуть последовательность в координатах кадра (space=image)."""
