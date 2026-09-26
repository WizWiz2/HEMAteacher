"""MediaPipe Tasks Vision. Импорт тяжёлой библиотеки только в момент разбора."""

from __future__ import annotations

import threading
from pathlib import Path

import cv2

from app.config import Settings
from app.domain.landmarks import LANDMARK_NAMES
from app.domain.models import Landmark, MotionSequence, PoseFrame
from app.services.video.io import VideoError, probe_video

_LOCK = threading.Lock()


class MediaPipePoseExtractor:
    def __init__(self, settings: Settings):
        self.settings = settings

    def extract(self, video_path: Path) -> MotionSequence:
        model = self.settings.model_path
        if not model.exists():
            raise VideoError(
                "Не найдена модель позы MediaPipe "
                f"({model}). Запустите scripts/download_model.py или поднимите приложение через Docker."
            )
        with _LOCK:
            return self._extract_locked(video_path)

    def _extract_locked(self, video_path: Path) -> MotionSequence:
        import mediapipe as mp
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision

        pose = self.settings.pose
        options = vision.PoseLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(self.settings.model_path)),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=pose.num_poses,
            min_pose_detection_confidence=pose.min_pose_detection_confidence,
            min_pose_presence_confidence=pose.min_pose_presence_confidence,
            min_tracking_confidence=pose.min_tracking_confidence,
        )
        fps, width, height, _declared = probe_video(video_path)
        capture = cv2.VideoCapture(str(video_path))
        if not capture.isOpened():
            capture.release()
            raise VideoError(f"Не удалось открыть видео: {video_path.name}")

        landmarker = vision.PoseLandmarker.create_from_options(options)
        frames: list[PoseFrame] = []
        second_person = 0
        last_ts = -1
        index = 0
        max_width = pose.max_frame_width
        try:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                if max_width and frame.shape[1] > max_width:
                    scale = max_width / frame.shape[1]
                    frame = cv2.resize(frame, (max_width, int(round(frame.shape[0] * scale))))
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                timestamp = int(round(index * 1000 / fps))
                if timestamp <= last_ts:
                    timestamp = last_ts + 1
                last_ts = timestamp
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np_as_contiguous(rgb))
                result = landmarker.detect_for_video(mp_image, timestamp)
                poses = result.pose_landmarks or []
                landmarks: dict[str, Landmark] = {}
                if poses:
                    landmarks = _convert(poses[0])
                    if len(poses) > 1 and _confident_pose(poses[1]):
                        second_person += 1
                frames.append(PoseFrame(timestamp_ms=timestamp, landmarks=landmarks))
                index += 1
        finally:
            capture.release()
            landmarker.close()

        if not frames:
            raise VideoError("В видео нет кадров.")
        duration_ms = frames[-1].timestamp_ms
        ratio = second_person / len(frames)
        return MotionSequence(
            fps=fps,
            duration_ms=duration_ms,
            frames=frames,
            space="image",
            width=width,
            height=height,
            second_person_ratio=ratio,
        )


def np_as_contiguous(rgb):
    if not rgb.flags["C_CONTIGUOUS"]:
        return rgb.copy()
    return rgb


def _convert(pose_landmarks) -> dict[str, Landmark]:
    converted: dict[str, Landmark] = {}
    for index, landmark in enumerate(pose_landmarks):
        if index >= len(LANDMARK_NAMES):
            break
        visibility = getattr(landmark, "visibility", None)
        if visibility is None:
            visibility = getattr(landmark, "presence", 0.0) or 0.0
        converted[LANDMARK_NAMES[index]] = Landmark(
            x=float(landmark.x),
            y=float(landmark.y),
            z=float(landmark.z),
            visibility=float(visibility),
        )
    return converted


def _confident_pose(pose_landmarks) -> bool:
    if len(pose_landmarks) <= 24:
        return False
    hips = (pose_landmarks[23], pose_landmarks[24])
    scores = []
    for landmark in hips:
        visibility = getattr(landmark, "visibility", None)
        if visibility is None:
            visibility = getattr(landmark, "presence", 0.0) or 0.0
        scores.append(float(visibility))
    return sum(scores) / len(scores) >= 0.5
