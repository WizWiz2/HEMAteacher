# Advance (шаг вперёд) mock calibration clips

Synthetic side-camera clips (~6 s, 180 frames, 30 fps, 1280x720) of the `advance` footwork drill, rendered in Blender with MakeHuman/MPFB bodies (Cycles 3 spp) and a webcam-style post-process (noise, mild blur/exposure variance), re-encoded to webcam size (H.264 high, CRF 25, yuv420p, faststart).

Each `<body>_<level>.mp4` has a `<body>_<level>.json` sidecar with per-frame ground-truth landmarks (MediaPipe 33-point layout), checkpoint timeline and design frames, plausible pass windows, injected level deviations, body clearance checks (legs, arms, floor contact, knee direction) and a face-visibility check.

## Motion

From a left-foot-forward working stance the front (left) foot steps forward, then the rear (right) foot follows and the stance is restored (checkpoints start -> front-out -> recover). After a hold the fighter returns to the start position with a retreat (rear foot back, then front foot back) and holds the stance to the end of the clip.

No sword is held: the app asks users to film footwork without a weapon (`data/movements/*.yaml`, drill `weaponTracking: none`) and no checkpoint uses hand or blade features, so the arms hang relaxed beside the body.

| Clip | Body | Level | What the level shows | size |
|---|---|---|---|---|
| tall_slim_male_beginner | tall, slim, long-limbed male | beginner | typical trainee faults: narrow stiff-legged stance, bounces up on every step, leans into the step and watches the feet, weight on the front leg, front toe turned out, slow with a pause mid-drill, over-steps (step too long for the stance) and the stance ends short | 2.4 MB |
| tall_slim_male_experienced | tall, slim, long-limbed male | experienced | mild faults: slightly short/high stance, hips bob a little, a few degrees of extra lean, looks slightly down, feet a bit turned out, rushes the footwork, rear foot recovers slightly short | 2.3 MB |
| tall_slim_male_master | tall, slim, long-limbed male | master | correct: working stance with flexed knees, level hips, upright torso, eyes forward, fluent timing | 2.5 MB |
| short_broad_female_beginner | short, heavier, broad female | beginner | typical trainee faults: narrow stiff-legged stance, bounces up on every step, leans into the step and watches the feet, weight on the front leg, front toe turned out, slow with a pause mid-drill, over-steps (step too long for the stance) and the stance ends short | 2.3 MB |
| short_broad_female_experienced | short, heavier, broad female | experienced | mild faults: slightly short/high stance, hips bob a little, a few degrees of extra lean, looks slightly down, feet a bit turned out, rushes the footwork, rear foot recovers slightly short | 2.6 MB |
| short_broad_female_master | short, heavier, broad female | master | correct: working stance with flexed knees, level hips, upright torso, eyes forward, fluent timing | 2.5 MB |

## Validation

All clips pass the automated body checks (no leg-through-leg, no hand/forearm inside torso or thighs, no foot below the floor, no backwards knee, planted feet do not slide, whole body in frame) and the face is never covered. MediaPipe Pose heavy detects the pose on 100% of frames of every clip (original and compressed) with at most 0.6% left/right swaps. The drill matcher (Python port) completes the drill on the ground truth of all clips and on the MediaPipe output of 6/6 compressed clips; per-clip pass frames and timing flags are in the report.

## Known limitations

- `pelvis_height` never matches: with torso-length normalisation a real body's ankles are 1.5-1.8 torso lengths below the hips (preset: 1.0), so every checkpoint is decided by the other four features (passScore 0.8 at best).
- Tolerance windows of consecutive checkpoints overlap (e.g. a normal stance also satisfies `stance-compact-left`; a split stance can satisfy `stance-left`), so some checkpoints pass earlier than the movement they describe; this is a drill-setting effect and is flagged as informational in the report.
- The swing foot stays flat (no heel-toe roll) and the arms do not swing; planted feet pivot on the ball of the foot.
- From a pure side view MediaPipe's depth estimate is unreliable, so lateral faults (e.g. the beginner landing almost on one line) are only in the ground truth, not visible in 2D.
- MediaPipe's hip landmarks sit lower than the skeleton hip joints, so its torso length is ~20% longer and all normalised distances (ankle x, foot distance) come out ~15-20% smaller than in the ground truth; stances near the lower edge of a tolerance window (the beginners' narrow stance) can therefore fail on MediaPipe while passing on the ground truth.
- Matcher simulation uses the per-frame torso scale and nose-based facing of the Python port; the app's normalize.ts uses a 30-frame median torso scale and an explicit facing.
- MediaPipe drill simulation completes on all 6 compressed clips; for both beginners the recover checkpoint passes during the pause with the feet split (the long split stance also fits stance-left's window in MediaPipe space) - a drill-setting/tolerance effect. tall_slim_male_master compressed: 1 frame (0.6%) with a left/right swap.
