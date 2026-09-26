"""Каталог движений — это YAML в data/movements. Видео эталона лежит рядом, на диске."""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from app.config import Settings
from app.domain.models import MovementDetail, MovementSummary

_MOVEMENT_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


class UnknownMovement(Exception):
    pass


def assert_movement_id(movement_id: str) -> str:
    if not _MOVEMENT_ID.match(movement_id):
        raise UnknownMovement(movement_id)
    return movement_id


def list_movements(settings: Settings) -> list[MovementSummary]:
    summaries = []
    for path in sorted(settings.movements_dir.glob("*.yaml")):
        detail = _read_movement(settings, path)
        summaries.append(
            MovementSummary(
                id=detail.id,
                name=detail.name,
                camera_view=detail.camera_view,
                reference_ready=detail.reference_ready,
            )
        )
    return summaries


def get_movement(settings: Settings, movement_id: str) -> MovementDetail:
    assert_movement_id(movement_id)
    path = settings.movements_dir / f"{movement_id}.yaml"
    if not path.exists():
        raise UnknownMovement(movement_id)
    return _read_movement(settings, path)


def reference_paths(settings: Settings, movement_id: str) -> tuple[Path, Path]:
    folder = settings.references_dir / movement_id
    return folder / "reference.mp4", folder / "normalized_pose.json"


def _read_movement(settings: Settings, path: Path) -> MovementDetail:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    movement_id = raw["id"]
    video, normalized = reference_paths(settings, movement_id)
    ready = video.exists() and normalized.exists()
    duration = None
    meta_path = settings.references_dir / movement_id / "meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        duration = meta.get("duration_ms")
    return MovementDetail(
        id=movement_id,
        name=raw["name"],
        description=str(raw.get("description") or "").strip(),
        camera_view=raw.get("camera_view") or "side",
        analysis_profile=raw.get("analysis_profile") or "footwork_v1",
        reference_ready=ready,
        reference_video_url=f"/api/v1/movements/{movement_id}/video" if ready else None,
        reference_pose_url=f"/api/v1/movements/{movement_id}/pose" if ready else None,
        duration_ms=duration,
    )
