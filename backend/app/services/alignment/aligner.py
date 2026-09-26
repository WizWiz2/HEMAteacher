"""Выравнивание спрятано за протоколом: сравнение не знает, что внутри DTW."""

from __future__ import annotations

from typing import Protocol

import numpy as np

from app.domain.models import AlignmentPair, AlignmentResult, PreparedMotion
from app.services.alignment.dtw import dtw


class MotionAligner(Protocol):
    def align(self, reference: PreparedMotion, attempt: PreparedMotion) -> AlignmentResult:
        ...


class DtwMotionAligner:
    def __init__(self, feature_names: list[str]):
        self.feature_names = feature_names

    def align(self, reference: PreparedMotion, attempt: PreparedMotion) -> AlignmentResult:
        ref_matrix = _matrix(reference, self.feature_names)
        att_matrix = _matrix(attempt, self.feature_names)
        distance, path = dtw(ref_matrix, att_matrix)
        # Один кадр эталона → один кадр попытки (медиана, если DTW «постоял» на месте).
        buckets: dict[int, list[int]] = {}
        for ref_index, att_index in path:
            buckets.setdefault(ref_index, []).append(att_index)
        pairs: list[AlignmentPair] = []
        for ref_index in range(len(reference.timestamps_ms)):
            choices = buckets.get(ref_index) or [min(ref_index, len(attempt.timestamps_ms) - 1)]
            att_index = int(np.median(choices))
            att_index = max(0, min(att_index, len(attempt.timestamps_ms) - 1))
            pairs.append(
                AlignmentPair(
                    reference_frame=ref_index,
                    attempt_frame=att_index,
                    reference_time_ms=reference.timestamps_ms[ref_index],
                    attempt_time_ms=attempt.timestamps_ms[att_index],
                )
            )
        return AlignmentResult(distance=distance, pairs=pairs)


def _matrix(motion: PreparedMotion, names: list[str]) -> np.ndarray:
    columns = []
    length = len(motion.timestamps_ms)
    for name in names:
        series = motion.features.get(name)
        if series is None or len(series) != length:
            columns.append(np.zeros(length, dtype=float))
            continue
        columns.append(np.asarray(series, dtype=float))
    if not columns:
        return np.zeros((length, 1), dtype=float)
    return np.stack(columns, axis=1)
