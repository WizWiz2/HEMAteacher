"""Модели, которые уходят в JSON и в API. Без зависимости от OpenCV и MediaPipe."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["info", "warning", "major"]
SessionStatus = Literal[
    "uploaded",
    "extracting_pose",
    "normalizing",
    "aligning",
    "analyzing",
    "completed",
    "failed",
]


class Landmark(BaseModel):
    x: float
    y: float
    z: float = 0.0
    visibility: float = 0.0


class PoseFrame(BaseModel):
    timestamp_ms: int
    landmarks: dict[str, Landmark] = Field(default_factory=dict)


class QualityReport(BaseModel):
    frames_total: int
    frames_valid: int
    pose_detection_ratio: float
    low_confidence_landmarks: list[str] = Field(default_factory=list)
    reliable: bool = False
    reasons: list[str] = Field(default_factory=list)


class MotionSequence(BaseModel):
    fps: float
    duration_ms: int
    frames: list[PoseFrame]
    quality: QualityReport | None = None
    # image — координаты кадра 0..1, y вниз. normalized — таз в нуле, +x вперёд, +y вверх.
    space: Literal["image", "normalized"] = "image"
    width: int = 1
    height: int = 1
    second_person_ratio: float = 0.0


class PhaseSpan(BaseModel):
    name: str
    start_frame: int
    end_frame: int  # не включая


class FeatureSpec(BaseModel):
    weight: float = 1.0
    warning_threshold: float | None = None
    major_threshold: float | None = None
    warning_threshold_deg: float | None = None
    major_threshold_deg: float | None = None
    unit: str = "torso_lengths"
    label: str = ""
    source: str | None = None
    reduce: Literal["mean", "std"] = "mean"
    greater: str | None = None
    less: str | None = None

    def warn_at(self) -> float | None:
        if self.warning_threshold_deg is not None:
            return self.warning_threshold_deg
        return self.warning_threshold

    def major_at(self) -> float | None:
        if self.major_threshold_deg is not None:
            return self.major_threshold_deg
        return self.major_threshold


class AnalysisProfile(BaseModel):
    id: str
    scale_strategy: str = "torso_length"
    scale_scope: str = "sequence"
    dtw_features: list[str]
    phases: dict[str, str]
    features: dict[str, FeatureSpec]


class PreparedMotion(BaseModel):
    fps: float
    timestamps_ms: list[int]
    features: dict[str, list[float]]
    phases: list[PhaseSpan]


class Observation(BaseModel):
    feature: str
    phase: str
    phase_position: float
    reference: float
    attempt: float
    delta: float
    severity: Severity
    weight: float
    duration_fraction: float
    unit: str
    label: str
    reference_frame: int
    attempt_frame: int
    reference_time_ms: int
    attempt_time_ms: int


class FeedbackItem(BaseModel):
    severity: Severity
    phase: float
    phase_name: str
    feature: str
    message: str


class TimelineMarker(BaseModel):
    position: float
    severity: Severity
    feature: str
    reference_time_ms: int
    attempt_time_ms: int


class AlignmentPair(BaseModel):
    reference_frame: int
    attempt_frame: int
    reference_time_ms: int
    attempt_time_ms: int


class AlignmentResult(BaseModel):
    distance: float
    pairs: list[AlignmentPair]


class ComparisonResult(BaseModel):
    movement_id: str | None = None
    reliable: bool
    message: str | None = None
    similarity: float | None = None
    quality: dict = Field(default_factory=dict)
    feedback: list[FeedbackItem] = Field(default_factory=list)
    alignment: list[AlignmentPair] = Field(default_factory=list)
    metrics: dict = Field(default_factory=dict)
    largest_deviations: list[dict] = Field(default_factory=list)
    timeline_markers: list[TimelineMarker] = Field(default_factory=list)
    features: dict = Field(default_factory=dict)


class MovementSummary(BaseModel):
    id: str
    name: str
    camera_view: str
    reference_ready: bool = False


class MovementDetail(BaseModel):
    id: str
    name: str
    description: str
    camera_view: str
    analysis_profile: str
    reference_ready: bool
    reference_video_url: str | None = None
    reference_pose_url: str | None = None
    duration_ms: int | None = None


class SessionInfo(BaseModel):
    id: str
    movement_id: str
    created_at: str
    status: SessionStatus
    error_reason: str | None = None
