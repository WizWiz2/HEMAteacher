"""Один раз разобрать эталон и положить его в data/references/<movement>/.

python scripts/import_reference.py --movement passing-step-forward --video ./reference.mp4
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from _bootstrap import bootstrap

bootstrap()

from app.config import load_settings  # noqa: E402
from app.logging_config import configure_logging  # noqa: E402
from app.services.pipeline import import_reference_video, load_movement_profile  # noqa: E402
from app.services.video.io import VideoError  # noqa: E402
from app.storage.library import UnknownMovement, get_movement  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Импортировать эталонное видео движения")
    parser.add_argument("--movement", required=True)
    parser.add_argument("--video", required=True)
    args = parser.parse_args()

    settings = load_settings()
    configure_logging(settings.log_level)
    try:
        movement = get_movement(settings, args.movement)
        profile = load_movement_profile(settings, movement.analysis_profile)
        result = import_reference_video(
            movement_id=movement.id,
            video_path=Path(args.video).expanduser().resolve(),
            settings=settings,
            profile=profile,
            camera_view=movement.camera_view,
        )
    except (UnknownMovement, VideoError, FileNotFoundError) as error:
        print(error)
        return 2
    if not result.reliable:
        print(result.message)
        return 2
    print(f"Эталон «{movement.name}» сохранён в {settings.references_dir / movement.id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
