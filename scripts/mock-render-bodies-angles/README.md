# Bodies / camera-angle mock renders

These scripts drive the existing Blender 4.5 + MPFB2 mock-video generator, which lives outside this repo in `/workspace/hema/gen`. The `hemagen` package and the `render_drill.py`, `render_sword.py` and `render_footwork.py` scripts are used unchanged. The split is fixed in `docs/bodies-angles-split.md`.

- `bodies.json`: MPFB macro definitions of the five new bodies.
- `gen_jobs.py`: writes `jobs.tsv` in priority order (strikes before steps). Train clips get a seeded random camera and degradation; test clips get a fixed azimuth grid.
- `render_ba.py`: Blender `-P` wrapper. It sets the camera from azimuth, height, distance and lens, registers the bodies, then runs the drill script. The generator's built-in clearance and face-visibility checks run as usual.
- `degrade.py`: simulates dropped frames (repeats the previous frame), optionally downscales, then applies `postprocess.py` noise and H.264 CRF.
- `run_ba.sh <lane>`: resumable lane runner (run 2 lanes at most). It renders at 640×360 with 3 samples.

Poses are extracted with the in-app regression page in headless Chrome (browser MediaPipe Lite). They are then packed into the fixture with `frontend/scripts/build-motion-fixture.mjs <out> <dumpDir>:ba:<clipsRoot>`.
