"""Загрузка settings.yaml и профилей анализа. Числа не размазаны по коду."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from app.domain.models import AnalysisProfile, FeatureSpec


def repo_root() -> Path:
    env = os.environ.get("HEMA_ROOT")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "config" / "settings.yaml").exists() and (parent / "data").exists():
            return parent
    return Path.cwd()


class VideoConfig(BaseModel):
    max_mb: int = 80
    max_duration_s: float = 20
    min_duration_s: float = 0.45
    transcode: bool = True


class PoseConfig(BaseModel):
    num_poses: int = 2
    min_pose_detection_confidence: float = 0.5
    min_pose_presence_confidence: float = 0.5
    min_tracking_confidence: float = 0.5
    max_frame_width: int = 960
    model_path: str = "backend/models/pose_landmarker_full.task"


class PoseQualityConfig(BaseModel):
    minimum_valid_frame_ratio: float = 0.85
    minimum_landmark_visibility: float = 0.5
    max_foot_outside_ratio: float = 0.2
    max_body_outside_ratio: float = 0.2
    outside_frame_margin: float = 0.015
    max_second_person_ratio: float = 0.12
    side_view_max_shoulder_ratio: float = 0.62
    max_view_ratio_swing: float = 0.45
    minimum_travel: float = 0.2
    min_scale_fraction: float = 0.04
    max_gap_frames: int = 4


class ProcessingConfig(BaseModel):
    smooth_window: int = 3


class OrientationConfig(BaseModel):
    mirror: str = "auto"


class SegmentationConfig(BaseModel):
    speed_percentile: float = 95
    relative_speed: float = 0.22
    minimum_speed: float = 0.25


class ComparisonConfig(BaseModel):
    min_duration_fraction: float = 0.05


class Settings(BaseModel):
    log_level: str = "INFO"
    data_dir: Path
    config_dir: Path
    model_path: Path
    video: VideoConfig = Field(default_factory=VideoConfig)
    pose: PoseConfig = Field(default_factory=PoseConfig)
    pose_quality: PoseQualityConfig = Field(default_factory=PoseQualityConfig)
    processing: ProcessingConfig = Field(default_factory=ProcessingConfig)
    orientation: OrientationConfig = Field(default_factory=OrientationConfig)
    segmentation: SegmentationConfig = Field(default_factory=SegmentationConfig)
    comparison: ComparisonConfig = Field(default_factory=ComparisonConfig)

    @property
    def database_path(self) -> Path:
        return self.data_dir / "coach.sqlite"

    @property
    def movements_dir(self) -> Path:
        return self.data_dir / "movements"

    @property
    def profiles_dir(self) -> Path:
        return self.data_dir / "profiles"

    @property
    def references_dir(self) -> Path:
        return self.data_dir / "references"

    @property
    def sessions_dir(self) -> Path:
        return self.data_dir / "sessions"


def load_settings() -> Settings:
    root = repo_root()
    config_path = Path(os.environ.get("HEMA_CONFIG", root / "config" / "settings.yaml"))
    raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    data_dir = Path(os.environ.get("HEMA_DATA", root / "data"))
    pose = PoseConfig.model_validate(raw.get("pose") or {})
    model_path = Path(os.environ.get("HEMA_MODEL", root / pose.model_path))
    return Settings(
        log_level=raw.get("log_level", "INFO"),
        data_dir=data_dir,
        config_dir=config_path.parent,
        model_path=model_path,
        video=VideoConfig.model_validate(raw.get("video") or {}),
        pose=pose,
        pose_quality=PoseQualityConfig.model_validate(raw.get("pose_quality") or {}),
        processing=ProcessingConfig.model_validate(raw.get("processing") or {}),
        orientation=OrientationConfig.model_validate(raw.get("orientation") or {}),
        segmentation=SegmentationConfig.model_validate(raw.get("segmentation") or {}),
        comparison=ComparisonConfig.model_validate(raw.get("comparison") or {}),
    )


def load_profile(path: Path) -> AnalysisProfile:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    scale = raw.get("scale") or {}
    features = {
        name: FeatureSpec.model_validate(spec)
        for name, spec in (raw.get("features") or {}).items()
    }
    return AnalysisProfile(
        id=raw["id"],
        scale_strategy=scale.get("strategy", "torso_length"),
        scale_scope=scale.get("scope", "sequence"),
        dtw_features=list(raw.get("dtw_features") or []),
        phases=dict(raw.get("phases") or {}),
        features=features,
    )


@lru_cache(maxsize=16)
def load_profile_cached(path_str: str) -> AnalysisProfile:
    return load_profile(Path(path_str))
