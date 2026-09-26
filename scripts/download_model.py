"""Скачать pose landmarker. Файл не коммитится, Docker забирает его при сборке."""

from __future__ import annotations

import urllib.request
from pathlib import Path

URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_full/float16/latest/pose_landmarker_full.task"
)


def main() -> None:
    destination = Path(__file__).resolve().parents[1] / "backend" / "models" / "pose_landmarker_full.task"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 1_000_000:
        print(f"Модель уже на месте: {destination}")
        return
    print(f"Скачиваю {URL}")
    urllib.request.urlretrieve(URL, destination)
    print(f"Сохранено: {destination} ({destination.stat().st_size} байт)")


if __name__ == "__main__":
    main()
