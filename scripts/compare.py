"""Офлайн-сравнение двух роликов. Веб-интерфейс для этого шага не нужен.

python scripts/compare.py --reference reference.mp4 --attempt attempt.mp4 --output ./result/
"""

from __future__ import annotations

import argparse
import sys

from _bootstrap import bootstrap

bootstrap()

from app.config import load_profile, load_settings  # noqa: E402
from app.logging_config import configure_logging  # noqa: E402
from app.services.pipeline import compare_two_videos  # noqa: E402
from app.services.video.io import VideoError  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Сравнить два видео footwork и собрать result/")
    parser.add_argument("--reference", required=True)
    parser.add_argument("--attempt", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--profile", default="footwork_v1")
    parser.add_argument("--camera-view", default="side")
    args = parser.parse_args()

    settings = load_settings()
    configure_logging(settings.log_level)
    profile = load_profile(settings.profiles_dir / f"{args.profile}.yaml")
    try:
        result = compare_two_videos(
            reference_video=bootstrap_path(args.reference),
            attempt_video=bootstrap_path(args.attempt),
            output_dir=bootstrap_path(args.output),
            settings=settings,
            profile=profile,
            camera_view=args.camera_view,
        )
    except (VideoError, FileNotFoundError) as error:
        print(error)
        return 2
    print(result.message or f"Схожесть с эталоном: {result.similarity}")
    for item in result.feedback:
        print(f"- [{item.severity}] {item.message}")
    return 0 if result.reliable else 2


def bootstrap_path(value: str):
    from pathlib import Path

    return Path(value).expanduser().resolve()


if __name__ == "__main__":
    sys.exit(main())
