# Phase 5 step 4: real-shape strikes in the fixture/model, evaluation (2026-10-07, UTC+5)

The real-shape batch `/workspace/hema/ba3` has 96 renders: zornhau, zwerchhau and schielhau, 32 each. The train split
is 5 bodies × master/experienced/beginner plus 5 slow/paused clips. The test split is 2 bodies × 3 levels × azimuth
0/40. The renders were extracted with the in-app browser MediaPipe and use preset `real_v3` (see `PILOT.md`). All
tuning and the choice of config used only synthetic data, the 30 seen real clips and the idle set. The locked fresh
set was run **once** (tag `P5`) after the config was chosen.

**Caveat: the fresh set is partially contaminated.** The phase-3 and phase-4 funnel diagnosis came from fresh runs and
motivated the phase-4 detection work. Fresh is no longer a fully blind held-out set.

## Fixtures
- **MIX** (`build-motion-fixture.mjs --base <phase-4 fixture> ba3/raw:ba:ba3/clips`): 462 + 75 `_rs` clips = 537.
- The clearance gate (> 9 sword-through-body frames) **dropped 21 of the 96 `_rs` clips**:
  - zwerchhau train: 12 of 20 dropped.
  - zwerchhau test: 5 of 12 dropped.
  - schielhau train: 4 of 20 dropped.
  - The cause is the high-hilt zwerchhau finish on most bodies. The pilot body tall_slim_male had 0 failing frames.
  - So the zwerchhau real-shape coverage is thin: 8 train, 7 test.
- **REPLACE** (`fxfilter.mjs`): MIX without the old synthetic *train* clips (main + ba:train) of the three strikes.
  It has 467 clips. Core strike training is `_rs` only: zornhau 20, zwerchhau 8, schielhau 16.
- Batch-wide shape check (`results/measure_batch.txt`, same rep definition as the real reps), share of shape measures
  in tolerance:

  | drill | mean in tolerance | clips with every measure in tolerance |
  |---|---|---|
  | schielhau | 83 % | 5/32 |
  | zornhau | 78 % | 4/32 |
  | zwerchhau | 67 % | 5/32 |

  The most frequent misses are dx and end hand_x (the arms are less extended at az 40 because of foreshortening),
  then duration.

## Configs (`step4.sh`; results in `results/p5_<tag>.txt`, old/_rs split in `results/p5_<tag>_synsplit.txt`)
- P4 = burst detection + activity gates (the phase-4 default).
- P3 = settle detection, gates off (`|stepMax: 9, strikeMin: 0|settle`).

Synthetic, streaming. "old" = the phase-4 test/LOBO clips, so these rows compare directly with P4. `_rs` = the new
real-shape test clips. Values are own, wrong.

| config | test old M/E | test old beginner | LOBO old M/E | test `_rs` M/E | test `_rs` beginner | old core-strike test M/E |
|---|---|---|---|---|---|---|
| main (reference) | 122/148, 14 | 58/76, 9 | 102/122, 13 | – | – | – |
| P4 baseline | 125/148, 19 | 49/76, 21 | 135/171, 23 | – | – | – |
| mixP4 | 125/148, 21 | 47/76, 20 | 138/171, 21 | 20/21, 0 | 7/10, 0 | 40/50, 7 |
| repP4 | **98/148, 40** | 40/76, 23 | 104/120, 12 | 19/21, 0 | 8/10, 0 | **7/50, 32** |
| **mixP3** | **126/148, 14** | **51/76, 10** | **142/171, 14** | 21/21, 1 | 9/10, 1 | **44/50, 4** |
| repP3 | **92/148, 42** | 43/76, 18 | 106/120, 7 | 21/21, 1 | 9/10, 0 | **6/50, 39** |

REPLACE throws away the old high-guard strike templates. The old-style synthetic strikes then collapse (core 7/50 and
6/50) and get accepted as other drills, so REPLACE is rejected.

Seen real clips (30 clips / 17 clean; generic, MODE=none). Idle = 12 × 6 s non-drill segments with all drills selected.

| config | own all | wrong all | own clean | wrong clean | strikes all | core own all / clean | idle false accepts | funnel clean (no_start/no_decision/short/tracking/other/accepted) |
|---|---|---|---|---|---|---|---|---|
| P4 baseline | 9/30 | 5/240 | 5/17 | 4/136 | – | 7/22 / 4/12 | 2/108 | 0/7/0/0/5/5 |
| mixP4 | 10/30 | 6/240 | 5/17 | 5/136 | 2/16 | 8/22 / 4/12 | **1/108** | 0/7/0/0/5/5 |
| repP4 | 12/30 | 6/240 | 5/17 | 5/136 | 2/16 | 9/22 / 4/12 | 2/108 | 0/8/0/0/4/5 |
| **mixP3** | **12/30** | 6/240 | **7/17** | **4/136** | **3/16** | **9/22 / 5/12** | 3/108 | 2/1/1/0/6/7 |
| repP3 | 12/30 | 7/240 | 6/17 | 5/136 | 2/16 | 8/22 / 4/12 | 2/108 | 2/1/1/0/7/6 |

