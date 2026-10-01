# Whole-movement attempt loop

The five exercises with committed mock clips now default to `Движение целиком`:
Zornhau, advance, retreat, passing step forward and backward. `Разбор поз` keeps
checkpoint holds available for studying positions. The gallery remains independent
of attempt progress. Unsupported exercises keep their existing pose loop.

In movement mode the side-view recognizer arms on a stable starting position,
detects departure, observes ordered portions of a trajectory, and evaluates the
whole attempt at its endpoint. A missed intermediate frame is interpolated between
adjacent observations; the user never needs to hold intermediate poses. Failed
attempts end with a reason and a retry button. Long attempts, sudden jumps and loss
of tracking are rejected. Pose correction prompts and intermediate chimes are
suppressed during movement. The detector uses current usable features, bypassing
the old three-frames-in-100-ms smoothing gate. Front-view movement is explicitly
blocked; switch to side view or position study.

Patterns are generated from the two **master** Blender labels per exercise. The
experienced and beginner labels are held out of pattern generation. XY wrist/foot
features avoid unreliable side-view MediaPipe depth. Two body templates accommodate
the supplied builds; this is not proof of arbitrary anthropometric invariance.
Time-resampling and constrained DTW compare path order without demanding exactly
the reference timing. Similarity is a trajectory comparison, not a skill grade or
an evaluation of the weapon, edge alignment, targeting or tactical correctness.

## Reproduce

From repository root after installing frontend dependencies:

```sh
node frontend/scripts/build-motion-patterns.mjs --check
node frontend/scripts/check-continuous-motion.mjs --write
npm --prefix frontend test
```

The generated patterns and JSON results are committed; CI checks freshness and
replays the same public drill engine used by the UI. `--write` updates the report.
The baseline column uses explicit position-study mode of the same engine.

## Evidence and limits

30 clips cover five exercises, two bodies and three labelled levels. Fresh visual
inspection used decoded video keyframes. The automated benchmark replays the JSON
**ground truth**, with known coordinates even for occluded joints. It does not run
MediaPipe on MP4s, nor prove browser camera/calibration/quality behavior. Next gate:
replay actual MediaPipe outputs from these MP4s, then independent real recordings.
Browser UI verification was not available in this execution environment.

24/30 normal, 24/30 at 10 fps, 24/30 at 1.67x speed: all 20 master/experienced
variants pass, plus four beginner passing steps. Six beginner attempts are rejected
by start/trajectory/timing gates; the recorded rejection is not asserted to match
injected faults or coaching judgement. All 150 generated negative cases are rejected:
frozen, 12x slower, reversed, truncated and tracking lost during a detected attempt.

Master templates and all levels still come from one synthetic generator. The
negative cases are transformations of that same corpus, not independent evidence
of generalization. Remaining four master strikes do not yet have committed clips.
Do not interpret these results as production accuracy or complete technique validation.
