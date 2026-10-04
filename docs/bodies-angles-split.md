# Bodies and camera angles: data split (fixed before any results were seen)

Written 2026-10-03 14:05 (UTC+5), before rendering or evaluating any new clip. These assignments must not change after results are seen.

## Bodies

All bodies are MPFB2 macro bodies rendered with the existing Blender pipeline (`/workspace/hema/gen`). The same clearance (pose collision) and face-visibility checks are applied to every body.

| Body | Split | Macro (gender, age, muscle, weight, proportions, height) |
|---|---|---|
| tall_slim_male (existing) | train | 1, .50, .45, .15, 1.0, .61 |
| short_broad_female (existing) | train | 0, .62, .65, 1.0, .25, .42 |
| short_slim_male | train | 1, .35, .40, .10, .60, .25 |
| tall_heavy_male | train | 1, .60, .55, .90, .50, .85 |
| avg_longlimb_female | train | 0, .45, .50, .45, 1.0, .55 |
| **tall_slim_female** | **TEST (reserved)** | 0, .40, .45, .15, .85, .85 |
| **stocky_short_male** | **TEST (reserved)** | 1, .70, .70, .80, .30, .20 |
| medium_stocky_male (existing held-out) | TEST (reserved) | 1, .75, .60, .60, .50, .50 |

The TEST bodies are never used for templates, scales, thresholds, feature design, margins or any tuning. Their clips are only evaluated, once per model version, and the results are reported as-is.

MPFB has no separate arm-length macro. "avg_longlimb_female" uses proportions = 1.0, which gives long limbs, rather than a real long-arm modifier.

## Cameras

The person faces +x. Azimuth is measured from pure profile: positive values swing the camera toward the person's front, negative values toward the back. The camera looks at (0.7, 0, 1.12) from distance d at height h.

- **Train clips.** Each clip gets its own random camera, seeded from the clip name:
  - azimuth uniform in [−25°, +45°];
  - h uniform in [1.0, 1.5] m;
  - d uniform in [3.0, 3.9] m;
  - lens uniform in [20, 26] mm.

  Amended at 14:08, before any results existed, because d = 2.9 m with a 28 mm lens cuts off the feet of the tallest bodies.

  The existing train bodies get additional renders under this random-camera scheme. The original 0° clips stay in training.
- **Test clips.** Test bodies are rendered on a fixed grid: azimuth 0°, +20°, +40° (front-side) and −20° (rear), at h = 1.25 m, d = 3.3 m, lens 24 mm. The existing held-out camrear25 clips (−25°) are also test data.
- **Webcam degradation**, applied to both splits:
  - render at 640×360, with some train clips further downscaled to 480×270;
  - sensor noise via `postprocess.py`, sigma uniform in [0.008, 0.03] (train);
  - H.264 at CRF 23–32;
  - dropped frames, simulated by duplicating the previous frame at random positions (about 3–8 % of frames).

  Test clips use one fixed mid-level setting: 640×360, noise sigma 0.02, CRF 28, 5 % dropped frames.

## Clip quality gate (fixed before any recognition result)

- **Excluded:** clips with more than 9 clearance-failing frames (5 % of 180). This is the generator's pose-collision check.
- **Recorded but not used to exclude:** face-hidden frames. At non-profile azimuths the guard (hands, grip, blade) covers the face; this is real camera-dependent occlusion and part of the angle-robustness test.
- **Excluded:** clips whose render or degradation failed.

## Protocols reported

1. **Before:** the PR #16 model (trained on the existing two bodies at 0°) evaluated on all TEST clips.
2. **After:** the new model, trained on all train bodies and cameras, evaluated on the same TEST clips.

Reported per protocol, per test body and per azimuth: own-drill rate and wrong-drill accept rate. Leave-one-body-out within the train bodies may be used for design and tuning.
