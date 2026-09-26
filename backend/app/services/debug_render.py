"""Отладочные ролики. Подписи латиницей: у OpenCV нет кириллицы в стандартном шрифте."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from app.domain.landmarks import POSE_EDGES
from app.domain.models import AlignmentResult, MotionSequence, PhaseSpan, PoseFrame
from app.services.video.io import write_frames


def render_comparison_video(
    reference: MotionSequence,
    attempt: MotionSequence,
    alignment: AlignmentResult,
    phases: list[PhaseSpan],
    metric_lines: list[str],
    output: Path,
) -> None:
    width, height = 1280, 720
    unit = 150
    frames: list[np.ndarray] = []
    fps = reference.fps if reference.fps > 1 else 25
    for pair in alignment.pairs:
        canvas = np.full((height, width, 3), 22, dtype=np.uint8)
        cv2.line(canvas, (width // 2, 64), (width // 2, height), (48, 48, 48), 1)
        _panel_skeleton(
            canvas,
            _frame_at(reference, pair.reference_frame),
            origin=(width // 4, 430),
            unit=unit,
            color=(214, 176, 120),
        )
        _panel_skeleton(
            canvas,
            _frame_at(attempt, pair.attempt_frame),
            origin=(3 * width // 4, 430),
            unit=unit,
            color=(120, 170, 214),
        )
        phase = _phase_name(phases, pair.reference_frame)
        cv2.putText(canvas, "reference", (40, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (214, 176, 120), 2)
        cv2.putText(canvas, "attempt", (width // 2 + 40, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (120, 170, 214), 2)
        header = (
            f"ref {pair.reference_frame} @ {pair.reference_time_ms} ms   "
            f"att {pair.attempt_frame} @ {pair.attempt_time_ms} ms   phase {phase}"
        )
        cv2.putText(canvas, header, (40, 78), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (230, 230, 230), 1)
        for line_index, line in enumerate(metric_lines[:4]):
            cv2.putText(
                canvas,
                line[:90],
                (40, height - 30 - 22 * (3 - line_index)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (210, 210, 210),
                1,
            )
        frames.append(canvas)
    if not frames:
        frames.append(np.full((height, width, 3), 22, dtype=np.uint8))
        cv2.putText(frames[0], "no alignment", (40, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 200), 2)
    write_frames(output, frames, fps)


def render_pose_overlay(
    video_path: Path,
    sequence: MotionSequence,
    phases: list[PhaseSpan] | None,
    output: Path,
) -> None:
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        capture.release()
        raise RuntimeError(f"Не удалось открыть {video_path.name} для отладочного ролика.")
    fps = sequence.fps if sequence.fps > 1 else 25
    rendered: list[np.ndarray] = []
    index = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        pose = sequence.frames[index] if index < len(sequence.frames) else None
        if pose is not None:
            _draw_image_skeleton(frame, pose, (80, 220, 220))
            phase = _phase_name(phases or [], index)
            label = f"f {index}  t {pose.timestamp_ms} ms  {phase}".strip()
            cv2.putText(frame, label, (16, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        rendered.append(frame)
        index += 1
    capture.release()
    write_frames(output, rendered, fps)


def _frame_at(sequence: MotionSequence, index: int) -> PoseFrame | None:
    if index < 0 or index >= len(sequence.frames):
        return None
    return sequence.frames[index]


def _panel_skeleton(canvas: np.ndarray, pose: PoseFrame | None, origin: tuple[int, int], unit: float, color: tuple[int, int, int]) -> None:
    if pose is None:
        return
    points: dict[str, tuple[int, int]] = {}
    for name, landmark in pose.landmarks.items():
        if landmark.visibility < 0.2:
            continue
        x = int(origin[0] + landmark.x * unit)
        y = int(origin[1] - landmark.y * unit)
        points[name] = (x, y)
    for start, end in POSE_EDGES:
        if start in points and end in points:
            cv2.line(canvas, points[start], points[end], color, 2, cv2.LINE_AA)
    for point in points.values():
        cv2.circle(canvas, point, 3, color, -1, cv2.LINE_AA)


def _draw_image_skeleton(frame: np.ndarray, pose: PoseFrame, color: tuple[int, int, int]) -> None:
    height, width = frame.shape[:2]
    points: dict[str, tuple[int, int]] = {}
    for name, landmark in pose.landmarks.items():
        if landmark.visibility < 0.2:
            continue
        points[name] = (int(landmark.x * width), int(landmark.y * height))
    for start, end in POSE_EDGES:
        if start in points and end in points:
            cv2.line(frame, points[start], points[end], color, 2, cv2.LINE_AA)
    for point in points.values():
        cv2.circle(frame, point, 3, color, -1, cv2.LINE_AA)


def _phase_name(phases: list[PhaseSpan], frame: int) -> str:
    for phase in phases:
        if phase.start_frame <= frame < phase.end_frame:
            return phase.name
    return ""
