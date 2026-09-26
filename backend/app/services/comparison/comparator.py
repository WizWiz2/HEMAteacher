"""Отклонения по признакам и фазам эталона. Пороги читаются из профиля."""

from __future__ import annotations

import math

import numpy as np

from app.config import ComparisonConfig
from app.domain.models import (
    AlignmentResult,
    AnalysisProfile,
    FeatureSpec,
    Observation,
    PhaseSpan,
    PreparedMotion,
    Severity,
    TimelineMarker,
)


class MotionComparator:
    def __init__(self, comparison: ComparisonConfig):
        self.comparison = comparison

    def compare(
        self,
        reference: PreparedMotion,
        attempt: PreparedMotion,
        alignment: AlignmentResult,
        profile: AnalysisProfile,
    ) -> tuple[list[Observation], list[TimelineMarker], dict, dict, float | None]:
        pairs = alignment.pairs
        if not pairs:
            return [], [], {}, {}, None

        observations: list[Observation] = []
        metrics: dict = {}
        feature_summary: dict = {}
        similarity_weight = 0.0
        similarity_acc = 0.0

        ref_count = max(len(reference.timestamps_ms), 1)
        for name, spec in profile.features.items():
            phase_rows, mean_abs, feature_similarity = self._feature_observations(
                name, spec, reference, attempt, alignment, ref_count
            )
            observations.extend(phase_rows)
            metrics[name] = {
                "label": spec.label or name,
                "unit": spec.unit,
                "weight": spec.weight,
                "mean_abs_delta": None if mean_abs is None else round(mean_abs, 4),
                "phases": {
                    row.phase: {
                        "reference": round(row.reference, 4),
                        "attempt": round(row.attempt, 4),
                        "delta": round(row.delta, 4),
                        "severity": row.severity,
                    }
                    for row in phase_rows
                },
            }
            feature_summary[name] = {
                "unit": spec.unit,
                "mean_abs_delta": None if mean_abs is None else round(mean_abs, 4),
                "severity": _worst(row.severity for row in phase_rows),
                "similarity": None if feature_similarity is None else round(feature_similarity * 100, 1),
            }
            if feature_similarity is not None and spec.weight > 0:
                similarity_weight += spec.weight
                similarity_acc += spec.weight * feature_similarity

        similarity = None
        if similarity_weight > 0:
            similarity = round(100 * similarity_acc / similarity_weight, 1)

        markers = _markers(reference, attempt, alignment, profile)
        return observations, markers, metrics, feature_summary, similarity


    def _feature_observations(
        self,
        name: str,
        spec: FeatureSpec,
        reference: PreparedMotion,
        attempt: PreparedMotion,
        alignment: AlignmentResult,
        ref_count: int,
    ) -> tuple[list[Observation], float | None, float | None]:
        source = spec.source or name
        if spec.reduce == "std":
            ref_values = _active_values(reference, source, reference.phases)
            att_values = _aligned_values(reference, attempt, alignment, source, reference.phases)
            if ref_values.size < 2 or att_values.size < 2:
                return [], None, None
            ref_stat = float(np.nanstd(ref_values))
            att_stat = float(np.nanstd(att_values))
            delta = att_stat - ref_stat
            severity = _severity(abs(delta), spec)
            position = 0.5
            mid = len(alignment.pairs) // 2
            pair = alignment.pairs[mid]
            duration = 1.0
            observation = Observation(
                feature=name,
                phase="overall",
                phase_position=position,
                reference=ref_stat,
                attempt=att_stat,
                delta=delta,
                severity=severity,
                weight=spec.weight,
                duration_fraction=duration,
                unit=spec.unit,
                label=spec.label or name,
                reference_frame=pair.reference_frame,
                attempt_frame=pair.attempt_frame,
                reference_time_ms=pair.reference_time_ms,
                attempt_time_ms=pair.attempt_time_ms,
            )
            mean_abs = abs(delta)
            return [observation], mean_abs, _feature_similarity(mean_abs, spec)

        ref_series = reference.features.get(source)
        att_series = attempt.features.get(source)
        if not ref_series or not att_series:
            return [], None, None

        rows: list[Observation] = []
        abs_samples: list[float] = []
        phases = reference.phases or []
        spans = phases if phases else []
        if not spans:
            spans = [PhaseSpan(name="overall", start_frame=0, end_frame=len(ref_series))]

        for phase in spans:
            ref_samples: list[float] = []
            att_samples: list[float] = []
            rep_pair = None
            for pair in alignment.pairs:
                if not (phase.start_frame <= pair.reference_frame < phase.end_frame):
                    continue
                if pair.reference_frame >= len(ref_series) or pair.attempt_frame >= len(att_series):
                    continue
                ref_value = ref_series[pair.reference_frame]
                att_value = att_series[pair.attempt_frame]
                if not _finite(ref_value) or not _finite(att_value):
                    continue
                ref_samples.append(ref_value)
                att_samples.append(att_value)
                abs_samples.append(abs(att_value - ref_value))
                rep_pair = pair
            if not ref_samples or rep_pair is None:
                continue
            ref_mean = float(np.mean(ref_samples))
            att_mean = float(np.mean(att_samples))
            delta = att_mean - ref_mean
            length = max(phase.end_frame - phase.start_frame, 1)
            duration = length / ref_count
            mid_frame = (phase.start_frame + phase.end_frame - 1) / 2
            rows.append(
                Observation(
                    feature=name,
                    phase=phase.name,
                    phase_position=mid_frame / max(ref_count - 1, 1),
                    reference=ref_mean,
                    attempt=att_mean,
                    delta=delta,
                    severity=_severity(abs(delta), spec),
                    weight=spec.weight,
                    duration_fraction=max(duration, self.comparison.min_duration_fraction),
                    unit=spec.unit,
                    label=spec.label or name,
                    reference_frame=rep_pair.reference_frame,
                    attempt_frame=rep_pair.attempt_frame,
                    reference_time_ms=rep_pair.reference_time_ms,
                    attempt_time_ms=rep_pair.attempt_time_ms,
                )
            )
        mean_abs = float(np.mean(abs_samples)) if abs_samples else None
        return rows, mean_abs, _feature_similarity(mean_abs, spec)


