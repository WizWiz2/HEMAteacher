"""Описания живых упражнений. Число контрольных точек берётся из файла, не из кода."""

from __future__ import annotations

import re
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from app.config import Settings

_DRILL_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


class UnknownDrill(Exception):
    pass


class ConstraintModel(BaseModel):
    target: float | None = None
    tolerance: float | None = None
    min: float | None = None
    max: float | None = None


class CheckpointModel(BaseModel):
    id: str
    title: str
    illustrationUrl: str | None = None
    holdMs: int
    constraints: dict[str, ConstraintModel]
    weights: dict[str, float] | None = None


class DrillModel(BaseModel):
    id: str
    name: str
    description: str
    cameraView: str = "side"
    unvalidated: bool = True
    checkpoints: list[CheckpointModel] = Field(default_factory=list)
    transitions: list[dict] = Field(default_factory=list)


def list_drills(settings: Settings) -> list[DrillModel]:
    folder = settings.data_dir / "drills"
    if not folder.exists():
        return []
    return [_read(path) for path in sorted(folder.glob("*.yaml"))]


def get_drill(settings: Settings, drill_id: str) -> DrillModel:
    if not _DRILL_ID.match(drill_id):
        raise UnknownDrill(drill_id)
    path = settings.data_dir / "drills" / f"{drill_id}.yaml"
    if not path.exists():
        raise UnknownDrill(drill_id)
    return _read(path)


def _read(path: Path) -> DrillModel:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return DrillModel.model_validate(raw)
