"""Детерминированные фразы. Модель языка в разбор не входит.

Берём не больше трёх замечаний. У одного признака остаётся только самая заметная фаза,
чтобы колено и «длина ноги» не вытесняли друг друга копиями, а разные признаки — могли.
Порядок: тяжесть × вес признака × доля длительности.
"""

from __future__ import annotations

from app.domain.models import AnalysisProfile, FeedbackItem, Observation, Severity

_SEVERITY_WEIGHT = {"info": 1.0, "warning": 2.0, "major": 3.0}


def select_feedback(observations: list[Observation], profile: AnalysisProfile, limit: int = 3) -> list[FeedbackItem]:
    eligible = [
        item
        for item in observations
        if item.severity in ("warning", "major") and item.weight > 0
    ]
    best_by_feature: dict[str, Observation] = {}
    for item in eligible:
        current = best_by_feature.get(item.feature)
        if current is None or _score(item) > _score(current):
            best_by_feature[item.feature] = item
    ranked = sorted(best_by_feature.values(), key=lambda item: (-_score(item), item.feature))
    return [_to_item(item, profile) for item in ranked[:limit]]


def format_magnitude(delta: float, unit: str) -> str:
    magnitude = abs(delta)
    if unit == "degrees":
        return f"{magnitude:.0f}°"
    if unit == "torso_lengths":
        return f"{magnitude * 100:.0f}% длины корпуса"
    return f"{magnitude:.2f}"


def _score(item: Observation) -> float:
    return _SEVERITY_WEIGHT[item.severity] * item.weight * item.duration_fraction


def _to_item(item: Observation, profile: AnalysisProfile) -> FeedbackItem:
    spec = profile.features.get(item.feature)
    phase_phrase = profile.phases.get(item.phase, item.phase)
    magnitude = format_magnitude(item.delta, item.unit)
    template = None
    if spec is not None:
        template = spec.greater if item.delta >= 0 else spec.less
    if template:
        message = template.format(phase=phase_phrase, magnitude=magnitude, label=item.label)
    else:
        direction = "больше" if item.delta >= 0 else "меньше"
        label = item.label or item.feature
        message = (
            f"{phase_phrase} {label} {direction}, чем в эталоне, примерно на {magnitude}."
        )
    return FeedbackItem(
        severity=item.severity,
        phase=round(item.phase_position, 4),
        phase_name=item.phase,
        feature=item.feature,
        message=message,
    )


def severity_rank(severity: Severity) -> int:
    return {"info": 0, "warning": 1, "major": 2}[severity]
