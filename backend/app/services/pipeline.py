"""Сборка шагов: кадры → поза → нормализация → фазы → DTW → замечания.

И CLI, и HTTP вызывают эти функции. MediaPipe живёт только на входе с видео.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

from app.config import Settings, load_profile
from app.domain.models import (
    AlignmentResult,
    AnalysisProfile,
    ComparisonResult,
    MotionSequence,
    Observation,
    PreparedMotion,
    QualityReport,
)
from app.logging_config import get_logger, log_stage
from app.services.alignment.aligner import DtwMotionAligner
from app.services.comparison.comparator import MotionComparator
from app.services.debug_render import render_comparison_video, render_pose_overlay
from app.services.features.footwork import extract_features
from app.services.feedback.engine import select_feedback, severity_rank
from app.services.normalization.normalizer import normalize_sequence
from app.services.pose.cleanup import cleanup_sequence
from app.services.pose.extractor import PoseExtractor
from app.services.pose.mediapipe_extractor import MediaPipePoseExtractor
from app.services.pose.quality import assess_capture_quality, assess_motion_size
from app.services.segmentation import segment_motion
from app.services.video.io import VideoError, ensure_mp4, probe_video

logger = get_logger("hema.pipeline")


@dataclass
class Preparation:
    image: MotionSequence
    normalized: MotionSequence | None
    prepared: PreparedMotion | None
    quality: QualityReport


def prepare_image_sequence(
    sequence: MotionSequence,
    settings: Settings,
    profile: AnalysisProfile,
    camera_view: str,
) -> Preparation:
    quality = assess_capture_quality(
        sequence,
        settings.pose_quality,
        camera_view=camera_view,
        min_duration_s=settings.video.min_duration_s,
        max_duration_s=settings.video.max_duration_s,
    )
    if not quality.reliable:
        rejected = sequence.model_copy(update={"quality": quality})
        return Preparation(image=rejected, normalized=None, prepared=None, quality=quality)

    cleaned = cleanup_sequence(
        sequence,
        min_visibility=settings.pose_quality.minimum_landmark_visibility,
        max_gap_frames=settings.pose_quality.max_gap_frames,
        smooth_window=settings.processing.smooth_window,
    )
    cleaned = cleaned.model_copy(update={"quality": quality})
    normalized = normalize_sequence(
        cleaned,
        strategy=profile.scale_strategy,
        scope=profile.scale_scope,
        mirror=settings.orientation.mirror,
        min_visibility=settings.pose_quality.minimum_landmark_visibility,
    )
    size_reasons = assess_motion_size(normalized, settings.pose_quality)
    if size_reasons:
        failed = quality.model_copy(update={"reliable": False, "reasons": list(quality.reasons) + size_reasons})
        cleaned = cleaned.model_copy(update={"quality": failed})
        return Preparation(image=cleaned, normalized=normalized, prepared=None, quality=failed)

    prepared = _prepare_normalized(normalized, settings)
    return Preparation(image=cleaned, normalized=normalized, prepared=prepared, quality=quality)


def _prepare_normalized(sequence: MotionSequence, settings: Settings) -> PreparedMotion:
    features = extract_features(sequence, settings.pose_quality.minimum_landmark_visibility)
    phases = segment_motion(features, sequence.fps, settings.segmentation)
    return PreparedMotion(
        fps=sequence.fps,
        timestamps_ms=[frame.timestamp_ms for frame in sequence.frames],
        features=features,
        phases=phases,
    )


def compare_prepared(
    reference: PreparedMotion,
    attempt: PreparedMotion,
    profile: AnalysisProfile,
    settings: Settings,
    movement_id: str | None,
    quality: QualityReport,
) -> tuple[ComparisonResult, AlignmentResult]:
    alignment = DtwMotionAligner(profile.dtw_features).align(reference, attempt)
    observations, markers, metrics, features, similarity = MotionComparator(settings.comparison).compare(
        reference, attempt, alignment, profile
    )
    feedback = select_feedback(observations, profile, limit=3)
    message = None
    if not feedback:
        message = "Явных расхождений с эталоном по выбранным признакам не найдено."
    metrics = dict(metrics)
    metrics["alignment_distance"] = round(alignment.distance, 4)
    result = ComparisonResult(
        movement_id=movement_id,
        reliable=True,
        message=message,
        similarity=similarity if similarity is not None else 0.0,
        quality=quality.model_dump(),
        feedback=feedback,
        alignment=alignment.pairs,
        metrics=metrics,
        largest_deviations=_largest(observations, profile),
        timeline_markers=markers,
        features=features,
    )
    return result, alignment


def analyze_image_sequences(
    reference: MotionSequence,
    attempt: MotionSequence,
    profile: AnalysisProfile,
    settings: Settings,
    camera_view: str = "side",
    movement_id: str | None = None,
) -> tuple[ComparisonResult, Preparation, Preparation, AlignmentResult | None]:
    reference_prep = prepare_image_sequence(reference, settings, profile, camera_view)
    attempt_prep = prepare_image_sequence(attempt, settings, profile, camera_view)
    if not attempt_prep.quality.reliable or attempt_prep.prepared is None:
        return _unreliable(attempt_prep.quality, movement_id), reference_prep, attempt_prep, None
    if not reference_prep.quality.reliable or reference_prep.prepared is None:
        return _unreliable(reference_prep.quality, movement_id, reference=True), reference_prep, attempt_prep, None
    result, alignment = compare_prepared(
        reference_prep.prepared,
        attempt_prep.prepared,
        profile,
        settings,
        movement_id,
        attempt_prep.quality,
    )
    return result, reference_prep, attempt_prep, alignment


def compare_with_normalized_reference(
    reference_normalized: MotionSequence,
    attempt_image: MotionSequence,
    profile: AnalysisProfile,
    settings: Settings,
    camera_view: str,
    movement_id: str | None,
) -> tuple[ComparisonResult, Preparation, MotionSequence, PreparedMotion | None, AlignmentResult | None]:
    """Эталон уже нормализован при импорте. Попытку разбираем целиком."""
    attempt_prep = prepare_image_sequence(attempt_image, settings, profile, camera_view)
    if not attempt_prep.quality.reliable or attempt_prep.prepared is None:
        return _unreliable(attempt_prep.quality, movement_id), attempt_prep, reference_normalized, None, None
    reference_prepared = _prepare_normalized(reference_normalized, settings)
    result, alignment = compare_prepared(
        reference_prepared,
        attempt_prep.prepared,
        profile,
        settings,
        movement_id,
        attempt_prep.quality,
    )
    return result, attempt_prep, reference_normalized, reference_prepared, alignment


def extract_pose(video_path: Path, settings: Settings, extractor: PoseExtractor | None = None) -> MotionSequence:
    fps, _width, _height, count = probe_video(video_path)
    if count > 0:
        duration = count / fps
        if duration > settings.video.max_duration_s:
            raise VideoError(
                f"Видео длиннее {settings.video.max_duration_s:.0f} с. Оставьте одну попытку."
            )
        if duration < settings.video.min_duration_s:
            raise VideoError(
                f"Видео короче {settings.video.min_duration_s:.1f} с. Запишите движение целиком."
            )
    tool = extractor or MediaPipePoseExtractor(settings)
    return tool.extract(video_path)


def import_reference_video(
    movement_id: str,
    video_path: Path,
    settings: Settings,
    profile: AnalysisProfile,
    camera_view: str,
    extractor: PoseExtractor | None = None,
) -> ComparisonResult:
    destination = settings.references_dir / movement_id
    destination.mkdir(parents=True, exist_ok=True)
    mp4 = destination / "reference.mp4"
    with log_stage(logger, None, movement_id, "transcode"):
        ensure_mp4(video_path, mp4, settings.video.transcode)
    with log_stage(logger, None, movement_id, "pose_extraction"):
        raw = extract_pose(mp4, settings, extractor)
    with log_stage(logger, None, movement_id, "normalize"):
        preparation = prepare_image_sequence(raw, settings, profile, camera_view)
    _write_model(destination / "pose.json", preparation.image)
    if preparation.normalized is not None:
        _write_model(destination / "normalized_pose.json", preparation.normalized)
    meta = {
        "movement_id": movement_id,
        "fps": preparation.image.fps,
        "duration_ms": preparation.image.duration_ms,
        "reliable": preparation.quality.reliable,
        "reasons": preparation.quality.reasons,
    }
    (destination / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    if not preparation.quality.reliable or preparation.normalized is None or preparation.prepared is None:
        return _unreliable(preparation.quality, movement_id, reference=True)
    # Короткое «сравнение с собой» не нужно: сохраняем признаки отдельным файлом.
    (destination / "features.json").write_text(
        json.dumps(_json_ready(preparation.prepared.features), ensure_ascii=False),
        encoding="utf-8",
    )
    return ComparisonResult(
        movement_id=movement_id,
        reliable=True,
        message="Эталон сохранён.",
        similarity=None,
        quality=preparation.quality.model_dump(),
        features={},
        largest_deviations=[],
    )


def analyze_attempt_video(
    movement_id: str,
    video_path: Path,
    settings: Settings,
    profile: AnalysisProfile,
    camera_view: str,
    work_dir: Path,
    session_id: str | None = None,
    on_stage=None,
    extractor: PoseExtractor | None = None,
    debug_dir: Path | None = None,
) -> ComparisonResult:
    work_dir.mkdir(parents=True, exist_ok=True)
    reference_path = settings.references_dir / movement_id / "normalized_pose.json"
    if not reference_path.exists():
        raise VideoError(
            "Для этого движения ещё нет эталона. Импортируйте его: "
            f"python scripts/import_reference.py --movement {movement_id} --video reference.mp4"
        )

    def stage(name: str):
        if on_stage:
            on_stage(name)

    mp4 = work_dir / "input.mp4"
    stage("uploaded")
    with log_stage(logger, session_id, movement_id, "transcode"):
        ensure_mp4(video_path, mp4, settings.video.transcode)

    stage("extracting_pose")
    with log_stage(logger, session_id, movement_id, "pose_extraction"):
        raw = extract_pose(mp4, settings, extractor)

    stage("normalizing")
    with log_stage(logger, session_id, movement_id, "normalize"):
        attempt = prepare_image_sequence(raw, settings, profile, camera_view)
    _write_model(work_dir / "pose.json", attempt.image)
    if attempt.normalized is not None:
        _write_model(work_dir / "normalized_pose.json", attempt.normalized)

    if not attempt.quality.reliable or attempt.prepared is None or attempt.normalized is None:
        result = _unreliable(attempt.quality, movement_id)
        _write_model(work_dir / "comparison.json", result)
        return result

    reference = MotionSequence.model_validate_json(reference_path.read_text(encoding="utf-8"))
    reference_prepared = _prepare_normalized(reference, settings)

    stage("aligning")
    stage("analyzing")
    with log_stage(logger, session_id, movement_id, "comparison"):
        result, alignment = compare_prepared(
            reference_prepared,
            attempt.prepared,
            profile,
            settings,
            movement_id,
            attempt.quality,
        )
    _write_model(work_dir / "alignment.json", alignment)
    _write_model(work_dir / "comparison.json", result)

    if debug_dir is not None:
        debug_dir.mkdir(parents=True, exist_ok=True)
        lines = [
            f"{item['feature']} {item['phase']} {item['delta']:+.2f} {item['severity']}"
            for item in result.largest_deviations[:4]
        ]
        render_pose_overlay(mp4, attempt.image, attempt.prepared.phases, debug_dir / "attempt_overlay.mp4")
        render_comparison_video(
            reference,
            attempt.normalized,
            alignment,
            reference_prepared.phases,
            lines,
            debug_dir / "comparison.mp4",
        )
    return result


def compare_two_videos(
    reference_video: Path,
    attempt_video: Path,
    output_dir: Path,
    settings: Settings,
    profile: AnalysisProfile,
    camera_view: str = "side",
    extractor: PoseExtractor | None = None,
) -> ComparisonResult:
    """Первый офлайн-шаг: два ролика → позы, нормализация, выравнивание, comparison.mp4."""
    output_dir.mkdir(parents=True, exist_ok=True)
    reference_raw = extract_pose(reference_video, settings, extractor)
    attempt_raw = extract_pose(attempt_video, settings, extractor)
    result, reference_prep, attempt_prep, alignment = analyze_image_sequences(
        reference_raw, attempt_raw, profile, settings, camera_view
    )
    _write_model(output_dir / "reference_pose.json", reference_prep.image)
    _write_model(output_dir / "attempt_pose.json", attempt_prep.image)
    if reference_prep.normalized is not None:
        _write_model(output_dir / "normalized_reference.json", reference_prep.normalized)
    if attempt_prep.normalized is not None:
        _write_model(output_dir / "normalized_attempt.json", attempt_prep.normalized)
    if alignment is not None:
        _write_model(output_dir / "alignment.json", alignment)
    _write_model(output_dir / "comparison.json", result)
    if (
        alignment is not None
        and reference_prep.normalized is not None
        and attempt_prep.normalized is not None
        and reference_prep.prepared is not None
    ):
        lines = [
            f"{item['feature']} {item['phase']} {item['delta']:+.2f} {item['severity']}"
            for item in result.largest_deviations[:4]
        ]
        render_comparison_video(
            reference_prep.normalized,
            attempt_prep.normalized,
            alignment,
            reference_prep.prepared.phases,
            lines,
            output_dir / "comparison.mp4",
        )
    return result


def load_movement_profile(settings: Settings, profile_id: str) -> AnalysisProfile:
    path = settings.profiles_dir / f"{profile_id}.yaml"
    if not path.exists():
        raise VideoError(f"Нет профиля анализа {profile_id}.")
    return load_profile(path)


def _unreliable(quality: QualityReport, movement_id: str | None, reference: bool = False) -> ComparisonResult:
    reason = "; ".join(quality.reasons) if quality.reasons else "качество позы недостаточное"
    who = "Эталон" if reference else "Попытку"
    message = f"Не удалось надёжно проанализировать. {who}: {reason}"
    return ComparisonResult(
        movement_id=movement_id,
        reliable=False,
        message=message,
        similarity=None,
        quality=quality.model_dump(),
        features={},
        largest_deviations=[],
    )


def _largest(observations: list[Observation], profile: AnalysisProfile) -> list[dict]:
    def rank(item: Observation) -> tuple:
        spec = profile.features.get(item.feature)
        scale = 1.0
        if spec is not None:
            scale = spec.major_at() or spec.warn_at() or 1.0
        return (severity_rank(item.severity), abs(item.delta) / scale)

    ranked = sorted(observations, key=rank, reverse=True)
    payload = []
    for item in ranked[:12]:
        payload.append(
            {
                "feature": item.feature,
                "phase": item.phase,
                "phase_position": round(item.phase_position, 4),
                "reference": round(item.reference, 4),
                "attempt": round(item.attempt, 4),
                "delta": round(item.delta, 4),
                "severity": item.severity,
                "reference_frame": item.reference_frame,
                "attempt_frame": item.attempt_frame,
                "reference_time_ms": item.reference_time_ms,
                "attempt_time_ms": item.attempt_time_ms,
            }
        )
    return payload


def _json_ready(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {key: _json_ready(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    return value


def _write_model(path: Path, model) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(model.model_dump_json(indent=2), encoding="utf-8")
