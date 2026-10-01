# Zwerchhau (horizontal cut, hilt high) mock calibration clips

Synthetic side-camera clips (~6 s, 180 frames, 30 fps, 1280x720) of the `zwerchhau` drill, rendered in Blender with MakeHuman/MPFB bodies (Cycles 3 spp) and a webcam-style post-process (noise, mild blur/exposure variance), re-encoded to webcam size (H.264 high, CRF 25, yuv420p, faststart).

Each `<body>_<level>.mp4` has a `<body>_<level>.json` sidecar with per-frame ground-truth landmarks (MediaPipe 33-point layout), sword crossguard/tip pixels, checkpoint timeline and design frames, injected level deviations, per-frame sword/body clearance distances and a face-visibility check.

## Motion

From Vom Tag the hilt rises above head height on the right and the blade swings back horizontally behind the right shoulder; with a passing step the hilt stays high in front of the forehead while the blade sweeps horizontally forward from the right; the cut ends with the arms extended at head height, blade horizontal. After a hold the fighter returns into Vom Tag.

Right-handed fighter, left foot forward in the opening guard, camera on the fighter's right. The opening Vom Tag is the same guard as in the Zornhau set (hands at the right shoulder, blade up, face visible) and matches the 484fefd `vom-tag` preset.

| Clip | Body | Level | What the level shows | size |
|---|---|---|---|---|
| tall_slim_male_master | tall, slim, long-limbed male | master | correct: clean guard positions / cut line, fluent timing, full extension, rotation from hips and shoulders | 2.2 MB |
| tall_slim_male_experienced | tall, slim, long-limbed male | experienced | mild faults: slightly slower, arms a little bent, hands slightly off line, a few degrees of extra lean, stance a bit short, elbows a little out, blade angle off by up to ~5 deg, slight tremor, less hip/shoulder rotation | 2.3 MB |
| tall_slim_male_beginner | tall, slim, long-limbed male | beginner | typical trainee faults: slow with a pause after the wind-up, bent arms (short cut), hands off line, leans forward ~11 deg, short stiff stance, lowered Vom Tag (capped so the face stays visible), flared elbows, blade angle off by up to ~12 deg, tremor, little rotation | 2.2 MB |
| short_broad_female_master | short, heavier, broad female | master | correct: clean guard positions / cut line, fluent timing, full extension, rotation from hips and shoulders | 2.4 MB |
| short_broad_female_experienced | short, heavier, broad female | experienced | mild faults: slightly slower, arms a little bent, hands slightly off line, a few degrees of extra lean, stance a bit short, elbows a little out, blade angle off by up to ~5 deg, slight tremor, less hip/shoulder rotation | 2.5 MB |
| short_broad_female_beginner | short, heavier, broad female | beginner | typical trainee faults: slow with a pause after the wind-up, bent arms (short cut), hands off line, leans forward ~11 deg, short stiff stance, lowered Vom Tag (capped so the face stays visible), flared elbows, blade angle off by up to ~12 deg, tremor, little rotation | 2.4 MB |

## Validation

Clearance (blade/crossguard/grip vs head and torso, forearm vs forearm) and face visibility are checked on every frame: 6/6 clips have no failing frame and no face-hidden frame. MediaPipe Pose heavy detects the pose on at least 100.0% of frames of every clip (original and compressed) with at most 0.0% left/right swaps. The app's own matcher (HEMAteacher 484fefd: calibration gate + personalised side-view drill, DrillPage path) completes the drill on the ground truth of 6/6 clips and on the MediaPipe heavy output of 0/6 compressed clips (VideoRegressionPage path, no personalisation: 4/6); the VideoRegressionPage path with the app's lite model completes 6/6 (informational). Per-clip numbers, pass frames and timing flags: `out/zwerchhau/final/report.md`.

## Known limitations

- `pelvis_height` never matches under torso-length normalisation (real ankles are 1.5-1.8 torso lengths below the hips), so every checkpoint is decided by the remaining features.
- Preset tolerance windows overlap: the Vom Tag pose already satisfies the following checkpoint(s) in some drills, so those pass during the guard hold (flagged as timing issues in the report; a drill-setting effect).
- From a pure side view MediaPipe's depth estimate is unreliable, so lateral blade/hand faults are only in the ground truth.
- The sword is a rigid prop driven by the two hands; finger grip changes (thumb on the flat etc.) are not modelled.

## Known issues (accepted after fixes)

- tall_slim_male_master: app matcher (live) on MediaPipe heavy (compressed) not completed
- tall_slim_male_experienced: app matcher (live) on MediaPipe heavy (compressed) not completed
- short_broad_female_master: app matcher (live) on MediaPipe heavy (compressed) not completed
- short_broad_female_experienced: app matcher (live) on MediaPipe heavy (compressed) not completed
- MediaPipe, DrillPage (live) path: the app personalises the drill from a body profile calibrated on the first ~0.6 s. On MediaPipe side-view landmarks that profile is distorted (e.g. shoulderWidth 2.3 vs 0.94 torso lengths on the ground truth; MediaPipe's depth for the far shoulder). This moves the guard hand_center_x target to about 1.1, against a measured 0.47, so the live path never passes the guard. The clips are the same ones that complete on the ground truth. This is an app-side finding: personalizeDrill trusts MediaPipe z in side view. The VideoRegressionPage path (no personalisation) completes on MediaPipe heavy, raw and compressed; see report.md. Short-arm body tweak: for short_broad_female the cross/finish hilt is 5 cm lower (hand_y 1.20/1.15) and the cross 0.06 further right, so the hilt clears the forehead (grip-head was 3.3 cm in the first draft).