def _aligned_values(reference, attempt, alignment, source, phases) -> np.ndarray:
    series = attempt.features.get(source) or []
    if not phases:
        indexes = range(len(series))
        return np.asarray([series[i] for i in indexes], dtype=float)
    start = min(phase.start_frame for phase in phases)
    end = max(phase.end_frame for phase in phases)
    values = []
    for pair in alignment.pairs:
        if start <= pair.reference_frame < end and pair.attempt_frame < len(series):
            values.append(series[pair.attempt_frame])
    return np.asarray(values, dtype=float)


def _active_values(motion: PreparedMotion, source: str, phases) -> np.ndarray:
    series = motion.features.get(source) or []
    if not phases:
        return np.asarray(series, dtype=float)
    start = min(phase.start_frame for phase in phases)
    end = max(phase.end_frame for phase in phases)
    return np.asarray(series[start:end], dtype=float)


def _severity(abs_delta: float, spec: FeatureSpec) -> Severity:
    major = spec.major_at()
    warn = spec.warn_at()
    if major is not None and abs_delta >= major:
        return "major"
    if warn is not None and abs_delta >= warn:
        return "warning"
    return "info"


def _feature_similarity(mean_abs: float | None, spec: FeatureSpec) -> float | None:
    major = spec.major_at()
    if mean_abs is None or major is None or major <= 0 or spec.weight <= 0:
        return None
    return max(0.0, 1.0 - mean_abs / major)


def _finite(value: float) -> bool:
    return isinstance(value, (int, float)) and math.isfinite(value)


def _worst(severities) -> str:
    order = {"info": 0, "warning": 1, "major": 2}
    best = "info"
    for item in severities:
        if order[item] > order[best]:
            best = item
    return best


def _markers(reference, attempt, alignment, profile: AnalysisProfile) -> list[TimelineMarker]:
    """Сгустки кадров, где хотя бы один признак ушёл за порог предупреждения."""
    scores: list[tuple[float, str, str]] = []
    ref_count = max(len(reference.timestamps_ms) - 1, 1)
    for pair in alignment.pairs:
        worst = 0.0
        feature = ""
        severity = "info"
        for name, spec in profile.features.items():
            if spec.reduce != "mean" or spec.weight <= 0 or spec.warn_at() is None:
                continue
            source = spec.source or name
            ref_series = reference.features.get(source) or []
            att_series = attempt.features.get(source) or []
            if pair.reference_frame >= len(ref_series) or pair.attempt_frame >= len(att_series):
                continue
            ref_value = ref_series[pair.reference_frame]
            att_value = att_series[pair.attempt_frame]
            if not _finite(ref_value) or not _finite(att_value):
                continue
            delta = abs(att_value - ref_value)
            level = _severity(delta, spec)
            rank = {"info": 0, "warning": 1, "major": 2}[level]
            if rank > worst or (rank == worst and rank > 0 and delta > 0 and feature == ""):
                if rank > worst:
                    worst = rank
                    feature = name
                    severity = level
        scores.append((worst, feature, severity))

    markers: list[TimelineMarker] = []
    index = 0
    while index < len(scores):
        rank, _, _ = scores[index]
        if rank < 1:
            index += 1
            continue
        end = index
        while end < len(scores) and scores[end][0] >= 1:
            end += 1
        # Разрываем длинную полосу на куски, если между пиками есть спад... здесь кусок непрерывный.
        peak = index
        for cursor in range(index, end):
            if scores[cursor][0] > scores[peak][0]:
                peak = cursor
        pair = alignment.pairs[peak]
        _, feature, severity = scores[peak]
        markers.append(
            TimelineMarker(
                position=pair.reference_frame / ref_count,
                severity=severity,  # type: ignore[arg-type]
                feature=feature,
                reference_time_ms=pair.reference_time_ms,
                attempt_time_ms=pair.attempt_time_ms,
            )
        )
        index = end
    return markers
