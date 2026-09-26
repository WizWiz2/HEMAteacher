"""Разобрать попытку и сложить отладочное видео.

python scripts/analyze_video.py --movement passing-step-forward --video attempt.mp4 --debug-output ./debug/
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from _bootstrap import bootstrap

bootstrap()

from app.config import load_settings  # noqa: E402
from app.logging_config import configure_logging  # noqa: E402
from app.services.pipeline import analyze_attempt_video, load_movement_profile  # noqa: E402
from app.services.video.io import VideoError  # noqa: E402
from app.storage.library import UnknownMovement, get_movement  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Разобрать попытку и записать debug-ролик")
    parser.add_argument("--movement", required=True)
    parser.add_argument("--video", required=True)
    parser.add_argument("--debug-output", required=True)
    args = parser.parse_args()

    settings = load_settings()
    configure_logging(settings.log_level)
    debug_dir = Path(args.debug_output).expanduser().resolve()
    try:
        movement = get_movement(settings, args.movement)
        profile = load_movement_profile(settings, movement.analysis_profile)
        result = analyze_attempt_video(
            movement_id=movement.id,
            video_path=Path(args.video).expanduser().resolve(),
            settings=settings,
            profile=profile,
            camera_view=movement.camera_view,
            work_dir=debug_dir,
            debug_dir=debug_dir,
        )
    except (UnknownMovement, VideoError, FileNotFoundError) as error:
        print(error)
        return 2
    print(result.message or f"Схожесть с эталоном: {result.similarity}")
    for item in result.feedback:
        print(f"- [{item.severity}] {item.message}")
    return 0 if result.reliable else 2


if __name__ == "__main__":
    sys.exit(main())
