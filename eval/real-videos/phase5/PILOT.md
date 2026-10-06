# Phase 5 — pilot verification (render → browser MediaPipe → measure vs real targets)

Pilot renders: tall_slim_male (train body), az 10°, standard webcam degradation, 240 frames; extracted with the in-app
browser MediaPipe path (`ba_extract.mjs`), measured with `measure.mjs` (RAWSYN mode; same rep definition as the real
reps). "!" = outside the tolerance band of `real_shape_targets.json`. Quality gates: clearance failing frames (fixture
excludes > 9) and face-occlusion frames (facecheck, > 2 % of the face covered) logged per render.

| pilot | preset | zornhau | zwerchhau | schielhau |
|---|---|---|---|---|
| old synthetic (median base M/E) | – | 3/8 (dx .41, dy −.30, dir −34°, dur 434) | 4/7 (end over-head −.21, end y 1.11, forearm 37°) | 2/8 (start y 1.17, dy −.22, dir −33°) |
| 1 | real_v1, guard y .95 | 7/8 (dy −.25!) | 6/7 (dy +.25!: rise to the chamber inside the burst) | 2/8 (guard→chamber drop merged into the burst) |
| 2 | real_v2, guard y .88 x .82 | **8/8** (start y 1.04, end x .93 y .95, dx .59, dy −.09, dir −8°, dur 900) | 6/7 (end y 1.35, over-head +.11, dx .78, dy −.19; forearm 50°! vs 80±30) | 6/8 (start y .83, dy +.21, dir +16°; end x .99! vs 1.18±.15, start over-shoulder −.15! (band ≤ −.16)) |
| 3 | real_v3 (zwerch elbows forward, slower cut; schiel lower chamber, more lean, slower) | = v2 | see below | see below |

Gates in pilots: clearance failing frames 0 in every pilot render. Face-occlusion frames: the lowered Vom Tag covers part of
the face at near-side views (guard hold covered 49 % at guard y .95 → 8 % at y .88/x .82 for az 10); strike phases 0
hidden frames at az 10. At az 38 (short_broad_female schielhau, v2) the guard/chamber cover most of the face — the same
camera-dependent pattern as the old renders (old zwerchhau/schielhau face-hidden frames 0–168 per clip). The gate code
is unchanged (non-master levels shrink deviations on hidden/colliding frames; fixture drops > 9 clearance failures).
