"""Сырые координаты кадра для сравнения не годятся.

После нормализации:
- начало координат — середина бёдер;
- +X смотрит туда же, куда нос (вперёд человека);
- +Y вверх (ось кадра перевёрнута);
- единица длины — выбранный размер тела, по умолчанию длина корпуса на всю запись.

Масштаб берётся по последовательности, а не по каждому кадру: иначе сгиб ноги
съел бы как раз тот признак, который мы хотим увидеть.
"""

from __future__ import annotations

import numpy as np

from app.domain.landmarks import LANDMARK_NAMES, pixel_point
from app.domain.models import Landmark, MotionSequence, PoseFrame

_STRATEGIES = ("torso_length", "shoulder_width", "hip_width", "leg_length")


def normalize_sequence(
    sequence: MotionSequence,
    strategy: str = "torso_length",
    scope: str = "sequence",
    mirror: str = "auto",
    min_visibility: float = 0.5,
) -> MotionSequence:
    if strategy not in _STRATEGIES:
        raise ValueError(f"Неизвестная стратегия масштаба: {strategy}")
    if scope not in ("sequence", "frame"):
        raise ValueError(f"Неизвестная область масштаба: {scope}")

    width = float(max(sequence.width, 1))
    height = float(max(sequence.height, 1))
    measures: list[float] = []
    facing_samples: list[float] = []
    prepared: list[dict[str, np.ndarray] | None] = []

    for frame in sequence.frames:
        points = _frame_points(frame, width, height, min_visibility)
        prepared.append(points)
        if points is None:
            continue
        measure = _measure(points, strategy)
        if measure is not None and measure > 1e-6:
            measures.append(measure)
        nose = points.get("nose")
        if nose is not None and "left_hip" in points and "right_hip" in points:
            hip_x = (points["left_hip"][0] + points["right_hip"][0]) / 2
            facing_samples.append(float(nose[0] - hip_x))

    sequence_scale = float(np.median(measures)) if measures else float("nan")
    face = _facing_sign(facing_samples, mirror)

    normalized_frames: list[PoseFrame] = []
    for frame, points in zip(sequence.frames, prepared, strict=True):
        landmarks: dict[str, Landmark] = {}
        scale = sequence_scale
        if points is not None and scope == "frame":
            measured = _measure(points, strategy)
            if measured is not None and measured > 1e-6:
                scale = measured
        if points is None or not np.isfinite(scale) or scale <= 1e-6:
            normalized_frames.append(PoseFrame(timestamp_ms=frame.timestamp_ms, landmarks={}))
            continue
        root = (points["left_hip"] + points["right_hip"]) / 2
        for name in LANDMARK_NAMES:
            source = frame.landmarks.get(name)
            point = points.get(name)
            if source is None or point is None:
                continue
            shifted = point - root
            landmarks[name] = Landmark(
                x=float(shifted[0] / scale * face),
                y=float(-shifted[1] / scale),
                z=float(shifted[2] / scale),
                visibility=float(source.visibility),
            )
        normalized_frames.append(PoseFrame(timestamp_ms=frame.timestamp_ms, landmarks=landmarks))

    return sequence.model_copy(update={"frames": normalized_frames, "space": "normalized"})


def _frame_points(
    frame: PoseFrame,
    width: float,
    height: float,
    min_visibility: float,
) -> dict[str, np.ndarray] | None:
    left = frame.landmarks.get("left_hip")
    right = frame.landmarks.get("right_hip")
    if left is None or right is None:
        return None
    if left.visibility < min_visibility or right.visibility < min_visibility:
        return None
    points: dict[str, np.ndarray] = {}
    for name, landmark in frame.landmarks.items():
        if landmark.visibility < min_visibility:
            continue
        points[name] = pixel_point(landmark, width, height)
    if "left_hip" not in points or "right_hip" not in points:
        return None
    return points


def _measure(points: dict[str, np.ndarray], strategy: str) -> float | None:
    def length(a: str, b: str) -> float | None:
        if a not in points or b not in points:
            return None
        return float(np.linalg.norm((points[a] - points[b])[:2]))

    if strategy == "shoulder_width":
        return length("left_shoulder", "right_shoulder")
    if strategy == "hip_width":
        return length("left_hip", "right_hip")
    if strategy == "leg_length":
        left = length("left_hip", "left_ankle")
        right = length("right_hip", "right_ankle")
        values = [item for item in (left, right) if item is not None]
        if not values:
            return None
        return float(np.mean(values))
    if not {"left_shoulder", "right_shoulder", "left_hip", "right_hip"} <= points.keys():
        return None
    shoulder = (points["left_shoulder"] + points["right_shoulder"]) / 2
    hip = (points["left_hip"] + points["right_hip"]) / 2
    return float(np.linalg.norm((shoulder - hip)[:2]))


def _facing_sign(samples: list[float], mirror: str) -> float:
    if mirror == "force":
        return -1.0
    if mirror == "none" or not samples:
        return 1.0
    median = float(np.median(samples))
    # Нос почти на одной вертикали с тазом — не гадаем.
    if abs(median) < 1e-3:
        return 1.0
    return 1.0 if median > 0 else -1.0
