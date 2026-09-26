"""Синтетический человек в виде сбоку. Локальные координаты: +X вперёд, +Y вверх, единица — корпус."""

from __future__ import annotations

import math

import numpy as np

from app.domain.landmarks import LANDMARK_NAMES
from app.domain.models import Landmark, MotionSequence, PoseFrame


def make_step(
    n_frames: int,
    gain: float = 1.0,
    hip_x: float = 0.48,
    hip_y: float = 0.55,
    torso: float = 0.16,
    face: float = 1.0,
    fps: float = 30.0,
) -> MotionSequence:
    frames: list[PoseFrame] = []
    for index in range(n_frames):
        phase = 0.0 if n_frames == 1 else index / (n_frames - 1)
        local = _locals(phase, gain)
        landmarks = {
            name: _project(point, hip_x, hip_y, torso, face)
            for name, point in local.items()
        }
        frames.append(PoseFrame(timestamp_ms=int(round(index * 1000 / fps)), landmarks=landmarks))
    return MotionSequence(
        fps=fps,
        duration_ms=frames[-1].timestamp_ms if frames else 0,
        frames=frames,
        space="image",
        width=1,
        height=1,
    )


def _locals(phase: float, gain: float) -> dict[str, tuple[float, float, float]]:
    smooth = phase * phase * (3 - 2 * phase)
    left_foot = (0.42 - 0.55 * smooth, -1.0, -0.08)
    right_foot = (-0.40 + 0.75 * gain * smooth, -1.0 + math.sin(phase * math.pi) * 0.15, 0.08)
    left_hip = (0.0, 0.0, -0.11)
    right_hip = (0.0, 0.0, 0.11)
    left_shoulder = (-0.02, 1.0, -0.14)
    right_shoulder = (0.02, 1.0, 0.14)
    nose = (0.18, 1.28, 0.0)
    points: dict[str, tuple[float, float, float]] = {name: nose for name in LANDMARK_NAMES}
    points.update(
        {
            "nose": nose,
            "left_shoulder": left_shoulder,
            "right_shoulder": right_shoulder,
            "left_hip": left_hip,
            "right_hip": right_hip,
            "left_knee": _knee(left_hip, left_foot, 0.045),
            "right_knee": _knee(right_hip, right_foot, 0.045),
            "left_ankle": left_foot,
            "right_ankle": right_foot,
            "left_heel": (left_foot[0] - 0.05, left_foot[1], left_foot[2]),
            "right_heel": (right_foot[0] - 0.05, right_foot[1], right_foot[2]),
            "left_foot_index": (left_foot[0] + 0.07, left_foot[1], left_foot[2]),
            "right_foot_index": (right_foot[0] + 0.07, right_foot[1], right_foot[2]),
        }
    )
    return points


def _knee(hip: tuple[float, float, float], ankle: tuple[float, float, float], bend: float) -> tuple[float, float, float]:
    hip_v = np.array(hip, dtype=float)
    ankle_v = np.array(ankle, dtype=float)
    mid = hip_v * 0.48 + ankle_v * 0.52
    direction = ankle_v - hip_v
    flat = float(np.linalg.norm(direction[:2]))
    if flat < 1e-6:
        return tuple(mid)  # type: ignore[return-value]
    perp = np.array([-direction[1], direction[0], 0.0]) / flat
    if perp[0] < 0:
        perp = -perp
    point = mid + perp * bend
    return float(point[0]), float(point[1]), float(point[2])


def _project(
    local: tuple[float, float, float],
    hip_x: float,
    hip_y: float,
    torso: float,
    face: float,
) -> Landmark:
    return Landmark(
        x=hip_x + face * local[0] * torso,
        y=hip_y - local[1] * torso,
        z=local[2] * torso,
        visibility=0.99,
    )
