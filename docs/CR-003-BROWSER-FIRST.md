# CR-003 — Browser-first motion engine

Status: Implemented

## Goal

Make the core HEMAtrainer product independent of server-side compute.

Both live drills and detailed uploaded-video analysis should run on the user's device. A weak VPS or static CDN should be sufficient to host the product.

## Runtime architecture

### Live

```text
camera
  -> MediaPipe Pose Landmarker
  -> normalization
  -> live features
  -> smoothing
  -> checkpoint matcher
  -> feedback
```

All stages run in the browser.

### Detailed video analysis

```text
File / recorded Blob
  -> browser video decoder
  -> MediaPipe Pose Landmarker
  -> PoseSequence
  -> normalization
  -> feature extraction
  -> segmentation
  -> Web Worker
       -> DTW
       -> phase comparison
       -> deterministic feedback
  -> local result
```

The video never needs to be uploaded.

## Local persistence

IndexedDB stores:
- one trainer/reference video per movement;
- extracted reference pose sequence;
- local analysis sessions;
- attempt video;
- attempt pose and normalized pose;
- comparison result.

Deleting browser storage removes this data.

## Shared browser motion engine

`frontend/src/motion/` now contains:
- `normalize.ts`
- `features.ts`
- `segmentation.ts`
- `dtw.ts`
- `compare.ts`
- `engine.ts`
- `videoPose.ts`
- `analysis.worker.ts`
- `storage.ts`

Live and offline flows still have different orchestration, but mathematical primitives are now in TypeScript and no longer require NumPy/OpenCV/FastAPI.

## Static content

YAML remains the authoring source of truth under `data/`.

`scripts/export_static_content.py` exports:
- drills;
- movement metadata;
- analysis profiles;

to `frontend/public/content/`.

The frontend loads these files first and only uses the API as a compatibility fallback.

## Launcher

Normal `start.bat` starts only Vite.

FastAPI is available explicitly:

```bash
python launcher.py --with-backend
```

This keeps the legacy server pipeline available while removing it from the core product path.

## Deployment consequence

The built frontend can be hosted as static assets.

Server resources are not consumed by:
- camera inference;
- uploaded-video inference;
- DTW;
- comparison;
- feedback;
- user video storage.

A future backend can focus on genuinely shared concerns:
- accounts;
- sync;
- trainer-authored content publishing;
- telemetry;
- billing;
- optional heavy ML models.

## Known limitations

- Browser video codec support determines which uploaded files can be decoded. MP4/H.264 and WebM are preferred.
- Offline extraction currently samples video at 15 FPS to control local compute.
- IndexedDB quotas vary by browser/device.
- The legacy Python implementation remains in the repository during migration.
- The browser engine must stay parity-tested against the intended analysis behavior as it evolves.
