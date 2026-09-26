"""Имена точек MediaPipe Pose (33) и рёбра скелета.

Внутри экстрактора индексы числовые. Дальше по коду — только эти имена.
"""

from __future__ import annotations

import numpy as np

LANDMARK_NAMES: tuple[str, ...] = (
    "nose",
    "left_eye_inner",
    "left_eye",
    "left_eye_outer",
    "right_eye_inner",
    "right_eye",
    "right_eye_outer",
    "left_ear",
    "right_ear",
    "mouth_left",
    "mouth_right",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_pinky",
    "right_pinky",
    "left_index",
    "right_index",
    "left_thumb",
    "right_thumb",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
    "left_heel",
    "right_heel",
    "left_foot_index",
    "right_foot_index",
)

NAME_TO_INDEX: dict[str, int] = {name: index for index, name in enumerate(LANDMARK_NAMES)}

REQUIRED_LANDMARKS: tuple[str, ...] = (
    "nose",
    "left_shoulder",
    "right_shoulder",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
)

BODY_LANDMARKS: tuple[str, ...] = ("nose", "left_shoulder", "right_shoulder", "left_hip", "right_hip")

FOOT_LANDMARKS: tuple[str, ...] = (
    "left_ankle",
    "right_ankle",
    "left_heel",
    "right_heel",
    "left_foot_index",
    "right_foot_index",
)

POSE_EDGES: tuple[tuple[str, str], ...] = (
    ("left_shoulder", "right_shoulder"),
    ("left_shoulder", "left_hip"),
    ("right_shoulder", "right_hip"),
    ("left_hip", "right_hip"),
    ("left_shoulder", "left_elbow"),
    ("left_elbow", "left_wrist"),
    ("right_shoulder", "right_elbow"),
    ("right_elbow", "right_wrist"),
    ("left_hip", "left_knee"),
    ("left_knee", "left_ankle"),
    ("left_ankle", "left_heel"),
    ("left_heel", "left_foot_index"),
    ("left_ankle", "left_foot_index"),
    ("right_hip", "right_knee"),
    ("right_knee", "right_ankle"),
    ("right_ankle", "right_heel"),
    ("right_heel", "right_foot_index"),
    ("right_ankle", "right_foot_index"),
    ("left_shoulder", "nose"),
    ("right_shoulder", "nose"),
)


def pixel_point(landmark, width: float, height: float) -> np.ndarray:
    """Перевод в пиксели. z у MediaPipe примерно в масштабе x (доля ширины)."""
    return np.array(
        [landmark.x * width, landmark.y * height, landmark.z * width],
        dtype=float,
    )
