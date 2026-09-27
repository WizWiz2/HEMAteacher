"""Live drill definitions and validation."""

from __future__ import annotations

import re
from typing import Literal

import yaml
from pydantic import BaseModel, Field, model_validator

from app.config import Settings

_DRILL_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


class UnknownDrill(Exception):
    pass


class ConstraintModel(BaseModel):
    target: float | None = None
    tolerance: float | None = None
    min: float | None = None
    max: float | None = None

    @model_validator(mode="after")
    def validate_form(self):
        target_form = self.target is not None or self.tolerance is not None
        range_form = self.min is not None or self.max is not None
        if target_form and range_form:
            raise ValueError("constraint must be target+tolerance OR min+max")
        if target_form:
            if self.target is None or self.tolerance is None:
                raise ValueError("target constraint requires target and tolerance")
            if self.tolerance < 0:
                raise ValueError("tolerance must be >= 0")
            return self
        if range_form:
            if self.min is None or self.max is None:
                raise ValueError("range constraint requires min and max")
            if self.min > self.max:
                raise ValueError("constraint min must be <= max")
            return self
        raise ValueError("empty constraint")


class LandmarkModel(BaseModel):
    x: float
    y: float
    z: float = 0.0
    visibility: float = 1.0


class TargetPoseModel(BaseModel):
    landmarks: dict[str, LandmarkModel]
    sword: dict | None = None


class CheckpointModel(BaseModel):
    id: str
    title: str
    illustrationUrl: str | None = None
    targetPoseId: str | None = None
    targetPose: TargetPoseModel | None = None
    holdMs: int
    smoothingMs: int = 100
    constraints: dict[str, ConstraintModel] = Field(default_factory=dict)
    featureTolerances: dict[str, float] = Field(default_factory=dict)
    weights: dict[str, float] | None = None
    requiredFeatures: list[str] = Field(default_factory=list)
    passThreshold: float = 0.70
    cue: str | None = None

    @model_validator(mode="after")
    def validate_checkpoint(self):
        if self.holdMs < 0:
            raise ValueError("holdMs must be >= 0")
        if self.smoothingMs < 40 or self.smoothingMs > 500:
            raise ValueError("smoothingMs must be between 40 and 500")
        if any(value <= 0 for value in self.featureTolerances.values()):
            raise ValueError("feature tolerances must be > 0")
        if not 0.4 <= self.passThreshold <= 1.0:
            raise ValueError("passThreshold must be between 0.4 and 1.0")
        has_target = self.targetPose is not None or self.targetPoseId is not None
        if not self.constraints and not (has_target and self.featureTolerances):
            raise ValueError("checkpoint needs explicit constraints or target pose + feature tolerances")
        return self


class DrillModel(BaseModel):
    id: str
    name: str
    description: str
    cameraView: Literal["side"] = "side"
    category: Literal["footwork", "guards", "meisterhau"] = "footwork"
    trackingMode: Literal["full_body", "upper_body"] = "full_body"
    weaponTracking: Literal["none", "optional"] = "none"
    unvalidated: bool = True
    limitations: list[str] = Field(default_factory=list)
    checkpoints: list[CheckpointModel]
    transitions: list[dict] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_drill(self):
        if not self.checkpoints:
            raise ValueError("drill must contain at least one checkpoint")
        ids = [item.id for item in self.checkpoints]
        if len(ids) != len(set(ids)):
            raise ValueError("checkpoint ids must be unique")
        return self


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


def _read(path):
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return DrillModel.model_validate(raw)
