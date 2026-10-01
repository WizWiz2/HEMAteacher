# Updated corpus

The current 54-clip validation, including the four new strikes and personalised training path, is documented in [new-strike-calibration.md](new-strike-calibration.md). The 30-clip description below records the previous validation scope; `video-motion-results.json` now contains the current results.

# Video input and beginner movement recognition

## Scope and status

MP4 input exists only in the development regression tool at `/dev/video-regression`. It is excluded from production builds, including its file picker and route. The training screen and `useLivePose` accept only camera input.

Camera capture and the regression tool share `MediaPipeLivePose` with the local **lite** model, `LiveSampleProcessor`, visibility checks, `CalibrationGate`, and `stepDrill`. Each regression clip starts with empty calibration and detector history; no test avatar profile is saved as a student's profile. Empty detections are emitted as empty frames rather than silently hiding tracking loss.

The browser/WASM path has been implemented but **has not been executed in this environment**. The supervised preview failed before application startup; a local browser installation also failed. There is no browser validation result. This is an outstanding verification step, not a passing check.

Actual MP4 pixels were decoded with OpenCV and inferred using **Python MediaPipe 0.10.21 CPU**, using exactly the same `pose_landmarker_lite.task` model asset. Those detections were passed through the shared TypeScript preprocessing, calibration and drill engine. This checks image recognition and the downstream logic, but the Python task backend is different from browser WASM/GPU and cannot establish browser latency or device behavior.

## Recognition versus technique

Recognition starts from the student's own stable position (200 ms), rather than requiring agreement with a master guard. Zornhau still needs a raised starting hand. The engine checks ordered movement, direction, excursion, end position and trajectory, with a maximum attempt of 4 seconds and 200 ms endpoint settling. These are provisional recognition limits, not a requirement that a beginner match a master's technique.

Footwork includes camera-plane pelvis travel: hip-relative ankle coordinates alone erase travel direction and allowed reversed steps to look valid. References are translated to the student's baseline; body size is normalized by torso length. During movement, an occluded knee does not invalidate otherwise observed feet and torso. Calibration retains the stricter body visibility checks. Missing feet, torso or the moving wrist remain a tracking problem.

Zornhau uses an observed wrist proxy for the hand trajectory, so overlap of the far wrist does not require guessing its location. Recognition does not grade two-hand grip, elbow alignment, edge orientation or sword mechanics. No percentage similarity is presented as a technique score.

After recognition, separate heuristic feedback can describe sustained forward torso lean, limited hand travel, limited vertical hand movement, or reduced foot travel relative to the supplied examples. These thresholds are provisional and need coach validation. A recognized movement may receive a correction. An absence of a triggered rule is not a clean bill of technique. Fault labels supplied with the corpus are not used to choose feedback; complete agreement with the injected faults has **not** been demonstrated.

## Recorded results

The corpus contains 5 movements × 2 builds × 3 skill levels = 30 six-second MP4s. All clips share a synthetic generator; thresholds were iterated on this corpus. This is regression evidence, not an independent estimate of accuracy on real students.

| Pipeline / scenario | Recognized | Total |
| --- | ---: | ---: |
| Decoded MP4 → Python CPU lite → shared pipeline, 30 FPS | 30 | 30 |
| Same inferred frames sampled at 15 FPS | 30 | 30 |
| Same inferred frames sampled at 10 FPS | 30 | 30 |
| Frozen inferred poses, all 3 rates | 0 | 90 |
| 450 ms tracking gaps during movement, all 3 rates | 0 | 90 |
| Inferred timestamps slowed 12×, all 3 rates | 0 | 90 |
| Ground-truth landmarks, normal / timestamps 0.6× / 10 FPS | 90 | 90 |
| Ground-truth frozen / reversed / truncated / gaps / 12× slow | 0 | 150 |

`video-motion-results.json` contains per-clip inference timings, visibility counts, calibration, outcome and feedback. The lower-FPS runs subsample poses inferred at 30 FPS: they do **not** rerun MediaPipe at 15/10 FPS and do not measure motion blur at higher strike speeds. The negative scenarios mutate observed frames; they are not independently recorded negative videos. `continuous-motion-results.json` remains the separate ground-truth-only check.

## Reproduction

From the repository root, prepare frontend dependencies/assets normally, then use an isolated Python environment with `mediapipe==0.10.21` (which supplies OpenCV dependencies):

```bash
python frontend/scripts/infer-mock-videos.py --output /tmp/hema-inferred
node frontend/scripts/check-inferred-motion.mjs /tmp/hema-inferred docs/video-motion-results.json
node frontend/scripts/build-motion-patterns.mjs --check
node frontend/scripts/check-continuous-motion.mjs
```

The inferred-motion checker fails if any normal clip is unrecognized or a negative scenario completes. No saved calibration or annotations substitute for detections.

For the required browser check, open `/dev/video-regression` in a development run of the app (`npm run dev` in `frontend`), select the repository's `test-data/mock-videos` folder, run 30/15/10 FPS, and download the report. Each browser run freshly decodes the selected MP4, reruns the **camera detector**, starts with empty calibration, and uses the same downstream processing. The resulting report includes raw detections for inspection. This route does not upload files to a server.

Also verify live camera timing, retry, phone camera switching, and voice/visual feedback on actual devices. A coach should review the recognition and correction rules against real novice attempts before calling this a validated HEMA technique assessor.
