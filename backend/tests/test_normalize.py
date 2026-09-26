from app.services.normalization.normalizer import normalize_sequence
from tests.synthetic import make_step

_NAMES = ("nose", "left_shoulder", "right_shoulder", "left_ankle", "right_ankle", "left_knee", "right_knee")


def test_shift_scale_and_mirror_collapse_to_the_same_pose():
    original = make_step(n_frames=12, gain=1, hip_x=0.42, hip_y=0.52, torso=0.12, face=1)
    moved = make_step(n_frames=12, gain=1, hip_x=0.57, hip_y=0.48, torso=0.2, face=-1)
    left = normalize_sequence(original, strategy="torso_length", scope="sequence", mirror="auto")
    right = normalize_sequence(moved, strategy="torso_length", scope="sequence", mirror="auto")

    assert left.space == "normalized"
    for frame_a, frame_b in zip(left.frames, right.frames, strict=True):
        hip_x = (frame_a.landmarks["left_hip"].x + frame_a.landmarks["right_hip"].x) / 2
        hip_y = (frame_a.landmarks["left_hip"].y + frame_a.landmarks["right_hip"].y) / 2
        assert abs(hip_x) < 1e-6
        assert abs(hip_y) < 1e-6
        for name in _NAMES:
            assert abs(frame_a.landmarks[name].x - frame_b.landmarks[name].x) < 1e-5
            assert abs(frame_a.landmarks[name].y - frame_b.landmarks[name].y) < 1e-5
        # Человек смотрит в +X: нос впереди таза.
        assert frame_a.landmarks["nose"].x > 0.05
