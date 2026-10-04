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
- **Model.** `src/drill/motionModel.json` is built by `frontend/scripts/build-motion-patterns.mjs` from the pose fixture `frontend/test-fixtures/motion-poses.json.gz`. The fixture holds browser MediaPipe Lite poses of 413 clips: 54 main, 6 guards-basic, 8 held-out and 345 bodies/angles clips (6 excluded by the clearance gate). The builder also writes the trigger/feedback patterns `src/drill/motionPatterns.json`, now from MediaPipe rather than ground truth.
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
node frontend/scripts/check-motion-scenarios.mjs              # CI gate: scenarios on recorded MediaPipe poses (below)
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

The accept distance does not limit acceptance across bodies (own distances 0.6–2.5 vs `acceptDistance` ≈ 3); the misses are look-alike drills (Scheitelhau ↔ Schielhau/Zornhau, Krumphau ↔ Zwerchhau), whose difference lies mostly in depth and blade rotation. A lower margin trades those misses for slightly more wrong-drill accepts.

The settings were frozen (4fcba78) after tuning on the train strikes. The test clips were first evaluated once on the 62 test strike clips rendered by then. After all 351 renders finished, the fixture and model were rebuilt with the same settings (more training clips, no retuning) and evaluated once more on all reserved test clips. Command: `evaluate-motion-recognition.mjs <out> lobo,before,test`. "before" is the PR #16 model, trained on the main profile clips of two bodies.

Own drill accepted | wrong drill accepted:

