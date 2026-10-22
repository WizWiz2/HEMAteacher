# Real-world recognition experiments (Oct 2026): index and results

The shipped recognizer was tested against public real-person videos. Every experiment below missed the bar, so none was
merged. The bar is: on held-out real people, core drills (zornhau, zwerchhau, schielhau, passing-step-forward) are
recognised at least 60 % of the time, and wrong-drill accepts stay at or below 5 %.
The PRs are closed, but their branches are **kept** with all scripts, notes and raw results. This page records what
each one tried and where to find it.

Sets used: *seen* = 30 public clips (17 clean); *fresh* = locked 35-clip held-out set (23 clean, 9 people). Fresh was
re-run in phases 2–5, so it is now contaminated. *own* = the clip's own drill accepted; *wrong* = another drill accepted.

| branch (PR) | what it tried | key result | why not merged |
|---|---|---|---|
| `eval/public-real-videos` (#21) | 30 real clips replayed through main; distance/tempo diagnosis (`eval/real-videos/`) | main: own 3/30 (strikes 1/16), wrong 4/270. Real distances median 3.8 vs accept 2.74 (synthetic 0.7); real reps 3–4× slower | evaluation data only |
| `fix/real-world-gap` (#22) | phase 2: gen2 renders, `hand_share`, styleGroups, HAND_TRIM (F3) | fresh clean own 2/23, wrong 4/184 (main 0/23) | bar missed; CI red (LOBO 78.4 % < 80 %, beginner similarity, scenarios) |
| `fix/real-strikes` (#23, stacked on #22) | phase 3: arm features relative to attempt start (P3), real-rep templates (LOPO) | fresh clean own 1/23, wrong 3/184 | bar missed; CI red |
| `fix/attempt-detection` (#24) | phase 4: burst attempt detection (P4), idle set (12 segments / 108 checks) | fresh no_start 8→0 of 23, but 20/23 undecided; clean own 1/23, wrong 1/184; idle FA 2/108 | bar missed; CI red (3 vitest, scenarios) |
| `feat/real-shape-strikes` (#25) | phase 5: Blender strikes re-shaped to measured real shapes (`real_v3`/`real_v4`), sword-through-body fix | fresh clean own 1/23 (4 %), wrong 3/184; synthetic beginner 48/76 vs 51/76 | bar missed; CI red (beginner similarity, scenarios) |
| `feat/real-harvest-templates` (#26) | 71 harvested real reps (33 clips, 16 people) as extra templates | harvest LOPO own 6/15 (main 3/15); seen 2/22; frontal held-out 0/2; fresh 0/35 | bar missed; scenarios red (beginner krumphau → zwerchhau) |
| `data/real-harvest` (no PR) | harvest tooling: search/peek/cut, `tools/build_real_fixture.py`, `h_lopo.mjs`, frontal job generator; `eval/real-harvest/PROGRESS.md` | source of the reps used in #26 and #27 | tooling/data; scripts expect box paths |
| `feat/blade-tracking-prototype` (#20, open draft) | blade tracking (hybrid tracker + tiny net), flag off | synthetic test 77/84; net fails on real video | prototype, kept open |

What did land: front camera view (#27, `eval/front-view/RESULTS.md`). It reaches 75 % / 67 % on synthetic frontal
LOBO/test. Real frontal own is 2/6 with 8 % wrong, and held-out real frontal is 0/3.

Common conclusion: real people start from lower guards, cut more horizontally and move 3–4× slower than the renders.
Public videos give only 1–5 clean people per drill. The next useful input is real recordings of the target user,
filmed from the front.

## Blade tracking (closed, Oct 2026)

What was tried:
- Synthetic upper bound: feeding the true blade direction from renders raised strike accuracy from 65 to 82 of 84.
- Classical in-browser detector: a line scan from the hands plus temporal tracking, about 2 ms per frame.
- A tiny CNN trained on renders only, then fine-tuned on real pseudo-labels. The labels came from OWLv2 and SAM
  on frames of 107 public videos, about 80 % correct by eye; the main error is swapping tip and pommel.
- A rule that picks the tip from the forearm direction. Rejected by eye: with a two-handed grip the forearms
  cross the hilt, so the rule made most of its flips wrong.

Held-out real frames (359 frames, 9 channels never used in training):
- Classical detector: 71 % of frames within 15°, median error 4°, 93 % coverage.
- Nets: 22–25 % within 15°. The net trained on renders only: 13 %.

End-to-end on 30 real clips (own drill recognised / wrong accepts of 240):

| Blade input | Own | Wrong |
|---|---|---|
| Off | 3/30 | 3 |
| Classical | 2/30 | 3–4 |

With every blade input tried, 0 of 16 strikes were recognised.

Conclusion: the strike classifier was trained on blade features from renders and does not transfer to real
people, even when the blade itself is found well. Making blade input useful needs real labelled strikes.

The code is kept on the branch `feat/blade-tracking-prototype` (PR #20, closed; https://github.com/WizWiz2/HEMAteacher/pull/20),
in `eval/real-blade/`, last commit 7f8f07e.
