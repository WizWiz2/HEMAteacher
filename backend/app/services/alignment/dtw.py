"""Классический DTW без внешней библиотеки.

Перед расстоянием каждый признак делится на разброс эталона, иначе угол в градусах
задавил бы положение стопы. Здесь в выравнивание идут уже однородные признаки.
"""

from __future__ import annotations

import numpy as np


def dtw(reference: np.ndarray, attempt: np.ndarray) -> tuple[float, list[tuple[int, int]]]:
    if reference.ndim != 2 or attempt.ndim != 2:
        raise ValueError("DTW ждёт матрицы формы (кадры, признаки)")
    if len(reference) == 0 or len(attempt) == 0:
        raise ValueError("Пустая последовательность")

    ref, att = _standardize(reference, attempt)
    local = np.linalg.norm(ref[:, None, :] - att[None, :, :], axis=2)
    local = np.nan_to_num(local, nan=0.0, posinf=0.0, neginf=0.0)
    n, m = local.shape
    accumulated = np.empty((n, m), dtype=float)
    accumulated[0, 0] = local[0, 0]
    for i in range(1, n):
        accumulated[i, 0] = local[i, 0] + accumulated[i - 1, 0]
    for j in range(1, m):
        accumulated[0, j] = local[0, j] + accumulated[0, j - 1]
    for i in range(1, n):
        for j in range(1, m):
            accumulated[i, j] = local[i, j] + min(
                accumulated[i - 1, j],
                accumulated[i, j - 1],
                accumulated[i - 1, j - 1],
            )

    i, j = n - 1, m - 1
    path = [(i, j)]
    while i > 0 or j > 0:
        if i == 0:
            j -= 1
        elif j == 0:
            i -= 1
        else:
            choices = (
                (accumulated[i - 1, j - 1], i - 1, j - 1),
                (accumulated[i - 1, j], i - 1, j),
                (accumulated[i, j - 1], i, j - 1),
            )
            _, i, j = min(choices, key=lambda item: item[0])
        path.append((i, j))
    path.reverse()
    distance = float(accumulated[-1, -1] / max(len(path), 1))
    return distance, path


def _standardize(reference: np.ndarray, attempt: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ref = np.nan_to_num(reference.astype(float), nan=0.0)
    att = np.nan_to_num(attempt.astype(float), nan=0.0)
    mean = ref.mean(axis=0)
    std = ref.std(axis=0)
    std[std < 1e-6] = 1.0
    return (ref - mean) / std, (att - mean) / std
