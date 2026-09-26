import numpy as np

from app.domain.models import AlignmentPair, AlignmentResult, Landmark, MotionSequence, PhaseSpan, PoseFrame
from app.services.debug_render import render_comparison_video
from app.services.video.io import probe_video, write_frames


def test_probe_roundtrip(tmp_path):
    path = tmp_path / "tiny.avi"
    frame = np.zeros((24, 32, 3), dtype=np.uint8)
    frame[:, :, 1] = 40
    write_frames(path, [frame, frame, frame, frame], 10)
    fps, width, height, count = probe_video(path)
    assert width == 32
    assert height == 24
    assert count >= 1
    assert fps > 0


def test_comparison_video_is_written(tmp_path):
    sequence = _sequence()
    alignment = AlignmentResult(
        distance=0.1,
        pairs=[
            AlignmentPair(reference_frame=0, attempt_frame=0, reference_time_ms=0, attempt_time_ms=0),
            AlignmentPair(reference_frame=1, attempt_frame=1, reference_time_ms=40, attempt_time_ms=80),
        ],
    )
    output = tmp_path / "comparison.mp4"
    render_comparison_video(
        sequence,
        sequence,
        alignment,
        [PhaseSpan(name="stride", start_frame=0, end_frame=2)],
        ["foot_distance landing +0.20 major"],
        output,
    )
    assert output.exists()
    assert output.stat().st_size > 500


def _sequence() -> MotionSequence:
    def frame(timestamp: int, ankle_x: float) -> PoseFrame:
        landmarks = {
            "left_hip": Landmark(x=-0.1, y=0, z=0, visibility=1),
            "right_hip": Landmark(x=0.1, y=0, z=0, visibility=1),
            "left_shoulder": Landmark(x=-0.12, y=1, z=0, visibility=1),
            "right_shoulder": Landmark(x=0.12, y=1, z=0, visibility=1),
            "left_knee": Landmark(x=-0.05, y=-0.5, z=0, visibility=1),
            "right_knee": Landmark(x=0.2, y=-0.45, z=0, visibility=1),
            "left_ankle": Landmark(x=-0.2, y=-1, z=0, visibility=1),
            "right_ankle": Landmark(x=ankle_x, y=-0.95, z=0, visibility=1),
            "nose": Landmark(x=0.2, y=1.3, z=0, visibility=1),
        }
        return PoseFrame(timestamp_ms=timestamp, landmarks=landmarks)

    return MotionSequence(
        fps=25,
        duration_ms=40,
        frames=[frame(0, 0.3), frame(40, 0.6)],
        space="normalized",
        width=1,
        height=1,
    )
