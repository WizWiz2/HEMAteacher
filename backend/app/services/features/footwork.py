"""Признаки одного кадра. Единицы описаны в docs/FEATURES.md.

Ожидается space=normalized: таз около нуля, +X вперёд, +Y вверх, единица — длина корпуса.
"""

from __future__ import annotations

import math

import numpy as np

from app.domain.geometry import angle_degrees, distance
from app.domain.models import MotionSequence, PoseFrame

PER_FRAME_FEATURES: tuple[str, ...] = (
    "left_ankle_x",
    "left_ankle_y",
    "right_ankle_x",
    "right_ankle_y",
    "left_heel_x",
    "left_heel_y",
    "right_heel_x",
    "right_heel_y",
    "left_toe_x",
    "left_toe_y",
    "right_toe_x",
    "right_toe_y",
    "foot_distance",
    "pelvis_height",
    "left_knee_angle",
    "right_knee_angle",
    "left_hip_angle",
    "right_hip_angle",
    "torso_angle",
    "knee_over_foot_left",
    "knee_over_foot_right",
    "left_leg_extension",
    "right_leg_extension",
    "lateral_foot_distance",
    "shoulder_offset",
)


def extract_features(sequence: MotionSequence, min_visibility: float = 0.5) -> dict[str, list[float]]:
    columns: dict[str, list[float]] = {name: [] for name in PER_FRAME_FEATURES}
    for frame in sequence.frames:
        row = frame_features(frame, min_visibility)
        for name in PER_FRAME_FEATURES:
            columns[name].append(row[name])
    return columns


def frame_features(frame: PoseFrame, min_visibility: float) -> dict[str, float]:
    def xy(name: str) -> np.ndarray | None:
        landmark = frame.landmarks.get(name)
        if landmark is None or landmark.visibility < min_visibility:
            return None
        return np.array([landmark.x, landmark.y, landmark.z], dtype=float)

    def coord(name: str, axis: int) -> float:
        point = xy(name)
        if point is None:
            return math.nan
        return float(point[axis])

    left_ankle = xy("left_ankle")
    right_ankle = xy("right_ankle")
    left_hip = xy("left_hip")
    right_hip = xy("right_hip")
    left_knee = xy("left_knee")
    right_knee = xy("right_knee")
    left_shoulder = xy("left_shoulder")
    right_shoulder = xy("right_shoulder")

    foot_distance = math.nan
    pelvis_height = math.nan
    lateral = math.nan
    if left_ankle is not None and right_ankle is not None:
        foot_distance = distance(left_ankle[:2], right_ankle[:2])
        pelvis_height = float(-0.5 * (left_ankle[1] + right_ankle[1]))
        lateral = abs(float(left_ankle[2] - right_ankle[2]))

    torso_angle = math.nan
    shoulder_offset = math.nan
    if left_hip is not None and right_hip is not None and left_shoulder is not None and right_shoulder is not None:
        hip = (left_hip + right_hip) / 2
        shoulder = (left_shoulder + right_shoulder) / 2
        vector = shoulder - hip
        torso_angle = math.degrees(math.atan2(float(vector[0]), float(vector[1])))
        shoulder_offset = float(vector[0])

    return {
        "left_ankle_x": coord("left_ankle", 0),
        "left_ankle_y": coord("left_ankle", 1),
        "right_ankle_x": coord("right_ankle", 0),
        "right_ankle_y": coord("right_ankle", 1),
        "left_heel_x": coord("left_heel", 0),
        "left_heel_y": coord("left_heel", 1),
        "right_heel_x": coord("right_heel", 0),
        "right_heel_y": coord("right_heel", 1),
        "left_toe_x": coord("left_foot_index", 0),
        "left_toe_y": coord("left_foot_index", 1),
        "right_toe_x": coord("right_foot_index", 0),
        "right_toe_y": coord("right_foot_index", 1),
        "foot_distance": foot_distance,
        "pelvis_height": pelvis_height,
        "left_knee_angle": _joint_angle(left_hip, left_knee, left_ankle),
        "right_knee_angle": _joint_angle(right_hip, right_knee, right_ankle),
        "left_hip_angle": _joint_angle(left_shoulder, left_hip, left_knee),
        "right_hip_angle": _joint_angle(right_shoulder, right_hip, right_knee),
        "torso_angle": torso_angle,
        "knee_over_foot_left": _delta_x(left_knee, left_ankle),
        "knee_over_foot_right": _delta_x(right_knee, right_ankle),
        "left_leg_extension": _segment(left_hip, left_ankle),
        "right_leg_extension": _segment(right_hip, right_ankle),
        "lateral_foot_distance": lateral,
        "shoulder_offset": shoulder_offset,
    }


def _joint_angle(a, b, c) -> float:
    if a is None or b is None or c is None:
        return math.nan
    return angle_degrees(a, b, c)


def _delta_x(knee, ankle) -> float:
    if knee is None or ankle is None:
        return math.nan
    return float(knee[0] - ankle[0])


def _segment(a, b) -> float:
    if a is None or b is None:
        return math.nan
    return distance(a[:2], b[:2])
