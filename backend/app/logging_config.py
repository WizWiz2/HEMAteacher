"""Структурные JSON-логи. В запись попадают session_id, movement_id, stage, duration_ms."""

from __future__ import annotations

import json
import logging
import time
from contextlib import contextmanager
from datetime import datetime, timezone

_CONFIGURED = False


class JsonFormatter(logging.Formatter):
    _FIELDS = ("session_id", "movement_id", "stage", "duration_ms")

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "time": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        for key in self._FIELDS:
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["error"] = self.formatException(record.exc_info)[-2000:]
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    global _CONFIGURED
    root = logging.getLogger()
    if _CONFIGURED:
        root.setLevel(level.upper())
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


@contextmanager
def log_stage(logger: logging.Logger, session_id: str | None, movement_id: str | None, stage: str):
    started = time.perf_counter()
    try:
        yield
    finally:
        duration_ms = round((time.perf_counter() - started) * 1000, 1)
        logger.info(
            stage,
            extra={
                "session_id": session_id,
                "movement_id": movement_id,
                "stage": stage,
                "duration_ms": duration_ms,
            },
        )
