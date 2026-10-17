# Front camera view — evaluation (2026-10-17)

Front model = 44 frontal TRAIN renders (azimuth 60–90°, 5 bodies, 9 drills) + 12 real frontal reps
(TVG Steele steps, Golden Falcon zwerchhau, Aaron Harmon krumphau). Side model unchanged.

## Synthetic (evaluate-motion-recognition, M/E)
| protocol | own | wrong drill |
|---|---|---|
| front-lobo, frontal renders | 33/44 (75%) | 2/352 (0.6%) |
| front-lobo, real frontal people | 1/12 | 6/96 (6.3%) |
| front-test (reserved bodies) | 12/18 (67%) | 0/144 |
| side lobo (= main) | 102/122 | 13/976 |
| side test (= main) | 122/148 | 14/1184 |

## Real frontal clips (h_lopo, front view, evaluated person's templates removed)
| set | own (core) | wrong drill |
|---|---|---|
| harvest frontal LOPO | 2/6 (1/3) | 4/48 (8.3%) |
| seen frontal | 0/1 | 1/8 |
| frontal held-out people | 0/3 (0/2) | 1/24 |

Before this change the front view never started (engine asked to turn sideways); with side templates only:
harvest frontal 1/6 w2/48, held-out 0/3 w0/24.

Main failure: in front view steps are confused (passing step -> advance/retreat, advance -> retreat),
real schielhau read as zornhau. Bar (own >= 60%, wrong <= 5% on held-out real people) NOT met.

Side regression: none (synthetic lobo/test identical to main; real side sets vside 4/20, 3/30, 0/3 = main).
Local CI: vitest 70/70, vom-tag ok, patterns --check ok, motion scenarios ok, static build ok, export --check ok
(backend pytest not run locally; backend untouched).
