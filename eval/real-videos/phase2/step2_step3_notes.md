# Phase 2 / steps 2-3 working notes

## Step 2: synthetic distribution (gen2 = env-gated copy of the generator, `gen2.patch` vs /workspace/hema/gen)
- `HEMA_FW_GUARD=pflug|tag`: footwork rendered WITH the longsword held in Pflug (hands 0.70/0.60 torso lengths from the
  hip centre, blade 35 deg) or in a Vom Tag at the shoulder (Zornhau-fit-like upper body, hand height 0.85). Before, the
  footwork clips had no sword and hanging arms (real step clips carry the sword at chest height).
- `HEMA_GUARD_OVR`: lower Vom Tag for the strikes (hand height 0.72-0.85 instead of ~1.08; guard + return keyframes).
  Real vom Tag is held LOWER than the synthetic one (shoulder, not head height - see PR #21 sign correction).
- `HEMA_LEVEL_OVR`: slow / paused variants (tempo 2.0-2.4, hesitation 0.6 s, 240 frames).
- `jobs2.tsv`: 54 train-body jobs (24 footwork with sword, 15 low-Vom-Tag strikes, 15 slow strikes), master/experienced
  only (isTrainClip). Runner `run_ba2.sh`, pose extraction `extract_loop.sh` (browser MediaPipe lite, raw dumps).
- Fixture: `build-motion-fixture.mjs --base <shipped gz> <ba2 raw>:ba:<ba2 clips>` appends the new train clips.

## Step 3 experiments (tuned on synthetic + the 30 seen clips only; harness exp.sh / eval_seen.sh / score_seen.py)
| variant | LOBO M/E own, wrong | test M/E own, wrong | seen all own, wrong | seen clean own, wrong |
|---|---|---|---|---|
| baseline (main) | 102/122, 13/976 | 122/148, 14/1184 | 3/30, 3/240 | 1/17, 2/136 |
| relA1: hand x/y/over-head relative to attempt start (guard-height normalisation) | 105/122, 10/976 | 120/148, 16/1184 | 2/30, 1/240 | 1/17, 1/136 |
| segS1: also try windows starting at earlier undecided settles | 102/122, 13/976 | 122/148, 15/1184 | 3/30, 5/240 | 1/17, 3/136 |
Neither adopted: real own distance / accept stays ~1.4x (relA1 1.41 vs 1.40), so normalisation/segmentation alone
cannot bridge the gap; the templates themselves must move (step 2).
