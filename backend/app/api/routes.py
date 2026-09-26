"""Маршруты /api/v1. Разбор попытки идёт в фоне, клиент опрашивает статус."""

from __future__ import annotations

import re
import shutil
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response

from app.domain.models import ComparisonResult, MotionSequence
from app.logging_config import get_logger
from app.services.pipeline import analyze_attempt_video, load_movement_profile
from app.services.video.io import VideoError
from app.storage.drills import UnknownDrill, get_drill, list_drills
from app.storage.library import UnknownMovement, get_movement, list_movements, reference_paths
from app.storage.sessions import SessionStore

router = APIRouter(prefix="/api/v1")
logger = get_logger("hema.api")
_SESSION_ID = re.compile(r"^[a-f0-9]{32}$")


def _settings(request: Request):
    return request.app.state.settings


def _store(request: Request) -> SessionStore:
    return request.app.state.store


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/drills")
def drills(request: Request):
    return [item.model_dump(exclude_none=True) for item in list_drills(_settings(request))]


@router.get("/drills/{drill_id}")
def drill_detail(drill_id: str, request: Request):
    try:
        drill = get_drill(_settings(request), drill_id)
    except UnknownDrill:
        raise HTTPException(status_code=404, detail="Упражнение не найдено") from None
    return drill.model_dump(exclude_none=True)


@router.get("/movements")
def movements(request: Request):
    return [item.model_dump() for item in list_movements(_settings(request))]


@router.get("/movements/{movement_id}")
def movement_detail(movement_id: str, request: Request):
    try:
        detail = get_movement(_settings(request), movement_id)
    except UnknownMovement:
        raise HTTPException(status_code=404, detail="Движение не найдено") from None
    return detail.model_dump()


@router.get("/movements/{movement_id}/video")
def movement_video(movement_id: str, request: Request):
    try:
        get_movement(_settings(request), movement_id)
    except UnknownMovement:
        raise HTTPException(status_code=404, detail="Движение не найдено") from None
    video, _pose = reference_paths(_settings(request), movement_id)
    if not video.exists():
        raise HTTPException(status_code=404, detail="Эталонное видео ещё не импортировано")
    return FileResponse(video, media_type="video/mp4", filename=video.name)


@router.get("/movements/{movement_id}/pose")
def movement_pose(movement_id: str, request: Request, space: str = "image"):
    try:
        get_movement(_settings(request), movement_id)
    except UnknownMovement:
        raise HTTPException(status_code=404, detail="Движение не найдено") from None
    folder = _settings(request).references_dir / movement_id
    return _pose_file(folder, space)


@router.post("/movements/{movement_id}/attempts", status_code=202)
async def create_attempt(movement_id: str, request: Request, video: UploadFile = File(...)):
    settings = _settings(request)
    try:
        detail = get_movement(settings, movement_id)
    except UnknownMovement:
        raise HTTPException(status_code=404, detail="Движение не найдено") from None
    if not detail.reference_ready:
        raise HTTPException(status_code=409, detail="Сначала импортируйте эталонное видео этого движения.")

    session_id = uuid.uuid4().hex
    folder = settings.sessions_dir / session_id
    folder.mkdir(parents=True, exist_ok=True)
    upload_path = folder / "upload.bin"
    size = 0
    limit = settings.video.max_mb * 1024 * 1024
    try:
        with upload_path.open("wb") as handle:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(status_code=413, detail=f"Видео больше {settings.video.max_mb} МБ.")
                handle.write(chunk)
    except HTTPException:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    if size == 0:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Пустой файл.")

    created_at = datetime.now(timezone.utc).isoformat()
    _store(request).create(session_id, movement_id, created_at, str(upload_path))
    _schedule(request, session_id, movement_id, upload_path, detail.analysis_profile, detail.camera_view)
    return {"session_id": session_id}


@router.get("/sessions/{session_id}")
def session_status(session_id: str, request: Request):
    _check_session_id(session_id)
    info = _store(request).get(session_id)
    if info is None:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    return info.model_dump()


