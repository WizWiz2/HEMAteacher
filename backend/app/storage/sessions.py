"""Метаданные попыток в SQLite. Сами ролики и JSON — на диске."""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from app.domain.models import SessionInfo


class SessionStore:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._path = path
        try:
            self._connect()
        except sqlite3.OperationalError as error:
            # Файл мог оборваться на записи. Метаданные сессий можно начать заново.
            if "unsupported file format" not in str(error).lower():
                raise
            connection = getattr(self, "_conn", None)
            if connection is not None:
                connection.close()
            if path.exists():
                path.unlink()
            self._connect()

    def _connect(self) -> None:
        self._conn = sqlite3.connect(self._path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    movement_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    video_path TEXT,
                    status TEXT NOT NULL,
                    pose_path TEXT,
                    comparison_path TEXT,
                    error_reason TEXT
                )
                """
            )
            self._conn.commit()

    def create(self, session_id: str, movement_id: str, created_at: str, video_path: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO sessions (id, movement_id, created_at, video_path, status)
                VALUES (?, ?, ?, ?, 'uploaded')
                """,
                (session_id, movement_id, created_at, video_path),
            )
            self._conn.commit()

    def update(self, session_id: str, **fields: str | None) -> None:
        allowed = {"status", "error_reason", "pose_path", "comparison_path", "video_path"}
        columns = {key: value for key, value in fields.items() if key in allowed}
        if not columns:
            return
        assignments = ", ".join(f"{key} = ?" for key in columns)
        with self._lock:
            self._conn.execute(
                f"UPDATE sessions SET {assignments} WHERE id = ?",
                (*columns.values(), session_id),
            )
            self._conn.commit()

    def get(self, session_id: str) -> SessionInfo | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if row is None:
            return None
        return SessionInfo(
            id=row["id"],
            movement_id=row["movement_id"],
            created_at=row["created_at"],
            status=row["status"],
            error_reason=row["error_reason"],
        )

    def paths(self, session_id: str) -> dict | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if row is None:
            return None
        return dict(row)

    def delete(self, session_id: str) -> bool:
        with self._lock:
            cursor = self._conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            self._conn.commit()
            return cursor.rowcount > 0
