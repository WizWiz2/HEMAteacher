# Phase 4: attempt detection
Tuning used only the 30 seen clips, a new idle set and the synthetic data. The locked fresh set was run ONCE (tag P4).
**Caveat: the fresh set is now partially contaminated.** The phase-3 funnel diagnosis (most fresh clips never started or
never settled) came from the fresh run and motivated this phase.

## Change (`DETECT` in continuousMotion.ts, `ACTIVITY_GATE` in motionRecognition.ts)
- **Burst detection (`DETECT.mode = 'burst'`, now the default):**
  - Arming needs only 200 ms of tracked pose. No stable high guard is required, and there is no start-pose cue.
  - An attempt starts when the activity speed exceeds 0.35 torso lengths/s for the hands (strikes) or 0.25 for the
    feet/root (steps), measured over a 100 ms window. Torso lengths make the threshold body-scale normalised.
  - It ends when the speed stays below max(0.15 (hands) / 0.1 (feet), 0.15 × the burst's peak) for 200 ms, or after
    3 s. There is no 200 ms pause requirement.
  - A burst that is too small (excursion, moving frames, minMs) is dropped without a failure.
  - An attempt judged incomplete waits up to 1 s for the next burst. Any other undecided attempt is dropped and
    detection re-arms. "Looks like another drill" still fails the attempt.
- **Activity gates (before acceptance):** a step attempt is ignored when its hand share is above 0.5 (a weapon movement
  or strike); a strike attempt is ignored when its hand share, after hand-trimming, is below 0.3 (footwork only).
- The old settle detection is still available (`DETECT.mode = 'settle'`).

## Idle / non-drill set
12 × 6 s segments from seen videos, outside the labelled clips (`idle_clips.txt`):
- Ukolov standing with the sword: 6 segments.
- Sword Carolina instructor talking and gesturing: 6 segments.

Each segment is replayed with all 9 drills selected; any accept is a false accept.

## Seen (30 clips; funnel = what happened on the own-drill run)
| config | own all | wrong all | own clean | wrong clean | core own all / clean | idle false accepts | funnel clean (no_start/no_decision/short/tracking/other/accepted) |
|---|---|---|---|---|---|---|---|
| P3 settle (before) | 10/30 | 6/240 | 6/17 | 4/136 | 7/22 / 4/12 | 3/108 | 2/1/2/0/6/6 |
| settle + gates | 10/30 | 4/240 | 6/17 | 2/136 | 7/22 / 4/12 | 3/108 | 2/5/0/0/4/6 |
| burst, no gates | 10/30 | 13/240 | 4/17 | 9/136 | 7/22 / 3/12 | 3/108 | 0/2/0/0/11/4 |
| burst + gates (B0 thresholds) | 10/30 | 9/240 | 4/17 | 7/136 | 7/22 / 3/12 | - | 0/6/0/0/7/4 |
| **P4 = burst offRel .15, hold 200 ms + gates** | 9/30 | 5/240 | 5/17 | 4/136 | 7/22 / 4/12 | 2/108 | 0/7/0/0/5/5 |

Also tried, without gain:
- otherFails off (re-arm instead of failing on "other"): wrong 24/240.
- onHand .6 / onFeet .4.
- holdMs 200 alone.
- offRel .2.
- mergeUnknown.

Burst detection removes "never started" (2 → 0 clean) and "stopped short", but the attempts it produces then end as
"other" or are dropped as undecided. Classification, not detection, limits the seen clips.

## Synthetic (streaming pipeline)
| config | test M/E own, wrong | beginner own, wrong | LOBO M/E own, wrong |
|---|---|---|---|
| main | 122/148, 14 | 58/76, 9 | 102/122, 13 |
| P3 settle | 126/148, 14 | 52/76, 8 | 141/171, 19 |
| settle + gates | 124/148, 21 | 52/76, 12 | 138/171, 22 |
| burst, no gates | 120/148, 17 | 46/76, 17 | 139/171, 25 |
| **P4** | 125/148, 19 | 49/76, 21 | 135/171, 23 |
P4 regresses on synthetic wrong-drill accepts: test 14 → 19 (1.2 → 1.6 %), beginner 9 → 21 (1.5 → 3.5 %). Re-arming
gives more chances per clip, and the strike gate rejects real synthetic strikes that carry a big step.

## FINAL fresh (P4, run once). Before = the phase-3 P3 run.
| | generic all | generic clean (= core clean) | personal all | personal clean |
|---|---|---|---|---|
| P3 | own 1/35, wrong 4/280 | 1/23, 3/184 | 3/92, 8/736 | 3/62, 6/496 |
| **P4** | own 3/35, wrong 1/280 | 1/23, 1/184 | 8/92, 0/736 (generic 7/92, 2/736) | 1/62, 0/496 (generic 1/62, 1/496) |

Funnel on fresh (own run; no_start / no_decision / short / tracking / other / accepted):
- All 35: P3 16/14/2/0/2/1 → P4 0/29/1/1/1/3.
- Clean 23: P3 8/10/2/0/2/1 → P4 0/20/0/1/1/1.

Per drill, P4 generic own:
- Clean: advance 1/2, passing-step-forward 0/2, zornhau 0/7, zwerchhau 0/8, schielhau 0/4.
- All clips: advance 2/4, passing-step-backward 1/2, everything else 0.

Core drills, P4 generic:
- All clips: own 2/28; wrong on core clips 1/224; wrong-into-core 1/147.
- Clean: own 1/23; wrong 1/184.

Personal clean: advance 1/2; every strike 0.

## CI (local, thresholds not relaxed)
- vitest, 3 of 62 fail:
  - `continuousMotion.test.ts` "finishes a whole trajectory without any checkpoint holds": the strike gate (hand share
    < 0.3) ignores this pattern-only strike, whose ankles move, so the attempt re-arms instead of completing. It passes
    with the gates off.
  - LOBO M/E 78.9 % < 80 %.
  - Beginner similarity: the beginner mean (71.7) must be at least 10 points below the master/experienced mean (80.7).
- check-motion-scenarios FAILS: normal 1 (0 allowed), fps10 11 (3), slow4x 19 (4), truncated 20 (19). fast now passes.
  The remaining failures are mostly strike-vs-strike "looks like X" decisions on time-distorted clips. Slow ×4 clips
  also split into several bursts ("Готов").
- check-vom-tag-clips, build-motion-patterns --check and the static build pass.

## Verdict
The bar (core, fresh clean own >= 60 %, wrong <= 5 %) is NOT met: 1/23 generic, 1/62 personal.

Burst detection did its narrow job:
- Fresh "never started" fell from 8 to 0 of the 23 clean clips.
- Wrong accepts stay low: fresh 1/184, idle 2/108.

But the attempts it now forms are not recognised (20 of the 23 clean clips end undecided). The recognizer cannot match
real strikes, and that remains the wall, as in phase 3.
