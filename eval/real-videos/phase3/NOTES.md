# Phase 3: real strikes (narrowed scope: zornhau, zwerchhau, schielhau, passing-step-forward, advance)
Tuning used only synthetic data and the 30 seen clips. The locked fresh set (sha256 in phase2/fresh/LOCK.md) was run ONCE
with the chosen config (tag P3). The phase-2 runs F3 and BASE (main) are shown for comparison; they were not re-run.

## Step 1: guard-invariant arm representation (`ARM_REL` in motionRecognition.ts)
hand_x/y, wrist crossing and elbow angle become displacements from the attempt's start pose (positions are already in
torso lengths), and the forearm direction is rotated by its start angle. arm1 keeps the absolute hand-over-head channel
as the weak absolute-height cue; arm2 makes it relative too.

| config | LOBO M/E | test M/E own, wrong | beginner own, wrong | seen all own, wrong | seen clean own, wrong | seen core own (all / clean) |
|---|---|---|---|---|---|---|
| main (baseline) | 102/122, 13 | 122/148, 14 | 58/76, 9 | 3/30, 3 | 1/17, 2 | - |
| F3 (PR #22) | 134/171, 22 | 123/148, 13 | 57/76, 6 | 10/30, 9 | 7/17, 5 | 5/22 / 4/12 |
| **arm1 = P3 (chosen)** | **141/171, 19** | **126/148, 14** | 52/76, 8 | 10/30, 6 | 6/17, 4 | 7/22 / 4/12 |
| arm2 | 137/171, 17 | 119/148, 18 | 49/76, 12 | 9/30, 5 | 4/17, 5 | - |
Seen strikes stay at 1/16 in every variant.

## Step 2: templates cut from the real seen clips (`lopo.mjs`; stritschar sword-and-buckler clips excluded; fresh never used)
- Reps are cut by activity bursts: hand path for strikes, feet path for steps. A rep is dropped when it is cut at the
  clip start, its path is < 0.5x or > 3x the drill's typical path, or it matches its drill's synthetic templates better
  played backwards (that is the recovery to guard). Result: 21 reps from all longsword seen clips, 16 from clean clips only.
- Each seen person is scored against the synthetic templates plus the other persons' real reps (leave-one-person-out).

| F3 model + | seen all own, wrong | seen clean own, wrong | core own all / clean | wrong-into-core all / clean |
|---|---|---|---|---|
| nothing | 10/30, 9 | 7/17, 5 | 5/22 / 4/12 | 4/128 / 2/73 |
| real reps (all sources), LOPO | 10/30, 9 | 7/17, 6 | 5/22 / 4/12 | 5/128 / 3/73 |
| real reps only for strikes (synthetic strike templates removed), LOPO | 9/30, 12 | 6/17, 8 | 4/22 / 3/12 | 7/128 / 4/73 |

Not adopted: no gain, and more wrong-drill accepts.

The 1-NN diagnostic (`nn.mjs`) explains why. Real strike reps find a template of their own drill as nearest in only
~2-3 of 12 cases, under every representation tried (F3, arm1, arm2, scale floors .1/.2/.3, without styleGroups), and
adding other persons' real reps does not help. Real reps also do not cluster by drill across people.
Measured shape gap (`amp.mjs`, medians):
- Real strikes start from a shoulder-height guard and are mostly a horizontal extension. Synthetic strikes descend from
  a high guard.
- Real Zwerchhau ends with the hands above the head (hand-over-head +0.16); the synthetic one ends below the nose (-0.23).

Other segmentation attempts on seen, none helped:
- `STRIKE_GATE` (ignore footwork-only attempts when a strike is selected): no effect.
- Burst strike window (`HAND_TRIM.mode = "burst"`): strikes 0/16.
- Burst-cut personal calibration templates: worse (strikes 1/24 vs 6/24).

## Step 3: FINAL fresh (P3, run once)
| | generic all | generic clean | personal all | personal clean |
|---|---|---|---|---|
| main | own 0/35, wrong 0/280 | 0/23, 0/184 | 1/92, 0/736 | 1/62, 0/496 |
| F3 (phase 2) | own 2/35, wrong 5/280 | 2/23, 4/184 | 4/92, 10/736 | 4/62, 8/496 |
| **P3** | own 1/35, wrong 4/280 (1.4 %) | 1/23, 3/184 (1.6 %) | 3/92, 8/736 (1.1 %) | 3/62, 6/496 (1.2 %) |

Per drill, P3 generic own:
- Clean: zornhau 1/7, zwerchhau 0/8, schielhau 0/4, advance 0/2, passing-step-forward 0/2.
- All clips: zwerchhau 0/11, advance 0/4. Beta drills (krumphau, retreat, passing-step-backward) 0/7.

Core drills, P3 generic:
- All clips: own 1/28; wrong-drill accepts on core clips 3/224; wrong-into-core (any clip accepted as a core drill) 2/147.
- Clean (every clean fresh clip is a core drill): own 1/23, wrong on core clips 3/184, wrong-into-core 1/92.

Personal clean, per drill: zornhau 1/22, zwerchhau 2/24, schielhau 0/12, steps 0/4.

What the clean fresh clips did (generic own run, 23 clips):
- 10 never settled into a decision ("Двигайся без остановок").
- 8 never armed or never moved enough ("Прими исходную позицию" / "Готов").
- 2 stopped short ("Продолжай движение до конца").
- 2 were rejected as another drill.
- 1 was accepted.
So on fresh people the dominant blocker is attempt segmentation (arming and settle detection on continuous real
performances and low-res video), ahead of classification.

## CI with the P3 model (thresholds NOT relaxed)
- vitest: 61/62 pass. LOBO 82.5 % now clears the 80 % floor (F3 failed it at 78.4 %). The beginner-similarity test fails:
  the mean beginner similarity (73) must be at least 10 points below the master/experienced mean (80.8), but the gap
  is only 7.8.
- check-motion-scenarios FAILS:
  - normal 2 (0 allowed), fast 3 (2), fps10 13 (3), slow4x 10 (4), truncated 20 (19).
  - Cause: the guard-invariant channels lower the accept distance (3.84 to 2.93), so time-distorted synthetic clips
    exceed it more often.
- check-vom-tag-clips, build-motion-patterns --check and the static build pass.

## Verdict
The bar (fresh clean core own >= 60 %, wrong <= 5 %) is NOT met: generic 1/23 (4 %), personal 3/62 (5 %); wrong-drill
accepts stay low (1.2-1.6 %). Neither the guard-invariant arm channels nor templates cut from the seen clips moved real
strikes.

Next steps that the evidence supports:
1. Attempt segmentation for real, continuous performances: arm on a hand burst instead of a stable high guard, and
   decide at the end of the burst instead of waiting for a 200 ms still.
2. gen3 strike renders fitted to real shape: shoulder-height Vom Tag, horizontal extension, Zwerchhau finishing above the
   head.
3. Many more real people for templates. The seen set has 1-3 persons per strike, too few to cover between-person variation.
