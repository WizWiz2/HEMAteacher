# Passing step backward (проходной шаг назад) mock calibration clips

Synthetic side-camera clips (~6 s, 180 frames, 30 fps, 1280x720) of the `passing-step-backward` footwork drill, rendered in Blender with MakeHuman/MPFB bodies (Cycles 3 spp) and a webcam-style post-process (noise, mild blur/exposure variance), re-encoded to webcam size (H.264 high, CRF 25, yuv420p, faststart).

Each `<body>_<level>.mp4` has a `<body>_<level>.json` sidecar with per-frame ground-truth landmarks (MediaPipe 33-point layout), checkpoint timeline and design frames, plausible pass windows, injected level deviations, body clearance checks (legs, arms, floor contact, knee direction) and a face-visibility check.

## Motion

From a right-foot-forward stance the front (right) foot passes back beside the standing foot, lands behind and the new front foot adjusts the stance length; the standing foot pivots on the ball as the hips turn (checkpoints start -> cross -> reach -> settle). After a hold the fighter returns with a passing step forward into the right-foot-forward stance.

No sword is held: the app asks users to film footwork without a weapon (`data/movements/*.yaml`, drill `weaponTracking: none`) and no checkpoint uses hand or blade features, so the arms hang relaxed beside the body.

| Clip | Body | Level | What the level shows | size |
|---|---|---|---|---|
| tall_slim_male_beginner | tall, slim, long-limbed male | beginner | typical trainee faults: narrow stiff-legged stance, bounces up on every step, leans into the step and watches the feet, weight on the front leg, front toe turned out, slow with a pause mid-drill, slightly short passing step landing almost on one line, stops with the feet together and pauses on landing, the stance ends short | 2.3 MB |
| tall_slim_male_experienced | tall, slim, long-limbed male | experienced | mild faults: slightly short/high stance, hips bob a little, a few degrees of extra lean, looks slightly down, feet a bit turned out, rushes the footwork, rear foot recovers slightly short | 2.4 MB |
| tall_slim_male_master | tall, slim, long-limbed male | master | correct: working stance with flexed knees, level hips, upright torso, eyes forward, fluent timing | 2.4 MB |
| short_broad_female_beginner | short, heavier, broad female | beginner | typical trainee faults: narrow stiff-legged stance, bounces up on every step, leans into the step and watches the feet, weight on the front leg, front toe turned out, slow with a pause mid-drill, slightly short passing step landing almost on one line, stops with the feet together and pauses on landing, the stance ends short | 2.5 MB |
| short_broad_female_experienced | short, heavier, broad female | experienced | mild faults: slightly short/high stance, hips bob a little, a few degrees of extra lean, looks slightly down, feet a bit turned out, rushes the footwork, rear foot recovers slightly short | 2.5 MB |
| short_broad_female_master | short, heavier, broad female | master | correct: working stance with flexed knees, level hips, upright torso, eyes forward, fluent timing | 2.5 MB |

## Validation

All clips pass the automated body checks (no leg-through-leg, no hand/forearm inside torso or thighs, no foot below the floor, no backwards knee, planted feet do not slide, whole body in frame) and the face is never covered. MediaPipe Pose heavy detects the pose on 100% of frames of every clip (original and compressed) with at most 0.0% left/right swaps. The drill matcher (Python port) completes the drill on the ground truth of all clips and on the MediaPipe output of 6/6 compressed clips; per-clip pass frames and timing flags are in the report.

## Known limitations

- `pelvis_height` never matches: with torso-length normalisation a real body's ankles are 1.5-1.8 torso lengths below the hips (preset: 1.0), so every checkpoint is decided by the other four features (passScore 0.8 at best).
- Tolerance windows of consecutive checkpoints overlap (e.g. a normal stance also satisfies `stance-compact-left`; a split stance can satisfy `stance-left`), so some checkpoints pass earlier than the movement they describe; this is a drill-setting effect and is flagged as informational in the report.
- The swing foot stays flat (no heel-toe roll) and the arms do not swing; planted feet pivot on the ball of the foot.
- From a pure side view MediaPipe's depth estimate is unreliable, so lateral faults (e.g. the beginner landing almost on one line) are only in the ground truth, not visible in 2D.
- MediaPipe's hip landmarks sit lower than the skeleton hip joints, so its torso length is ~20% longer and all normalised distances (ankle x, foot distance) come out ~15-20% smaller than in the ground truth; stances near the lower edge of a tolerance window (the beginners' narrow stance) can therefore fail on MediaPipe while passing on the ground truth.
- Matcher simulation uses the per-frame torso scale and nose-based facing of the Python port; the app's normalize.ts uses a 30-frame median torso scale and an explicit facing.
- The landing of the passing step (checkpoint reach, preset stance-wide-left) is only held for 2-5 frames before the front foot adjusts, so the step length is keyed at the preset for the master (1.25 torso lengths ankle to ankle) and only slightly shorter for experienced (1.20) and beginner (1.16); with a clearly short step MediaPipe's smaller normalised foot distance falls below the tolerance window (seen on passing-step-forward). The beginner holds the new stance 0.7 s (others 0.85-1.1 s) so the slow return pass fits into 6 s.
