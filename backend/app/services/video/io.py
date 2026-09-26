"""Видео читается через OpenCV. В контейнере webm с телефона перекодируется ffmpeg в mp4."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np


class VideoError(Exception):
    pass


def probe_video(path: Path) -> tuple[float, int, int, int]:
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        capture.release()
        raise VideoError(f"Не удалось открыть видео: {path.name}")
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    capture.release()
    if fps < 1 or fps > 240:
        fps = 30.0
    if width <= 0 or height <= 0:
        raise VideoError("В видео не видно размеров кадра.")
    return fps, width, height, count


def ensure_mp4(source: Path, destination: Path, transcode: bool) -> Path:
    """Сделать mp4, который и браузер, и OpenCV открывают одинаково."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() == destination.resolve() and source.suffix.lower() == ".mp4":
        return destination
    if transcode and _ffmpeg_available():
        _ffmpeg(source, destination)
        return destination
    if source.suffix.lower() == ".mp4":
        if source.resolve() != destination.resolve():
            shutil.copyfile(source, destination)
        return destination
    _rewrite_with_opencv(source, destination)
    return destination


def write_frames(path: Path, frames: list[np.ndarray], fps: float) -> None:
    if not frames:
        raise VideoError("Нет кадров для записи.")
    path.parent.mkdir(parents=True, exist_ok=True)
    height, width = frames[0].shape[:2]
    if path.suffix.lower() == ".mp4":
        for codec in ("avc1", "mp4v", "H264"):
            if _write(path, frames, fps, width, height, codec):
                return
    if _write(path, frames, fps, width, height, "MJPG"):
        return
    raise VideoError(f"Не удалось записать видео {path.name}. Проверьте, установлен ли ffmpeg.")


def _write(path: Path, frames: list[np.ndarray], fps: float, width: int, height: int, codec: str) -> bool:
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*codec), float(fps), (width, height))
    if not writer.isOpened():
        writer.release()
        return False
    for frame in frames:
        if frame.shape[1] != width or frame.shape[0] != height:
            frame = cv2.resize(frame, (width, height))
        if frame.ndim == 2:
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        writer.write(frame)
    writer.release()
    return path.exists() and path.stat().st_size > 0


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def _ffmpeg(source: Path, destination: Path) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(destination),
    ]
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0 or not destination.exists():
        tail = (completed.stderr or "")[-1500:]
        raise VideoError(f"ffmpeg не смог перекодировать видео. {tail}")


def _rewrite_with_opencv(source: Path, destination: Path) -> None:
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        capture.release()
        raise VideoError(
            "Не удалось прочитать видео. Установите ffmpeg или загрузите mp4."
        )
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 30) or 30
    frames: list[np.ndarray] = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frames.append(frame)
    capture.release()
    if not frames:
        raise VideoError("В видео нет кадров.")
    write_frames(destination, frames, fps)
