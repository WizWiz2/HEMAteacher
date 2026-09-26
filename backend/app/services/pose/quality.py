"""Проверка, можно ли вообще сравнивать запись. Плохой вход не превращается в оценку."""

from __future__ import annotations

import numpy as np

from app.config import PoseQualityConfig
from app.domain.landmarks import BODY_LANDMARKS, REQUIRED_LANDMARKS, pixel_point
from app.domain.models import Landmark, MotionSequence, PoseFrame, QualityReport


def _get(frame: PoseFrame, name: str) -> Landmark | None:
    landmark = frame.landmarks.get(name)
    return landmark


def _visible(landmark: Landmark | None, minimum: float) -> bool:
    return landmark is not None and landmark.visibility >= minimum


def _outside(landmark: Landmark, margin: float) -> bool:
    return (
        landmark.x < margin
        or landmark.x > 1.0 - margin
        or landmark.y < margin
        or landmark.y > 1.0 - margin
    )


def _percent(part: int, total: int) -> int:
    if total <= 0:
        return 0
    return int(round(100 * part / total))


def assess_capture_quality(
    sequence: MotionSequence,
    quality: PoseQualityConfig,
    camera_view: str,
    min_duration_s: float,
    max_duration_s: float,
) -> QualityReport:
    frames = sequence.frames
    total = len(frames)
    reasons: list[str] = []
    minimum_vis = quality.minimum_landmark_visibility

    if total == 0:
        return QualityReport(
            frames_total=0,
            frames_valid=0,
            pose_detection_ratio=0.0,
            reliable=False,
            reasons=["В видео не удалось прочитать ни одного кадра."],
        )

    duration_s = sequence.duration_ms / 1000 if sequence.duration_ms else total / max(sequence.fps, 1)
    if duration_s < min_duration_s:
        reasons.append(
            f"Запись слишком короткая ({duration_s:.1f} с). Нужно хотя бы {min_duration_s:.1f} с."
        )
    if duration_s > max_duration_s:
        reasons.append(
            f"Запись длиннее {max_duration_s:.0f} с. Обрежьте её до одного движения."
        )

    valid_flags: list[bool] = []
    low_counts: dict[str, int] = {name: 0 for name in REQUIRED_LANDMARKS}
    foot_outside = {"left": 0, "right": 0}
    body_outside = 0
    shoulder_ratios: list[float] = []
    torso_lengths: list[float] = []
    width = max(sequence.width, 1)
    height = max(sequence.height, 1)
    # Доля кадра: длина корпуса / длинную сторону, чтобы порог не зависел от разрешения.
    long_side = float(max(width, height))

    for frame in frames:
        present = all(_visible(_get(frame, name), minimum_vis) for name in REQUIRED_LANDMARKS)
        valid_flags.append(present)
        for name in REQUIRED_LANDMARKS:
            if not _visible(_get(frame, name), minimum_vis):
                low_counts[name] += 1

        for side, ankle_name in (("left", "left_ankle"), ("right", "right_ankle")):
            ankle = _get(frame, ankle_name)
            if ankle is None or not _visible(ankle, minimum_vis) or _outside(ankle, quality.outside_frame_margin):
                foot_outside[side] += 1

        body_bad = False
        for name in BODY_LANDMARKS:
            landmark = _get(frame, name)
            if landmark is None or not _visible(landmark, minimum_vis) or _outside(
                landmark, quality.outside_frame_margin
            ):
                body_bad = True
                break
        if body_bad:
            body_outside += 1

        if present:
            ratio, torso = _shoulder_ratio(frame, width, height)
            if ratio is not None and torso is not None:
                shoulder_ratios.append(ratio)
                torso_lengths.append(torso / long_side)

    frames_valid = int(sum(valid_flags))
    ratio = frames_valid / total if total else 0.0
    low_names = [
        name
        for name, count in low_counts.items()
        if total and count / total > (1.0 - quality.minimum_valid_frame_ratio)
    ]

    if ratio < quality.minimum_valid_frame_ratio:
        reasons.append(
            "Поза не читается на слишком большой части записи "
            f"({_percent(total - frames_valid, total)}% кадров без уверенного скелета)."
        )

    for side, label in (("left", "левая стопа"), ("right", "правая стопа")):
        fraction = foot_outside[side] / total
        if fraction > quality.max_foot_outside_ratio:
            reasons.append(
                f"{label.capitalize()} была вне кадра или не видна "
                f"примерно {_percent(foot_outside[side], total)}% движения."
            )

    if body_outside / total > quality.max_body_outside_ratio:
        reasons.append(
            "Тело часто выходило из кадра "
            f"(примерно {_percent(body_outside, total)}% кадров)."
        )

    if sequence.second_person_ratio > quality.max_second_person_ratio:
        reasons.append(
            "В кадре слишком часто виден второй человек "
            f"(примерно {int(round(sequence.second_person_ratio * 100))}% кадров)."
        )

    if shoulder_ratios and camera_view == "side":
        median_ratio = float(np.median(shoulder_ratios))
        swing = float(max(shoulder_ratios) - min(shoulder_ratios))
        if median_ratio > quality.side_view_max_shoulder_ratio:
            reasons.append(
                "Ракурс не похож на вид сбоку: плечи слишком широки в кадре. "
                "Поставьте телефон сбоку от человека."
            )
        elif swing > quality.max_view_ratio_swing:
            reasons.append(
                "Ракурс сильно менялся по ходу записи. Телефон или человек развернулись."
            )

    if torso_lengths:
        median_torso = float(np.median(torso_lengths))
        if median_torso < quality.min_scale_fraction:
            reasons.append(
                "Человек слишком мелкий в кадре, длину корпуса не измерить устойчиво. Подойдите ближе."
            )
    elif not reasons:
        reasons.append("Не удалось измерить корпус. Встаньте в кадр целиком.")

    reliable = not reasons
    return QualityReport(
        frames_total=total,
        frames_valid=frames_valid,
        pose_detection_ratio=round(ratio, 4),
        low_confidence_landmarks=sorted(low_names),
        reliable=reliable,
        reasons=reasons,
    )


