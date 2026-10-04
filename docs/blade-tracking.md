# Blade tracking prototype (experimental, OFF by default)

Branch `feat/blade-tracking-prototype`. Goal: separate look-alike strikes (Scheitelhau vs Schielhau/Zornhau,
Krumphau vs Zwerchhau). 2D body landmarks cannot tell these apart well (reserved test M/E strikes 65/84, Scheitelhau 7/18).

**Result in short:**
- A perfect blade detector would remove most of the confusion: test strikes M/E go from 65/84 to 82/84, and wrong-drill accepts from 11 to 1 of 672.
- The practical in-browser detector built here locates the blade well when it reports it (median angle error 1.4°).
- On the reserved test, though, it does **not** improve recognition: 62/84 own, 9/672 wrong, and footwork wrong-drill accepts rise from 3 to 4.
- The flag therefore stays **off** and this is not merged.

## How to try it
- Open the app with `?blade=1` to turn it on; the setting is remembered in `localStorage["hema.bladeTracking"]`. `?blade=0` turns it off.
- When it is on:
  - each pose frame is copied to a canvas of at most 640 px and converted to grey;
  - `src/live/bladeDetector.ts` looks for the blade starting at the MediaPipe hands;
  - confident detections are added as `blade_guard` / `blade_tip` landmarks;
  - the recogniser loads `motionModelBlade.json`, a separate chunk of about 0.56 MB that is only downloaded when the flag is on.
- With the flag off, nothing changes: the shipped model, its channels, `motionModel.json` and the CI gates are byte-identical.

## Blade channels (`BLADE_CHANNELS` in motionRecognition.ts)
- **Channels:**
  - `blade_cos` / `blade_sin`: the guard→tip direction;
  - `tip_head_x/y`: the tip relative to the nose;
  - `tip_x/y`: the tip in torso units relative to the hip centre.
- **When they are active:** only when the model was built with them. `setRecognitionModel` syncs `BLADE.enabled` from `model.channels.length`.
- **Weights:** fixed in advance (`BLADE_WEIGHTS`: direction 1, positions 0.7), not fitted.
- **Gaps:** interior gaps of the blade channels are bridged by linear interpolation before re-sampling (`BLADE.interpolate`). The blade is lost in motion blur, and without bridging the gain disappears (see the table below).
- **Tip path:** `BLADE.path`, which adds the tip to the path-length parameterisation, exists but is off.

## Step 1: upper bound with ground-truth blade points
- The ground-truth crossguard and tip come from the generator sidecars (`frames[].sword_px`, Blender projection to image pixels).
- They are aligned to the fixture frames by timestamp: 227 strike clips, no missing frames.
- The model is trained on the train split only. Rows are own drill · wrong-drill accepts:

| | 2D body only (main 06a0070) | + GT blade |
|---|---|---|
| train LOBO strikes M/E | 51/66 · 10/528 | **63/66 · 1/528** |
| test strikes M/E | 65/84 · 11/672 | **82/84 · 1/672** |
| test Scheitelhau M/E | 7/18 | 17/18 |
| test strikes beginners | 30/44 · 6/352 | 42/44 · 1/352 |
| test steps (M/E, beginners) | 57/64 · 3, 28/32 · 3 | unchanged |

**What the detector needs to provide (simulations on GT, rows are LOBO / test strikes M/E):**

| simulation | result |
|---|---|
| blade angle only (tip channels weight 0) | LOBO 63/66 · 0 |
| GT + 0.02 noise (≈13 px at 640) + 10% random drop-outs | test 81/84 · 1 |
| GT removed whenever the tip moves > 0.015 image widths/frame (simulated blur, 80% of frames kept), no gap bridging | test 69/84 · 8 |
| same, with gap bridging | test 81/84 · 0 |
| GT kept only on the frames where the real detector fires (conf ≥ 3, ~55%) | LOBO 56/66 · 4 |

So the angle carries the information and noise is tolerated. **Coverage** (the share of frames with a blade) is what matters.

## Step 2: practical detector (`src/live/bladeDetector.ts`)
The detector is classical: CPU only, no model download, about 2.7 ms per frame at 640 px in Node, alongside MediaPipe Lite.

**How it works:**
- **Ray search:** for 120 ray directions from the hand centre, and for line offsets of ±0.15 torso, it averages a signed thin-ridge response along the part of the ray where the blade must be (0.45–1.3 torso from the hands). The response is the centre pixel minus the mean of both sides, minus the side difference.
- **Why the offsets:** the wrists are not on the blade line because the grip is inside the fists. Searching the offsets took the median angle error from 12° to 1.4°.
- **Body exclusion:** directions that run through the MediaPipe body (bones and joints, within 0.2 torso or 15°) are suppressed. Otherwise the arm/torso outline wins when the blade points forward.
- **Confidence:** the best direction divided by the best rival direction more than 20° away. The threshold `BLADE_MIN_CONFIDENCE = 3` was chosen on train LOBO (thr 2 gave 52/66 · 8, thr 3 gave 55/66 · 6).
- **Tip:** the tip is placed at the typical 2D blade length (2.0 torso). Walking along the ray to find the tip was less reliable.

