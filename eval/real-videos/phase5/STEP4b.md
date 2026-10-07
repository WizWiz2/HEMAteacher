# Phase 5b: sword-through-body fix, re-render of the 21 dropped clips, re-evaluation (2026-10-07, UTC+5)

## Clearance fix and recovery
- **Cause and fix:** see `CLEARANCE.md`. Every failure happened at the end of the cut:
  - zwerchhau: the pommel swept through the head at cross/finish/recover. The forearms also penetrated at recover.
  - schielhau short_slim_male: the pommel rose into the chin.
  - Fix: final preset `gen/real_v4.json`:
    - zwerchhau keeps the v3 global keys.
    - Per-body hand/elbow/recover keys and blade pitch for the 6 failing bodies.
    - schielhau: blade pitch for short_slim_male.
  - The collision gate is unchanged.
- **Shape match:**
  - tall_slim_male zwerchhau 7/7: keyframes identical to v3.
  - tall_slim_male schielhau 8/8: global part unchanged.
  - short_slim_male zwerchhau experienced pilot: 7/7, against 2/7 under v3.
  - short_slim_male schielhau: 5/8, the same as v3.
- **Recovered: 21/21 re-rendered** with the same seeds and params. Rendered clearance: 0 failing frames on every clip.
  - Fixture MIX-b = phase-4 base 462 + 96 `_rs` = **558 clips** (it was 537 with 21 dropped).
  - zwerchhau real-shape train: 8 → 20; test: 7 → 12.
- **Caveat:** the 3 kept short_broad_female zwerchhau clips (M/E/slow) predate the fix. They were rendered with the old
  low-finish override, so they are not the real shape.

## Synthetic (streaming; old = phase-4 clips, directly comparable). Values are own, wrong.
| config | test old M/E | test old beg | LOBO old M/E | LOBO old beg | test old core M/E | test `_rs` M/E | test `_rs` beg |
|---|---|---|---|---|---|---|---|
| mixP3 (committed) | 126/148, 14 | **51/76, 10** | **142/171, 14** | 47/61, 8 | 44/50, 4 | 21/21, 1 | 9/10, 1 |
| mixP3b (settle) | 126/148, 14 | 48/76, 9 | 141/171, 14 | 46/61, 8 | 44/50, 4 | 24/24, 1 | 11/12, 1 |
| mixP4b (burst + gates) | 126/148, **21** | 47/76, **19** | 136/171, 20 | 42/61, 8 | 40/50, 8 | 23/24, 1 | 9/12, 0 |

## Seen real (30 / 17 clean, generic) and idle
| config | own all | wrong all | own clean | wrong clean | core own all / clean | LOPO clean own | idle FA | funnel clean (no_start/no_dec/short/track/other/acc) |
|---|---|---|---|---|---|---|---|---|
| mixP3 | 12/30 | 6/240 | 7/17 | 4/136 | 9/22 / 5/12 | 7/17 | 3/108 | 2/1/1/0/6/7 |
| mixP3b | 12/30 | 8/240 | 7/17 | 6/136 | 9/22 / 5/12 | 6/17 | 3/108 | 2/1/1/0/6/7 |
| mixP4b | 12/30 | 6/240 | 6/17 | 5/136 | 10/22 / 5/12 | 5/17 | 2/108 | 0/6/0/0/5/6 |

## Choice: mixP3b for the single fresh run
It was the better of the two on synthetic: lower wrong rates than mixP4b everywhere and a higher beginner own count.
It is still not a clean improvement over mixP3:
- Beginner own is 48/76, against 51/76.
- Seen wrong is 8/240, against 6/240.

## FINAL fresh (tag P5b, run once). **Contaminated:** fresh was already used in phases 2–5.
| | generic all | generic clean (= core clean) | personal all | personal clean |
|---|---|---|---|---|
| P5 = mixP3 | 1/35, wrong 4/280 | 1/23, 3/184 | 3/92, 8/736 | 3/62, 6/496 |
| **P5b = mixP3b** | 1/35, 4/280 | 1/23, 3/184 | 2/92, 8/736 | 2/62, 6/496 |

- Funnel, own runs:
  - All 35: 16/14/2/0/2/1.
  - Clean 23: 8/10/2/0/2/1. This is identical to P5.
- Per drill, clean: advance 0/2, passing-step-forward 0/2, schielhau 0/4, zornhau 1/7, zwerchhau 0/8.
- Core clean own: 1/23 = 4 %. Wrong-on-core-clips: 3/184 = 1.6 %.

## Local CI (thresholds NOT relaxed; `results/local_ci_P5b.log`)
- vitest: 1 of 62 fails. Beginner similarity 75.3 must be < 71.2, the same test as mixP3.
- check-motion-scenarios FAILS: normal 2 (0 allowed), fast 5 (2), fps10 15 (3), slow4x 14 (4), truncated 20 (19).
- build-motion-patterns --check, check-vom-tag-clips and the static build pass.

## Verdict: not merged; the branch keeps the mixP3 model
- CI is red.
- There is a synthetic beginner regression: 48 vs 51.
- The fresh core clean bar is far from met: 4 % against ≥ 60 %.
- The recovered zwerchhau templates (8 → 20 train) did not change any fresh zwerchhau outcome (0/8). The fresh
  blocker is detection and the templates: no_start 8 and no_decision 10 of 23. Coverage was not the issue.
- The mixP3b model is archived in `results/p5_models_mixP3b/` and is not committed as the app model.