def assess_motion_size(normalized: MotionSequence, quality: PoseQualityConfig) -> list[str]:
    """Путь стопы уже в длинах корпуса. Вызывается после нормализации."""
    if not normalized.frames:
        return ["После нормализации не осталось кадров."]
    travel = 0.0
    for name in ("left_ankle", "right_ankle"):
        points = []
        for frame in normalized.frames:
            landmark = frame.landmarks.get(name)
            if landmark is None or landmark.visibility < 0.5:
                continue
            points.append((landmark.x, landmark.y))
        if len(points) < 2:
            continue
        arr = np.asarray(points, dtype=float)
        span = float(np.max(np.linalg.norm(arr - arr[0], axis=1)))
        travel = max(travel, span)
    if travel < quality.minimum_travel:
        return [
            "Движение слишком маленькое: стопы почти не сместились относительно тела. "
            "Сделайте шаг целиком и держите всё тело в кадре."
        ]
    return []


def _shoulder_ratio(frame: PoseFrame, width: int, height: int) -> tuple[float | None, float | None]:
    needed = ("left_shoulder", "right_shoulder", "left_hip", "right_hip")
    if any(frame.landmarks.get(name) is None for name in needed):
        return None, None
    left_shoulder = pixel_point(frame.landmarks["left_shoulder"], width, height)
    right_shoulder = pixel_point(frame.landmarks["right_shoulder"], width, height)
    left_hip = pixel_point(frame.landmarks["left_hip"], width, height)
    right_hip = pixel_point(frame.landmarks["right_hip"], width, height)
    shoulder = float(np.linalg.norm((left_shoulder - right_shoulder)[:2]))
    hip_mid = (left_hip + right_hip) / 2
    shoulder_mid = (left_shoulder + right_shoulder) / 2
    torso = float(np.linalg.norm((shoulder_mid - hip_mid)[:2]))
    if torso < 1e-6:
        return None, None
    return shoulder / torso, torso