Adding real templates leave-one-person-out (MODE=lopo) gave no gain in any config: equal, or 1 own lower.

## Decision: mixP3 (commit `baa96ed`)
mixP3 is MIX + settle detection + activity gates off:
- **Synthetic:** best of the four and no regression against P4 on any old-clip number (test wrong 19 → 14, beginner
  wrong 21 → 10, LOBO 135 → 142).
- **Seen clean:** best own (7/17, P4 5/17) and the fewest seen-clean wrong accepts (4/136).
- **Seen core clean:** best own (5/12).
- **Cost:** idle false accepts 3/108, against 2/108 for P4 and 1/108 for mixP4. One of the three goes into a core
  drill (idle_ukolov_255 → zwerchhau).
- **Known risk:** settle detection brings back "never started" on real clips (seen clean no_start 2). Phase 4 had
  removed that on fresh.
- **Against main:** beginner own is 51/76, below main's 58/76. P4 had already dropped it to 49.

## FINAL fresh (tag P5, run once; `results/FINAL_fresh_P5*.txt`)
| | generic all | generic clean (= core clean) | personal all | personal clean |
|---|---|---|---|---|
| P3 (phase 3) | 1/35, wrong 4/280 | 1/23, 3/184 | 3/92, 8/736 | 3/62, 6/496 |
| P4 (phase 4) | 3/35, 1/280 | 1/23, 1/184 | 8/92, 0/736 | 1/62, 0/496 |
| **P5 = mixP3** | **1/35, 4/280** | **1/23, 3/184** | **3/92, 8/736** (generic 1/92) | **3/62, 6/496** (generic 1/62) |

- **Strikes:** P5 is the first config that accepts a fresh strike. Generic: forge_zornhau_01, 1/19 clean strikes.
  Personal calibration: 3/58 strikes (schilt 2/12, forge 1/2). P4 accepted 0 strikes.
- **Steps:** P5 accepts none. Clean advance is 0/2 (P4: 1/2).
- **Wrong accepts (generic clean, 3/184):**
  - forge_zornhau_01 → retreat and → schielhau.
  - schwaben_zornhau_02 → advance.
- **Core drills, clean:** own 1/23, wrong-on-core-clips 3/184 (1.6 %), wrong-into-core 2/92.
- **Funnel, own runs** (no_start / no_decision / short / tracking / other / accepted):
  - All 35: 16/14/2/0/2/1 (P4: 0/29/1/1/1/3).
  - Clean 23: **8/10/2/0/2/1** (P4: 0/20/0/1/1/1). Settle detection again never starts 8 of 23 clean fresh clips.
- **Per drill, clean:** advance 0/2, passing-step-forward 0/2, schielhau 0/4, zornhau 1/7, zwerchhau 0/8.

## CI (local, thresholds and tests NOT relaxed; `results/local_ci.log`)
- vitest: 1 of 62 fails (P4 had 3 failures).
  - The failure is beginner similarity: the beginner mean (74.8) must be < 71.2, i.e. ≥ 10 points below M/E.
  - LOBO M/E is 82.8 % (169/204, ≥ 80 %), so it passes again.
  - The continuousMotion "whole trajectory without holds" test passes again, because the gates are off.
- check-motion-scenarios FAILS:
  - normal 2 (0 allowed), fast 4 (2), fps10 12 (3), slow4x 10 (4), truncated 20 (19).
  - P4 failed normal 1, fps10 11, slow4x 19, truncated 20.
- check-vom-tag-clips, build-motion-patterns --check and the static build pass.

## Verdict: NOT merged
The bar is fresh clean core own ≥ 60 % with wrong accepts ≤ 5 %. P5 reaches 1/23 = 4 % (personal 3/62), so the bar is
not met. Local CI is red.

Real-shape renders do help:
- Synthetic: the best numbers of any phase.
- Seen clean: 7/17.
- The first fresh strike accept.

But the gap is still not closed. In order of size:
1. **Detection.** Settle mode never starts 8 of the 23 clean fresh clips. Burst mode starts them but leaves 20
   undecided.
   - The untested combination is the real-shape model with burst detection (mixP4 on fresh). It was not run, because
     fresh is run once only.
   - On seen data, mixP4 had the same clean own count as P4 (5/17).
2. **Templates.** Real strike attempts still land closer to other drills ("other") or stay above the accept distance.
   - Only 4 seen people provided the shape targets (3–4 reps per strike).
   - zwerchhau real-shape templates are few (8 train) because of the clearance gate.
3. **Data.** No own videos from the user. Fresh is small (23 clean clips, 8 people) and partially contaminated.

Next levers:
- Fix the zwerchhau clearance on the other bodies and re-render (12 + 5 clips).
- Use burst detection with a strike-specific accept on hand-trimmed windows.
- Get real recordings of the user (the bar: own ≥ 60 %, others ≤ 5 %).
