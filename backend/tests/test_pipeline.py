import numpy as np

from app.config import load_profile, load_settings
from app.services.pipeline import analyze_image_sequences
from app.services.pose.quality import assess_capture_quality
from tests.synthetic import make_step


def test_bad_input_does_not_invent_a_similarity():
    settings = load_settings()
    attempt = make_step(30, gain=1)
    for frame in attempt.frames:
        for name in ("right_ankle", "right_heel", "right_foot_index"):
            frame.landmarks[name].visibility = 0
    quality = assess_capture_quality(
        attempt,
        settings.pose_quality,
        camera_view="side",
        min_duration_s=settings.video.min_duration_s,
        max_duration_s=settings.video.max_duration_s,
    )
    assert quality.reliable is False
    assert any("стоп" in reason.lower() for reason in quality.reasons)

    reference = make_step(30, gain=1)
    profile = load_profile(settings.profiles_dir / "footwork_v1.yaml")
    result, _ref, _att, alignment = analyze_image_sequences(reference, attempt, profile, settings)
    assert result.reliable is False
    assert result.similarity is None
    assert result.feedback == []
    assert alignment is None
    assert "надёжно" in (result.message or "")


def test_close_attempt_beats_exaggerated_one_and_slow_attempt_aligns():
    settings = load_settings()
    profile = load_profile(settings.profiles_dir / "footwork_v1.yaml")
    reference = make_step(36, gain=1.0, hip_x=0.48, hip_y=0.55, torso=0.16, face=1)
    good = make_step(36, gain=1.0, hip_x=0.40, hip_y=0.50, torso=0.11, face=-1)
    bad = make_step(36, gain=1.8, hip_x=0.48, hip_y=0.55, torso=0.16, face=1)
    slow = make_step(78, gain=1.0, hip_x=0.52, hip_y=0.58, torso=0.18, face=1)

    good_result, good_ref, good_att, _good_alignment = analyze_image_sequences(reference, good, profile, settings)
    bad_result, _bad_ref, bad_att, _bad_alignment = analyze_image_sequences(reference, bad, profile, settings)
    _slow_result, ref_prep, slow_prep, slow_alignment = analyze_image_sequences(reference, slow, profile, settings)

    assert good_att.quality.reliable, good_att.quality.reasons
    assert bad_att.quality.reliable, bad_att.quality.reasons
    assert slow_prep is not None and slow_prep.quality.reliable, slow_prep.quality.reasons
    assert good_result.reliable and bad_result.reliable
    assert good_result.similarity is not None and bad_result.similarity is not None
    assert good_result.similarity > bad_result.similarity, (good_result.similarity, bad_result.similarity)
    assert len(bad_result.feedback) <= 3
    assert bad_result.feedback, bad_result.largest_deviations
    foot_features = {
        "foot_distance",
        "left_ankle_x",
        "right_ankle_x",
        "left_heel_x",
        "right_heel_x",
        "left_toe_x",
        "right_toe_x",
    }
    assert any(item.feature in foot_features for item in bad_result.feedback)
    for item in bad_result.feedback:
        assert "эталон" in item.message

    assert slow_alignment is not None and ref_prep.prepared and slow_prep.prepared
    reference_y = np.asarray(ref_prep.prepared.features["right_ankle_y"])
    attempt_y = np.asarray(slow_prep.prepared.features["right_ankle_y"])
    reference_peak = int(np.nanargmax(reference_y))
    attempt_peak = int(np.nanargmax(attempt_y))
    mapped = next(pair.attempt_frame for pair in slow_alignment.pairs if pair.reference_frame == reference_peak)
    assert abs(mapped - attempt_peak) <= 5, (mapped, attempt_peak, reference_peak)
    # Кадр с пиком подъёма стопы не должен сравниваться «в лоб» с тем же номером.
    assert attempt_peak != reference_peak