@router.get("/sessions/{session_id}/result")
def session_result(session_id: str, request: Request):
    _check_session_id(session_id)
    info = _store(request).get(session_id)
    if info is None:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    if info.status == "failed":
        raise HTTPException(status_code=422, detail=info.error_reason or "Разбор не удался")
    if info.status != "completed":
        raise HTTPException(status_code=409, detail={"status": info.status})
    path = _settings(request).sessions_dir / session_id / "comparison.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Результат не найден")
    result = ComparisonResult.model_validate_json(path.read_text(encoding="utf-8"))
    payload = result.model_dump()
    payload["attempt_video_url"] = f"/api/v1/sessions/{session_id}/video"
    payload["attempt_pose_url"] = f"/api/v1/sessions/{session_id}/pose"
    payload["reference_video_url"] = f"/api/v1/movements/{info.movement_id}/video"
    payload["reference_pose_url"] = f"/api/v1/movements/{info.movement_id}/pose"
    return payload


@router.get("/sessions/{session_id}/video")
def session_video(session_id: str, request: Request):
    _check_session_id(session_id)
    if _store(request).get(session_id) is None:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    path = _settings(request).sessions_dir / session_id / "input.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Видео ещё не готово")
    return FileResponse(path, media_type="video/mp4", filename="attempt.mp4")


@router.get("/sessions/{session_id}/pose")
def session_pose(session_id: str, request: Request, space: str = "image"):
    _check_session_id(session_id)
    if _store(request).get(session_id) is None:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    folder = _settings(request).sessions_dir / session_id
    return _pose_file(folder, space)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str, request: Request):
    _check_session_id(session_id)
    store = _store(request)
    if store.get(session_id) is None:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    folder = _settings(request).sessions_dir / session_id
    store.delete(session_id)
    shutil.rmtree(folder, ignore_errors=True)
    return Response(status_code=204)


def _pose_file(folder: Path, space: str):
    name = "normalized_pose.json" if space == "normalized" else "pose.json"
    path = folder / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Скелет ещё не посчитан")
    sequence = MotionSequence.model_validate_json(path.read_text(encoding="utf-8"))
    return {
        "fps": sequence.fps,
        "duration_ms": sequence.duration_ms,
        "space": sequence.space,
        "width": sequence.width,
        "height": sequence.height,
        "frames": [frame.model_dump() for frame in sequence.frames],
    }


def _check_session_id(session_id: str) -> None:
    if not _SESSION_ID.match(session_id):
        raise HTTPException(status_code=404, detail="Сессия не найдена")


def _schedule(request: Request, session_id: str, movement_id: str, upload_path: Path, profile_id: str, camera_view: str) -> None:
    settings = _settings(request)
    store = _store(request)

    def job() -> None:
        def on_stage(name: str) -> None:
            store.update(session_id, status=name)

        try:
            profile = load_movement_profile(settings, profile_id)
            work = settings.sessions_dir / session_id
            result = analyze_attempt_video(
                movement_id=movement_id,
                video_path=upload_path,
                settings=settings,
                profile=profile,
                camera_view=camera_view,
                work_dir=work,
                session_id=session_id,
                on_stage=on_stage,
            )
            store.update(
                session_id,
                status="completed",
                pose_path=str(work / "pose.json"),
                comparison_path=str(work / "comparison.json"),
                error_reason=None if result.reliable else result.message,
            )
        except VideoError as error:
            logger.info(
                "attempt rejected",
                extra={"session_id": session_id, "movement_id": movement_id, "stage": "failed", "duration_ms": 0},
            )
            store.update(session_id, status="failed", error_reason=str(error))
        except Exception:
            logger.exception(
                "attempt failed",
                extra={"session_id": session_id, "movement_id": movement_id, "stage": "failed"},
            )
            store.update(
                session_id,
                status="failed",
                error_reason="Не удалось разобрать видео. Проверьте, что это запись одного человека, и посмотрите журнал сервера.",
            )

    threading.Thread(target=job, name=f"session-{session_id[:8]}", daemon=True).start()
