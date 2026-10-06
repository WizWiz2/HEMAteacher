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

## Full gen2 (54 jobs) + recognizer changes (fixture 462 clips / 171 train templates)
Additions: `hand_share` channel (hand path / (hand + feet path), weight 1), `styleGroups` (matching scales per drill x
render style base/fwpflug/fwtag/lowtag), `HAND_TRIM` (strike attempts trimmed to the 5-95 % hand-path span +-150 ms),
`STRIKE_SCORING.feet` (feet-channel weight when a strike is selected).
| variant | LOBO M/E | test M/E own, wrong | test beginner own, wrong | seen all own, wrong | seen clean own, wrong |
|---|---|---|---|---|---|
| baseline (main) | 102/122, 13/976 | 122/148, 14/1184 | 58/76, 9/608 | 3/30, 3/240 | 1/17, 2/136 |
| shipped fixture + hand_share | - | 124/148, 11 | 60/76, 6 | 3/30, 2/240 | - |
| F0 gen2, shipped code | - | 111/148, 21 | 48/76, 11 | - | - |
| F1 gen2 + sg + hs | 133/171, 22 | 121/148, 15 | 56/76, 5 | 10/30, 8/240 (strikes 1/16) | 7/17, 5/136 |
| F2 F1 + HAND_TRIM | 137/171, 21 | 120/148, 13 | 55/76, 5 | 10/30, 8/240 | 7/17, 5/136 |
| F3a F2 + feet 0.3 | 136/171, 20 | 120/148, 13 | 57/76, 5 | 10/30, 8/240 | 7/17, 5/136 |
| **F3 F2 + feet 0 (chosen)** | 134/171, 22 | **123/148, 13** | 57/76, 6 | 10/30, 9/240 (strikes 1/16, steps 9/14) | 7/17, 5/136 |
Strike segmentation/scoring did not move seen strikes (1/16): after trimming, real strikes are hand-dominant
(hand_share .6-.8) but still lose to step templates on the arm/guard channels (hand_y, forearm_cos, hand_over_head).

## FINAL fresh evaluation (locked set, run once with F3; baseline main run afterwards for comparison only)
| | generic all | generic clean | personal all | personal clean |
|---|---|---|---|---|
| main | own 0/35, wrong 0/280 | own 0/23, wrong 0/184 | own 1/92, wrong 0/736 | own 1/62, wrong 0/496 |
| F3 | own 2/35 (strikes 2/25, steps 0/10), wrong 5/280 (1.8 %) | own 2/23, wrong 4/184 (2.2 %) | own 4/92, wrong 10/736 (1.4 %) | own 4/62, wrong 8/496 (1.6 %) |
(personal = per-attempt, leave-one-out personal templates; generic rows there count attempts, not clips.)
Bar (fresh clean own >= 60 %, wrong <= 5 %): NOT met (clean own 9 % generic, 6 % personal).
Local CI with the gen2 model: vitest LOBO 78.4 % < 80 % and beginner-similarity test fail; check-motion-scenarios fails
(fast 4/2, fps10 6/3, reversed 1/0). F2/no-trim also fail the scenarios, so the gen2 templates themselves cost robustness.
