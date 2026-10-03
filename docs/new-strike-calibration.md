# New strike corpus: calibration and continuous recognition

> Recognition is superseded by the discriminative DTW recogniser described in [motion-recognition.md](motion-recognition.md). Its templates come from browser MediaPipe poses, not ground truth, so the ground-truth check below no longer reflects recognition quality. The calibration findings still apply.

Source: commit `5bfd619d01bc6be7570f6275fa35ec1bf53a51c0`, including the README and landmark sidecars for Krumphau, Scheitelhau, Schielhau and Zwerchhau. Each has six MP4s: two body types and three levels. Together with the previous corpus there are 54 clips.

## Findings and repairs

- The four new drills previously used checkpoint holds instead of whole trajectories. Ground-truth replay accepted 12 frozen new clips. Actual MP4 replay through calibration and personalised targets completed only 1/24 new clips at 30 fps before these changes.
- Side-view MediaPipe depth inflated measured shoulder width to 2.57–2.88 torso lengths in six checked master clips. Calibration now uses projected screen-space limb lengths in profile, leaves unobservable body widths unspecified, and rebuilds rather than blending old depth-inflated profiles. Projected lengths can still be shortened by foreshortening; they are not anatomical 3D measurements. Front-view calibration retains its existing behaviour.
- The four strikes now use ordered, baseline-relative whole-trajectory recognition. Templates come from master ground-truth landmarks and the labelled guard-to-finish intervals, excluding recovery. Beginners and experienced performers do not generate templates.
- Strike endpoint and stage tolerances allow shorter novice movements. Recognition remains separate from feedback about observable hand reach, foot movement and torso lean.
- Completion checks settling across a 200 ms camera-time window, avoiding endless attempts caused by alternating wrist jitter. A stricter strike start jump check rejects discontinuous pose changes.
- The inferred-video harness now includes the same calibration, personalisation and camera-view adaptation used by training, plus frozen, gap, slow, truncated and reversed mutations. MP4 remains developer test input; it is not exposed in production training.

## Validation

| Check | Result |
|---|---|
| Ground-truth normal, faster timestamps, 10 fps | 54/54 each |
| Ground-truth frozen, reversed, truncated, tracking gap, extreme slowdown | 0/54 accepted in each case |
| Decoded MP4 → MediaPipe Lite CPU → shared processor → calibration → personalised drill | 54/54 at each of 30, 15 and 10 fps |
| Inferred frozen, gap, extreme slowdown, truncated, reversed | 0/162 accepted in each case, 810 negatives total |
| Unit checks | 55 passed, including unreliable side depth and endpoint jitter regressions |
| Production build and static asset checks | Passed; engraving PNG integrity and absence of video-test UI checked |

Detailed results: `continuous-motion-results.json` and `video-motion-results.json`. Commands run from repository root:

```sh
node frontend/scripts/build-motion-patterns.mjs --check
node frontend/scripts/check-continuous-motion.mjs --write
python frontend/scripts/infer-mock-videos.py --output /tmp/hema-inferred
node frontend/scripts/check-inferred-motion.mjs /tmp/hema-inferred docs/video-motion-results.json
npm --prefix frontend test
node scripts/build-site.mjs
node scripts/check-static-build.mjs
```

## Scope of the evidence

These are synthetic bodies and scripted motions from one generation pipeline. Passing them does not establish reliability on real students. The browser WASM runtime and live camera were not exercised; actual MP4 inference used Python MediaPipe 0.10.21 CPU with the same pinned Lite model. Lower frame rates subsample inferred landmarks rather than rerunning MediaPipe at those rates. Negative examples are programmatic mutations, not recordings of real mistakes. Side-view body landmarks cannot establish blade orientation, edge choice, grip, crossing of the wrists in depth, or distinguish every visually similar strike. The current system checks a selected drill's observable body trajectory, not an unrestricted strike classifier or a technique grade.
