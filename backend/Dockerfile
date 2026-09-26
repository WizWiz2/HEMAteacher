FROM python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

ADD https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task /app/models/pose_landmarker_full.task

COPY backend/app /app/app
COPY scripts /app/scripts
COPY config /app/config

ENV HEMA_ROOT=/app \
    HEMA_CONFIG=/app/config/settings.yaml \
    HEMA_DATA=/data \
    HEMA_MODEL=/app/models/pose_landmarker_full.task \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
