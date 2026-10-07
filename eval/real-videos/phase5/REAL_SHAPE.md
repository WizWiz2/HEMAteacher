# Phase 5 — real strike shape (SEEN clips only)

Source: MediaPipe poses of the 30 seen real clips (`/workspace/hema/real/rawframes`), stritschar (sword & buckler)
excluded, the fresh locked set never touched. Measured in the recognizer feature space (LiveSampleProcessor:
hip-relative torso units, x forward, y up) by `measure.mjs`. A rep is a hand-speed burst (≥ .25 × clip peak, gaps
< 200 ms merged, peak ≥ .4 × max) with net forward hand travel ≥ .15; start/end pose = median of the 250 ms before /
after the burst. Old synthetic = one rep (largest forward travel) per base M/E clip of the committed fixture.
Contact sheet of the real reps: `sheet_real_reps.jpg` (frames 200 ms before, mid, 200 ms after each burst).

**Caveat:** usable real reps are few — zornhau 3 (becker, bjorn), zwerchhau 4 (drey, laurel), schielhau 4 (bahff,
laurel); krumphau (drey only) bursts are fidgets with the blade upright, scheitelhau has no usable seen reps.
Medians at n=3–4 are unstable (bjorn and laurel_zwerchhau_04 have suspect facing/tracking), so the targets below are
consensus values from the per-rep table (`real_shape_targets.json` → `per_rep`) with wide tolerances.

| drill | measure | real (target ± tol) | old synthetic | difference |
|---|---|---|---|---|
| zornhau | start hand_y / over shoulder | .95 ± .15 / 0 ± .15 | 1.11 / +.10 | real guard lower (chest/shoulder) |
| | end hand_x | .95 ± .15 | .79 | real reaches further forward |
| | forward travel dx / dy | .8 ± .3 / −.05 ± .2 | .41 / −.30 | real = horizontal forward extension, synthetic = short diagonal drop |
| | burst duration | ~900 ms ± 40 % | 434 ms | ~2× slower |
| zwerchhau | end hand_y / over head (nose) | 1.41 ± .15 / +.10 ± .15 | 1.11 / −.21 | real finishes with the hands ABOVE the head |
| | end forearm angle | ~80° ± 30 (near vertical) | 37° | real forearm upright under the high hilt |
| | dx / dy | .6 ± .25 / 0 ± .2 | .47 / −.03 | similar travel, but at head height |
| | burst duration | ~1100 ms ± 40 % | 667 ms | ~1.7× slower |
| schielhau | start hand_y / over shoulder | .69 ± .15 / −.31 ± .15 | 1.17 / +.16 | real starts LOW (hands at chest, blade on the shoulder) |
| | end hand_x / hand_y | 1.18 ± .15 / 1.0 ± .2 | .75 / .94 | real arms fully extended |
| | dx / dy / direction | .8 ± .3 / +.3 ± .25 / +25° ± 20 | .43 / −.22 / −33° | real path rises forward, synthetic descends |
| | burst duration | ~420 ms ± 40 % | 500 ms | similar |
| all | step during the strike | 9 of 11 reps | 100 % | both step |

Tempo: the hand burst itself is ~1.5–2× slower than the old synthetic master/experienced (not 4×); the ~4× figure of the
whole rep comes from pauses/holds between reps, which the slow/paused variants model (tempo 2–2.8, hesitation .6 s,
long guard hold).

Generator mapping (keyframes are in the same matcher frame but render → MediaPipe shifts them, e.g. the guard
keyframe hand_x .72 reads ~.37) is calibrated on pilot renders: see `PILOT.md`.