| protocol | strikes M/E | steps M/E | strikes beginner | steps beginner |
|---|---|---|---|---|
| train LOBO (5 bodies) | 51/66 (77%) · 10/528 (1.9%) | 51/56 (91%) · 3/448 (0.7%) | 18/33 (55%) · 5/264 (1.9%) | 26/28 (93%) · 14/224 (6.2%) |
| test, before (PR #16) | 36/84 (43%) · 4/672 (0.6%) | 17/64 (27%) · 1/512 (0.2%) | 6/44 (14%) · 0/352 | 5/32 (16%) · 0/256 |
| test, after (shipped) | 65/84 (77%) · 13/672 (1.9%) | 57/64 (89%) · 3/512 (0.6%) | 31/44 (70%) · 8/352 (2.3%) | 28/32 (88%) · 14/256 (5.5%) |

Reserved test clips, master/experienced, by azimuth (before → after):

| azimuth | strikes own | strikes wrong | steps own | steps wrong |
|---|---|---|---|---|
| −20/−25° (behind profile) | 2/22 → 13/22 | 3/176 → 7/176 (4.0%) | 4/16 → 14/16 | 0/128 → 1/128 |
| 0° (profile) | 20/22 → 17/22 | 1/176 → 2/176 | 13/16 → 15/16 | 1/128 → 2/128 |
| +20° | 14/20 → 19/20 | 0/160 → 0/160 | 0/16 → 15/16 | 0/128 → 0/128 |
| +40° | 0/20 → 16/20 | 0/160 → 4/160 | 0/16 → 13/16 | 0/128 → 0/128 |

By test body (M/E, own after): stocky_short_male strikes 33/40, steps 29/32; tall_slim_female strikes 29/40, steps 28/32; medium_stocky_male (earlier held-out) 2/2. Mutations on the main clips are unchanged: reversed 0/54, frozen 0/54, 12× slow 0/54, and 4× slow 50/54 accepted.

The framing check (nose required) did not block any angle on these renders. MediaPipe reports the nose as visible even when the guard covers the face, and motion framing was ready on all but the first frame at every azimuth.

## Completion and tempo checks (fix/recognizer-completion-tempo)

All thresholds were chosen on training clips only (main + bodies/angles train bodies).

- **Strike completion.** An attempt is accepted only if its path length (the same metric as the path-length parameterisation) reaches 65% of the drill's median template path (`model.typicalPath`, `model.minPathRatio`). Whole strikes reach ≥ ~0.8 of it on train clips; strikes frozen half-way reach ≤ 0.55. Footwork paths overlap, so footwork has no path check. A strike stopped short stays open ("Продолжай движение до конца").
- **End stance (advance/retreat).** The final foot spacing must be at least 0.5 × the starting spacing (`model.minEndStance`). Own advance/retreat attempts end at ≥ 0.87. Passing steps paused at the crossing (feet together) and accepted as advance/retreat end at ≤ 0.35 (one at 0.63). 0.75 would also have rejected fast (0.6× time) and 10 fps steps that settle before the trailing foot arrives. A step not yet back in stance is re-checked at the next settle.
- **Tempo window.** If an earlier settle already contained the selected drill's whole movement (nearest drill, within the accept distance, ≥ 85% of the typical path) but was ambiguous, a later acceptance measures the tempo only up to that settle. This removes the ~5.5× false slow notes caused by the return movement being counted.

Effect (full evaluation, own drill · wrong drill accepted):

| | before (a4b7f73) | after |
|---|---|---|
| train LOBO M/E | 102/122 · 13/976 | 102/122 · 13/976 |
| train LOBO beginners | 44/61 · 19/488 (3.9%) | 44/61 · 8/488 (1.6%) |
| test strikes M/E | 65/84 · 13/672 (1.9%) | 65/84 · 11/672 (1.6%) |
| test steps M/E | 57/64 · 3/512 | 57/64 · 3/512 |
| test strikes beginners | 31/44 · 8/352 | 30/44 · 6/352 |
| test steps beginners | 28/32 · 14/256 (5.5%) | 28/32 · 3/256 (1.2%) |
| scenario check: truncated strikes | 2/30 accepted | 0/30 |
| master/experienced slow notes (LOBO) | 3/102 (two ~5.5×) | 2/102 (1.61×, 1.65×) |

Mutations are unchanged: reversed, frozen and 12× slow 0/54 accepted; 4× slow 50/54 accepted.

## Limitations

- **Scheitelhau / Schielhau.** These are nearly identical in side-view 2D landmarks; their difference is mostly blade and edge rotation. Krumphau is also weak with single-body templates. Together they account for most leave-one-body-out misses.
- **Camera angle.** Front angles up to 45° work once they are in the training data. Behind profile (−20/−25°) remains the weakest angle for strikes on the reserved test clips: own 13/22 and wrong-drill 7/176 (4.0%, the highest of any angle).
- **Ground-truth skeletons.** `check-continuous-motion.mjs` (ground-truth Blender skeletons) no longer matches the template domain: 15/54 "normal". The templates are MediaPipe-based, and ground-truth landmark definitions differ (nose, wrists). It is kept as a diagnostic only. CI runs the same scenarios on the recorded MediaPipe poses instead (`check-motion-scenarios.mjs`, main clips, shipped model):

  | scenario | expected | accepted |
  |---|---|---|
  | normal | accept | 54/54 |
  | fast (0.6× time) | accept | 52/54 |
  | 10 fps | accept | 51/54 (PR #16 model: 48/54) |
  | 4× slow | accept | 50/54 (4 slow beginners exceed the 10 s bound) |
  | reversed | reject | 0/54 |
  | frozen | reject | 0/54 |
  | 12× slow | reject | 0/54 |
  | truncated half-way | reject | 19/54, all footwork (strikes 0/30 with the completion check; before it 2/30) |
  | 500 ms tracking gap | reject | 0/54 |

  The known gaps are allowed explicitly; any further unexpected outcome fails CI.
  - Footwork stopped half-way is accepted (see "Footwork stops early").
  - A few footwork clips at 10 fps or 0.6× time are not accepted.
  - Some 10 fps attempts stay open ("Продолжай движение до конца").
- **Footwork stops early.** Footwork may be accepted at a mid-step pause, so its tempo estimate is too low: only 3/26 slow footwork beginners get the slow note (strikes 17/18). Beginner passing steps paused at the crossing used to be accepted as advance/retreat. The end-stance check (below) cut that from 14/256 (5.5%) to 3/256 (1.2%) on the test clips.
- **Slow-note threshold.** 2 of 102 master/experienced attempts get the slow note under train LOBO, at 1.61× and 1.65× (threshold 1.6×). The earlier ~5.5× false notes came from an attempt window that ran from the whole strike through the return, after an ambiguous settle; they are fixed (below).
- **2D ceiling for look-alike strikes.** Scheitelhau ↔ Schielhau/Zornhau and Krumphau ↔ Zwerchhau differ mostly in depth and blade rotation. Scheitelhau is the weakest drill: 7/18 own on test, 6/14 under LOBO. Strike LOBO stays at about 77%, below the 90% target, and the tried variants did not move it: per-drill accept distances, fitted channel weights, k-NN, and a wrist→index hand feature.
- **guards-basic is unchanged.**
  - The 3 female clips never finish calibration. In side view the far (left) elbow is below visibility 0.42 in 77–95 frames and elbow+wrist in 74–89 frames of 180. Framing for `upper_body` requires both elbows and both wrists, so only 10–22 frames per clip are ready, and calibration never completes.
  - The male clips get through calibration (51–63 ready frames) but stop at checkpoint 2.
  - The honest fix is a side-view framing rule that needs one complete near arm plus both shoulders and hips, together with checkpoints that only score the near arm and hand position. That changes framing for every upper-body drill and needs its own validation, so it is left for a follow-up and not faked here.
- **Synthetic data only.** All data is synthetic: 8 MPFB bodies, one renderer and scripted motion. It does not establish reliability on real students.
