"""Фазы шага по скорости стоп. Границы не пересекаются и покрывают весь ролик."""

from __future__ import annotations

import numpy as np

from app.config import SegmentationConfig
from app.domain.models import PhaseSpan


def segment_motion(features: dict[str, list[float]], fps: float, config: SegmentationConfig) -> list[PhaseSpan]:
    count = _length(features)
    if count == 0:
        return []
    if count < 4:
        return [PhaseSpan(name="stride", start_frame=0, end_frame=count)]

    speed = _foot_speed(features, fps, count)
    finite = speed[np.isfinite(speed)]
    if finite.size == 0:
        return _quartiles(count)
    peak = float(np.percentile(finite, config.speed_percentile))
    threshold = max(config.minimum_speed, config.relative_speed * peak)
    active = np.flatnonzero(speed > threshold)
    if active.size == 0:
        return _quartiles(count)

    start = int(active[0])
    end = int(active[-1]) + 1
    foot = np.asarray(features.get("foot_distance", [np.nan] * count), dtype=float)
    window = foot[start:end]
    if window.size == 0 or np.all(~np.isfinite(window)):
        max_stride = (start + end) // 2
    else:
        max_stride = start + int(np.nanargmax(window))
    max_stride = min(max(max_stride, start), count - 1)

    after = np.flatnonzero(speed[max_stride:end] < threshold)
    if after.size:
        plant = max_stride + int(after[0])
    else:
        plant = max_stride + max(1, int(0.45 * (end - max_stride)))
    plant = min(max(plant, max_stride), count)

    labels = ["preparation"] * count
    for index in range(start, max_stride):
        labels[index] = "stride"
    for index in range(max_stride, plant):
        labels[index] = "landing"
    for index in range(max(plant, max_stride), count):
        labels[index] = "completion"
    return _compress(labels)


def _compress(labels: list[str]) -> list[PhaseSpan]:
    phases: list[PhaseSpan] = []
    start = 0
    for index in range(1, len(labels) + 1):
        if index == len(labels) or labels[index] != labels[start]:
            phases.append(PhaseSpan(name=labels[start], start_frame=start, end_frame=index))
            start = index
    return phases


def _foot_speed(features: dict[str, list[float]], fps: float, count: int) -> np.ndarray:
    def series(name: str) -> np.ndarray:
        values = np.asarray(features.get(name, []), dtype=float)
        if len(values) != count:
            return np.zeros(count, dtype=float)
        return np.nan_to_num(values, nan=0.0)

    def speed(x: np.ndarray, y: np.ndarray) -> np.ndarray:
        dx = np.diff(x, prepend=x[0])
        dy = np.diff(y, prepend=y[0])
        return np.hypot(dx, dy) * max(fps, 1.0)

    combined = np.maximum(
        speed(series("left_ankle_x"), series("left_ankle_y")),
        speed(series("right_ankle_x"), series("right_ankle_y")),
    )
    if count >= 5:
        kernel = np.ones(5) / 5
        combined = np.convolve(combined, kernel, mode="same")
    return combined


def _quartiles(count: int) -> list[PhaseSpan]:
    cuts = [0, max(1, count // 4), max(2, count // 2), max(3, (3 * count) // 4), count]
    cuts = sorted(set(min(count, cut) for cut in cuts))
    if cuts[0] != 0:
        cuts.insert(0, 0)
    if cuts[-1] != count:
        cuts.append(count)
    names = ("preparation", "stride", "landing", "completion")
    phases: list[PhaseSpan] = []
    for index, (start, end) in enumerate(zip(cuts, cuts[1:], strict=True)):
        if end <= start:
            continue
        phases.append(PhaseSpan(name=names[min(index, len(names) - 1)], start_frame=start, end_frame=end))
    return phases or [PhaseSpan(name="stride", start_frame=0, end_frame=count)]


def _length(features: dict[str, list[float]]) -> int:
    if not features:
        return 0
    return len(next(iter(features.values())))