**Detection error against the ground truth** (all frames of the strike clips; `det_error` in the PR body):

| split | conf ≥ 2: detected | angle err median | < 15° | conf ≥ 3: detected | angle err median | < 15° |
|---|---|---|---|---|---|---|
| train | 72% | 1.4° | 98% | 59% | 1.3° | 100% |
| reserved test (degraded: noise, CRF 28, downscale, drops, az ±40°) | 69% | 1.6° | 90% | 51% | 1.3° | 98% |

The tip error is about 30 px at 640 px. Most of it comes from foreshortening, because the tip uses a fixed length.

**End-to-end, real detector** (conf ≥ 3, detector run on all clips including footwork; own · wrong):

| | 2D body only | + detected blade |
|---|---|---|
| train LOBO strikes M/E | 51/66 · 10/528 | 55/66 · 6/528 |
| train LOBO strikes beginners | 18/33 · 5/264 | 21/33 · 4/264 |
| train LOBO steps M/E · beginners | 51/56 · 3 / 26/28 · 3 | unchanged |
| **test strikes M/E** | **65/84 · 11/672** | **62/84 · 9/672** |
| test per strike M/E (Scheitelhau / Zornhau / Krumphau / Schielhau / Zwerchhau) | 7 / 17 / 13 / 14 / 14 | 10 / 18 / 12 / 13 / 9 |
| test strikes beginners | 30/44 · 6/352 | 33/44 · 4/352 |
| test steps M/E | 57/64 · 3/512 | 56/64 · **4**/512 |
| test steps beginners | 28/32 · 3/256 | 28/32 · 2/256 |

**Scenario check** (`check-motion-scenarios.mjs --blade`, main clips, in-sample):

| scenario | flag off | --blade |
|---|---|---|
| fast | 52/54 | 51/54 |
| fps10 | 51/54 | 49/54 |
| slow4x | 50/54 | 47/54 |
| truncated strikes | 0/30 | 0/30 |
| all other negatives | 0 | 0 |

Krumphau clips are taken for Zwerchhau.

**Verdict:**
- Scheitelhau improves (7 → 10/18) and wrong-drill strike accepts go down.
- Zwerchhau collapses (14 → 9/16), the own rate drops by 3, and one more footwork wrong-drill accept appears.
- That is not a clear improvement, so the flag stays off and the PR is not merged.

## Why the real detector falls short of the upper bound
- **Coverage, not accuracy.** On the frames where it fires it is almost always right. But it fires on only ~51% of the test frames, and the masked-GT simulation shows that this coverage alone caps the gain at about LOBO 56/66.
- **Hard cases** are the frames it misses:
  - a forward-horizontal blade (Zwerchhau finish), a thin bright blade on a bright wall;
  - a blade pointing towards or away from the camera (azimuth ±20–40°, short in 2D);
  - a blade over the body;
  - the fast part of the swing (motion blur; the blade is nearly invisible in the renders).
- **The footwork clips have no sword.** The detector there produces occasional spurious lines, and in real use a sword is always held.

## Real-world risks
- **Synthetic-to-real gap.** The renders show a clean, uniformly lit steel blade against a plain wall. Real gyms have cluttered backgrounds, other people, mirrors, wall-bar lines and floor markings, all of which produce straight thin ridges. Feders/wasters are matte, black or white; nylon is black. Specular steel flickers.
- **Motion blur.** Webcams at 30 fps with auto exposure blur the blade for most of the swing, even more than in the renders. The design depends on gap bridging from the slow phases.
- **Hands.** Both wrists must be tracked. MediaPipe loses the far wrist at some angles, and the hands' detection jitters.
- **Thin and low-resolution.** At 640 px a blade is 1–3 px wide. Lower webcam resolution or heavy compression (video calls, phones) erodes the ridge.
- **CPU.** About 3 ms per frame at 640 px plus `getImageData` (measured in Node, not yet on a phone). Mobile throttling is unmeasured.
- **Not validated on real video yet:** no real recordings with ground truth exist.

## Next steps (if pursued)
1. **Raise coverage:**
   - temporal tracking (search near the last angle at a lower confidence);
   - colour or temporal-difference cues for the blur streak;
   - a tiny learned keypoint model (guard and tip heatmaps on a hand-centred crop, trained on the renders with background, blur and blade-material augmentation, run with WASM/WebGL).
2. **Render footwork with a sword** so that the footwork templates carry realistic blade channels.
3. **Collect a few real recordings** with hand-labelled blade lines before any decision to enable the flag.

## Reproduce
- Ground-truth experiments use the generator sidecars; the scripts are listed in PROGRESS (Session 4).
- `node frontend/scripts/build-blade-fixture.mjs <baClipsRoot> <heldoutRoot>` rebuilds `test-fixtures/motion-blade.json.gz`. It needs the videos.
- `node frontend/scripts/build-motion-patterns.mjs` rebuilds both models; `--check` verifies them in CI.
- `node frontend/scripts/check-motion-scenarios.mjs --blade` runs the scenario check on the blade path.
