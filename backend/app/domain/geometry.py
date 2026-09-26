"""Углы и расстояния. Угол считается в градусах в точке b для тройки a-b-c."""

from __future__ import annotations

import math

import numpy as np


def angle_degrees(a, b, c) -> float:
    ba = np.asarray(a, dtype=float) - np.asarray(b, dtype=float)
    bc = np.asarray(c, dtype=float) - np.asarray(b, dtype=float)
    denom = float(np.linalg.norm(ba) * np.linalg.norm(bc))
    if denom < 1e-8:
        return float("nan")
    cosine = float(np.dot(ba, bc) / denom)
    cosine = max(-1.0, min(1.0, cosine))
    return math.degrees(math.acos(cosine))


def distance(a, b) -> float:
    delta = np.asarray(a, dtype=float) - np.asarray(b, dtype=float)
    return float(np.linalg.norm(delta))
