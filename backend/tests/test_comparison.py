from app.config import load_profile, load_settings
from app.domain.models import AlignmentPair, AlignmentResult, PhaseSpan, PreparedMotion
from app.services.comparison.comparator import MotionComparator


def test_one_feature_difference_becomes_the_expected_metric():
    settings = load_settings()
    profile = load_profile(settings.profiles_dir / "footwork_v1.yaml")
    reference = _motion(foot=0.8, pelvis=1.0)
    attempt = _motion(foot=1.1, pelvis=1.0)
    alignment = AlignmentResult(
        distance=0,
        pairs=[
            AlignmentPair(
                reference_frame=index,
                attempt_frame=index,
                reference_time_ms=index * 40,
                attempt_time_ms=index * 40,
            )
            for index in range(8)
        ],
    )
    observations, _markers, metrics, _features, similarity = MotionComparator(settings.comparison).compare(
        reference, attempt, alignment, profile
    )
    foot = next(item for item in observations if item.feature == "foot_distance")
    assert abs(foot.delta - 0.3) < 1e-6
    assert foot.severity == "major"
    assert metrics["foot_distance"]["phases"]["landing"]["severity"] == "major"
    assert similarity is not None and similarity < 80


def _motion(foot: float, pelvis: float) -> PreparedMotion:
    count = 8
    return PreparedMotion(
        fps=25,
        timestamps_ms=[index * 40 for index in range(count)],
        features={
            "foot_distance": [foot] * count,
            "pelvis_height": [pelvis] * count,
        },
        phases=[PhaseSpan(name="landing", start_frame=0, end_frame=count)],
    )
