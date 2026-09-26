import numpy as np

from app.services.alignment.dtw import dtw


def test_identical_sequence_has_zero_distance():
    samples = np.linspace(0, 1, 25)
    series = np.stack([np.sin(2 * np.pi * samples), np.cos(2 * np.pi * samples)], axis=1)
    distance, path = dtw(series, series)
    assert distance < 1e-6
    assert path[0] == (0, 0)
    assert path[-1] == (24, 24)
    assert {index for index, _ in path} == set(range(25))


def test_slower_copy_aligns_on_phase_not_frame_number():
    reference_t = np.linspace(0, 2 * np.pi, 30)
    attempt_t = np.linspace(0, 2 * np.pi, 70)
    reference = np.stack([np.sin(reference_t)], axis=1)
    attempt = np.stack([np.sin(attempt_t)], axis=1)
    _distance, path = dtw(reference, attempt)
    reference_peak = int(np.argmax(reference[:, 0]))
    attempt_peak = int(np.argmax(attempt[:, 0]))
    matches = [attempt_index for ref_index, attempt_index in path if ref_index == reference_peak]
    assert matches
    assert min(abs(index - attempt_peak) for index in matches) <= 3
