from app.domain.geometry import angle_degrees
from app.domain.landmarks import LANDMARK_NAMES
from app.domain.models import Landmark, MotionSequence, PoseFrame
from app.services.features.footwork import extract_features


def test_right_angle_and_straight_leg():
    assert abs(angle_degrees((0, 1, 0), (0, 0, 0), (1, 0, 0)) - 90) < 1e-6
    assert abs(angle_degrees((0, 2, 0), (0, 1, 0), (0, 0, 0)) - 180) < 1e-6


def test_knee_feature_on_synthetic_landmarks():
    landmarks = {name: Landmark(x=0, y=0, z=0, visibility=1) for name in LANDMARK_NAMES}
    landmarks["left_hip"] = Landmark(x=0, y=0, z=0, visibility=1)
    landmarks["left_knee"] = Landmark(x=0, y=-1, z=0, visibility=1)
    landmarks["left_ankle"] = Landmark(x=1, y=-1, z=0, visibility=1)
    sequence = MotionSequence(
        fps=30,
        duration_ms=0,
        frames=[PoseFrame(timestamp_ms=0, landmarks=landmarks)],
        space="normalized",
    )
    features = extract_features(sequence, min_visibility=0.5)
    assert abs(features["left_knee_angle"][0] - 90) < 1e-4
