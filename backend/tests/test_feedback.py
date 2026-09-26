from app.config import load_profile, load_settings
from app.domain.models import Observation
from app.services.feedback.engine import select_feedback


def test_known_differences_produce_reference_worded_feedback_capped_at_three():
    profile = load_profile(load_settings().profiles_dir / "footwork_v1.yaml")
    observations = [
        _obs("foot_distance", "major", 1.0, 0.4, 0.3, "landing", 0.7),
        _obs("foot_distance", "warning", 1.0, 0.2, 0.13, "stride", 0.3),
        _obs("torso_angle", "warning", 0.75, 0.5, 9, "stride", 0.4),
        _obs("pelvis_height", "major", 0.7, 0.2, 0.15, "stride", 0.45),
        _obs("left_knee_angle", "warning", 0.6, 0.3, -14, "landing", 0.7),
        _obs("right_knee_angle", "info", 0.6, 1.0, 4, "landing", 0.7),
    ]
    feedback = select_feedback(observations, profile, limit=3)
    assert [item.feature for item in feedback] == ["foot_distance", "torso_angle", "pelvis_height"]
    assert len(feedback) == 3
    for item in feedback:
        assert "эталон" in item.message
        assert "неправильн" not in item.message.lower()
    assert feedback[0].severity == "major"
    assert "расстояние между стопами" in feedback[0].message
    assert "больше" in feedback[0].message


def _obs(feature, severity, weight, duration, delta, phase, position) -> Observation:
    return Observation(
        feature=feature,
        phase=phase,
        phase_position=position,
        reference=1.0,
        attempt=1.0 + delta,
        delta=delta,
        severity=severity,
        weight=weight,
        duration_fraction=duration,
        unit="degrees" if "angle" in feature else "torso_lengths",
        label=feature,
        reference_frame=4,
        attempt_frame=4,
        reference_time_ms=400,
        attempt_time_ms=400,
    )
