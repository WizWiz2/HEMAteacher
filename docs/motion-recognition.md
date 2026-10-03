# Discriminative continuous-motion recognition

Applies to the nine continuous drills: Zornhau, Scheitelhau, Krumphau, Zwerchhau, Schielhau, advance, retreat, and passing step forward/backward. guards-basic is a pose-hold drill and is unchanged; see "Limitations".

## What changed

- **Discriminative acceptance.** Every finished attempt is matched against the templates of all nine drills; strikes and footwork share one candidate pool. The selected drill is accepted only if all three hold:
  - it is the nearest drill;
  - its distance is within `acceptDistance`;
  - the runner-up is at least `margin` = 1.05× farther away (1.15 in PR #16; see "Bodies and angles").

  If another drill wins clearly, the attempt fails with "Похоже на Zwerchhau, а не Scheitelhau. Повтори выбранное движение". The user still picks the drill. If neither the selected drill nor a rival wins clearly, the attempt stays open ("Продолжай движение до конца"), or fails as not recognised once the pose returns to the start.
- **Features.** Channels are screen-plane only and torso-length normalised; MediaPipe depth is never used (the elbow angle is computed in 2D). They are listed in `src/drill/motionRecognition.ts` `CHANNELS`:
  - action-hand position;
  - hand height above the nose (windup peak);
  - forearm direction, elbow→wrist (a blade-direction proxy);
  - elbow angle;
  - shoulder x-offset (torso rotation proxy);
  - left-minus-right wrist offset (hand crossing, e.g. Krumphau);
  - both ankles x/y;
  - root displacement;
  - torso angle;
  - hand path direction (vertical, horizontal or diagonal).

  Stance, foot and posture channels are taken relative to the attempt start, because their absolute values differ more between bodies than between drills (measured on the training clips).
- **Time-invariant matching.** The attempt is smoothed and re-sampled by path length (32 points), which removes tempo and pauses, then aligned with banded DTW. The old 4 s hard limit is gone; 10 s is the sanity bound. Slow attempts are recognised with lower similarity and a note: "Движение распознано, но выполнено слишком медленно (примерно в N раза дольше образцов)…". The note appears when the active duration (5–95 % of the path length) is more than 1.6× the training median.
- **Streaming.** The existing position → armed → moving segmentation is kept, with three changes:
  - a 300 ms pre-roll keeps the movement onset in the attempt;
  - the decision runs after 200 ms of settling;
  - the frame-gap limit is relaxed from 250 to 400 ms.

  The onset jump check now uses fixed torso-length bounds per frame (0.6 for hands, 0.3 for feet) instead of the template extent, which had been rejecting real fast steps.
- **Model.** `src/drill/motionModel.json` is built by `frontend/scripts/build-motion-patterns.mjs` from the pose fixture `frontend/test-fixtures/motion-poses.json.gz`. The fixture holds browser MediaPipe Lite poses of 68 clips: 54 main, 6 guards-basic and 8 held-out. The builder also writes the trigger/feedback patterns `src/drill/motionPatterns.json`, now from MediaPipe rather than ground truth.
  - Training split (`isTrainClip`): master + experienced of the main clips and of the bodies/angles train clips (five train bodies, random camera; `docs/bodies-angles-split.md`).
  - Matching scales: the within-drill spread of the training templates.
  - `acceptDistance`: 1.5× the largest leave-one-out same-drill distance among the training templates.
  - Channel weights are a-priori constants, not fitted.

## Honest evaluation

`npm test` (`src/drill/motionRecognition.fixture.test.ts`) streams the fixture through the app pipeline: LiveSampleProcessor → CalibrationGate → personalizeDrill/adaptDrillForCameraView → stepDrill. It builds confusion matrices for three protocols:

1. **Leave-one-body-out:** templates from one body's master and experienced clips; every main clip of the other body is tested against all nine drills.
2. **Shipped split:** the shipped model tested on the 18 main beginner clips.
3. **Held-out:** the shipped model tested on the 8 held-out clips (camera 25° behind profile, and the unseen medium_stocky_male body).

An attempt counts as accepted only if the first decided attempt completes the selected drill. The mock clips also contain the inverse return movement, which a retrying run may legitimately recognise as the inverse drill. The test also checks that the shipped model is reproducible from the fixture.

```sh
node frontend/scripts/build-motion-patterns.mjs [--check]     # model + patterns from the fixture
node frontend/scripts/evaluate-motion-recognition.mjs [out]   # all confusion matrices
node frontend/scripts/check-motion-mutations.mjs              # reversed / frozen / 4x / 12x slow
# fixture rebuild from raw browser dumps:
node frontend/scripts/build-motion-fixture.mjs frontend/test-fixtures/motion-poses.json.gz <rawdir>:main:test-data/mock-videos <rawdir>:heldout:<heldout root>
```

**Design-set contamination.** Design decisions were made on tall_slim_male clips, plus diagnostics on the training split (tall_slim_male master/experienced templates vs short_broad_female master/experienced clips). These included the relative channels, within-drill scales, pre-roll, jump bounds and the active-duration tempo. Those female master/experienced clips are training data in the shipped split, but test data in one leave-one-body-out fold, so that fold is somewhat optimistic. The beginners and the 8 held-out clips were not used for any design decision.

## Bodies and angles (branch feat/more-bodies-angles)

Split fixed before any results in `docs/bodies-angles-split.md`: five TRAIN bodies with a random camera per clip (azimuth −25…+45°, height, distance, lens) and degradation (resolution, noise, CRF, dropped frames); reserved TEST bodies tall_slim_female and stocky_short_male on a fixed azimuth grid 0/+20/+40/−20°, plus the earlier held-out clips. Clips with more than 9 frames failing the sword–body clearance QA are excluded (6 short_slim_male train clips).

Tuning used leave-one-body-out over the train bodies only (strikes M/E):

| change | LOBO M/E own | wrong-drill |
|---|---|---|
| PR #16 settings, 5 train bodies | 50/66 (76%) | 6/528 (1.1%) |
| per-drill accept distance; Fisher channel weights; k-NN (k = 2, 3) | 71–76% | 0.6–1.1% |
| hand path direction weight 0.5 → 1.5 | 51/66 (77%) | 5/528 (0.9%) |
| + margin 1.15 → 1.05 (shipped) | 54/66 (82%) | 8/528 (1.5%) |

The accept distance does not limit acceptance across bodies (own distances 0.6–2.5 vs `acceptDistance` ≈ 3.1); the misses are look-alike drills (Scheitelhau ↔ Schielhau/Zornhau, Krumphau ↔ Zwerchhau), whose difference lies mostly in depth and blade rotation. A lower margin trades those misses for slightly more wrong-drill accepts. The reserved test clips were evaluated once, after the model was frozen (`evaluate-motion-recognition.mjs … lobo,before,test`); see the PR / PROGRESS for the numbers. The framing check (nose required) did not block any angle on these renders: MediaPipe reports the nose as visible even when the guard covers the face, and motion framing was ready on all but the first frame at every azimuth.

## Limitations

- **Scheitelhau / Schielhau.** These are nearly identical in side-view 2D landmarks; their difference is mostly blade and edge rotation. Krumphau is also weak with single-body templates. Together they account for most leave-one-body-out misses.
- **Camera angle.** Front angles up to 45° work once they are in the training data, but cameras behind profile remain the weakest: on the reserved test clips at −20/−25° the shipped model accepted 4/8 own-drill strikes (M/E) with 4/64 wrong-drill accepts (6.3%). The PR #16 model, trained in profile only, recognised 0/13 at +40° and 1/8 at −20/−25°.
- **Ground-truth skeletons.** `check-continuous-motion.mjs` (ground-truth Blender skeletons) no longer matches the template domain: 15/54 "normal". The templates are MediaPipe-based, and ground-truth landmark definitions differ (nose, wrists).
- **Footwork stops early.** Footwork may be accepted at a mid-step pause, so its tempo estimate can be too low.
- **guards-basic is unchanged.**
  - The 3 female clips never finish calibration. In side view the far (left) elbow is below visibility 0.42 in 77–95 frames and elbow+wrist in 74–89 frames of 180. Framing for `upper_body` requires both elbows and both wrists, so only 10–22 frames per clip are ready, and calibration never completes.
  - The male clips get through calibration (51–63 ready frames) but stop at checkpoint 2.
  - The honest fix is a side-view framing rule that needs one complete near arm plus both shoulders and hips, together with checkpoints that only score the near arm and hand position. That changes framing for every upper-body drill and needs its own validation, so it is left for a follow-up and not faked here.
- **Synthetic data only.** All data is synthetic: 8 MPFB bodies, one renderer and scripted motion. It does not establish reliability on real students.
