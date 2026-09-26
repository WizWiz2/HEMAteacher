"""Короткие провалы видимости заполняются, длинные остаются дырками."""

from __future__ import annotations

import numpy as np

from app.domain.landmarks import LANDMARK_NAMES
from app.domain.models import Landmark, MotionSequence, PoseFrame


def cleanup_sequence(
    sequence: MotionSequence,
    min_visibility: float,
    max_gap_frames: int,
    smooth_window: int,
) -> MotionSequence:
    frames = [
        PoseFrame(timestamp_ms=frame.timestamp_ms, landmarks={name: landmark.model_copy() for name, landmark in frame.landmarks.items()})
        for frame in sequence.frames
    ]
    count = len(frames)
    for name in LANDMARK_NAMES:
        present = np.zeros(count, dtype=bool)
        coords = np.full((count, 3), np.nan, dtype=float)
        visibility = np.zeros(count, dtype=float)
        for index, frame in enumerate(frames):
            landmark = frame.landmarks.get(name)
            if landmark is None:
                continue
            visibility[index] = landmark.visibility
            if landmark.visibility >= min_visibility:
                present[index] = True
                coords[index] = (landmark.x, landmark.y, landmark.z)
        coords = _fill_gaps(coords, present, max_gap_frames)
        if smooth_window >= 3:
            coords = _smooth(coords, smooth_window)
        for index, frame in enumerate(frames):
            if np.isnan(coords[index, 0]):
                continue
            frame.landmarks[name] = Landmark(
                x=float(coords[index, 0]),
                y=float(coords[index, 1]),
                z=float(coords[index, 2]) if not np.isnan(coords[index, 2]) else 0.0,
                visibility=float(visibility[index] if present[index] else min_visibility),
            )
    return sequence.model_copy(update={"frames": frames})


def _fill_gaps(coords: np.ndarray, present: np.ndarray, max_gap: int) -> np.ndarray:
    filled = coords.copy()
    count = len(present)
    index = 0
    while index < count:
        if present[index]:
            index += 1
            continue
        start = index
        while index < count and not present[index]:
            index += 1
        end = index  # exclusive
        gap = end - start
        left = start - 1
        right = end if end < count and present[end] else None
        if gap <= max_gap and left >= 0 and right is not None:
            for step in range(gap):
                weight = (step + 1) / (gap + 1)
                filled[start + step] = (1 - weight) * coords[left] + weight * coords[right]
    return filled


def _smooth(coords: np.ndarray, window: int) -> np.ndarray:
    """Сглаживает только уже существующие точки и не заполняет дырки."""
    if window < 3:
        return coords
    if window % 2 == 0:
        window += 1
    radius = window // 2
    smoothed = coords.copy()
    count = len(coords)
    min_support = max(2, radius)
    for index in range(count):
        if np.isnan(coords[index, 0]):
            continue
        for column in range(3):
            total = 0.0
            seen = 0
            for other in range(max(0, index - radius), min(count, index + radius + 1)):
                value = coords[other, column]
                if np.isnan(value):
                    continue
                total += float(value)
                seen += 1
            if seen >= min_support:
                smoothed[index, column] = total / seen
    return smoothed
