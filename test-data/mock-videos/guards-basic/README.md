# Guards basic (Vom Tag -> Ochs -> Pflug -> Alber) mock calibration clips

Synthetic side-camera clips (~6 s, 180 frames, 30 fps, 1280x720) of the `guards-basic` drill, rendered in Blender with MakeHuman/MPFB bodies (Cycles 3 spp) and a webcam-style post-process (noise, mild blur/exposure variance), re-encoded to webcam size (H.264 high, CRF 25, yuv420p, faststart).

Each `<body>_<level>.mp4` has a `<body>_<level>.json` sidecar with per-frame ground-truth landmarks (MediaPipe 33-point layout), sword crossguard/tip pixels, checkpoint timeline and design frames, injected level deviations, per-frame sword/body clearance distances and a face-visibility check.

## Motion

Stationary left-foot-forward stance in profile. The fighter holds Vom Tag at the right shoulder (hands in front of / outside the right shoulder, blade up, face visible), then changes guard: Ochs (hands at forehead height in front of the head, point down at the opponent's face), Pflug (hands at the right hip, point up at the face), Alber (hands low in front, point to the ground). Each guard is held ~0.5 s; master and experienced return to Vom Tag at the end. To keep the face visible the hands rise above the head with the blade up before the point drops into Ochs, and pass through a Langort-like extension on the way down to Pflug.

Right-handed fighter, left foot forward in the opening guard, camera on the fighter's right. The opening Vom Tag is the same guard as in the Zornhau set (hands at the right shoulder, blade up, face visible) and matches the 484fefd `vom-tag` preset.

| Clip | Body | Level | What the level shows | size |
|---|---|---|---|---|
| tall_slim_male_master | tall, slim, long-limbed male | master | correct: clean guard positions / cut line, fluent timing, full extension, rotation from hips and shoulders | 2.1 MB |
| tall_slim_male_experienced | tall, slim, long-limbed male | experienced | mild faults: slightly slower, arms a little bent, hands slightly off line, a few degrees of extra lean, stance a bit short, elbows a little out, blade angle off by up to ~5 deg, slight tremor, less hip/shoulder rotation | 2.2 MB |
| tall_slim_male_beginner | tall, slim, long-limbed male | beginner | typical trainee faults: slow with a pause after the wind-up, bent arms (short cut), hands off line, leans forward ~11 deg, short stiff stance, lowered Vom Tag (capped so the face stays visible), flared elbows, blade angle off by up to ~12 deg, tremor, little rotation | 2.1 MB |
| short_broad_female_master | short, heavier, broad female | master | correct: clean guard positions / cut line, fluent timing, full extension, rotation from hips and shoulders | 2.4 MB |
| short_broad_female_experienced | short, heavier, broad female | experienced | mild faults: slightly slower, arms a little bent, hands slightly off line, a few degrees of extra lean, stance a bit short, elbows a little out, blade angle off by up to ~5 deg, slight tremor, less hip/shoulder rotation | 2.3 MB |
| short_broad_female_beginner | short, heavier, broad female | beginner | typical trainee faults: slow with a pause after the wind-up, bent arms (short cut), hands off line, leans forward ~11 deg, short stiff stance, lowered Vom Tag (capped so the face stays visible), flared elbows, blade angle off by up to ~12 deg, tremor, little rotation | 2.4 MB |

## Validation

Clearance (blade/crossguard/grip vs head and torso, forearm vs forearm) and face visibility are checked on every frame: 3/6 clips have no failing frame and no face-hidden frame. MediaPipe Pose heavy detects the pose on at least 100.0% of frames of every clip (original and compressed) with at most 0.0% left/right swaps. The app's own matcher (HEMAteacher 484fefd: calibration gate + personalised side-view drill, DrillPage path) completes the drill on the ground truth of 6/6 clips and on the MediaPipe heavy output of 0/6 compressed clips (VideoRegressionPage path, no personalisation: 0/6); the VideoRegressionPage path with the app's lite model completes 0/6 (informational). Per-clip numbers, pass frames and timing flags: `out/guards-basic/final/report.md`.

## Known limitations

- `pelvis_height` never matches under torso-length normalisation (real ankles are 1.5-1.8 torso lengths below the hips), so every checkpoint is decided by the remaining features.
- Preset tolerance windows overlap: the Vom Tag pose already satisfies the following checkpoint(s) in some drills, so those pass during the guard hold (flagged as timing issues in the report; a drill-setting effect).
- From a pure side view MediaPipe's depth estimate is unreliable, so lateral blade/hand faults are only in the ground truth.
- The sword is a rigid prop driven by the two hands; finger grip changes (thumb on the flat etc.) are not modelled.

## Known issues (accepted after fixes)

- tall_slim_male_master: app matcher (live) on MediaPipe heavy (compressed) not completed
- tall_slim_male_experienced: app matcher (live) on MediaPipe heavy (compressed) not completed
- short_broad_female_master: 10 clearance failing frames (to_p1 f80-f83, to_pflug f85-f85, to_alber f111-f113, to_r1 f133-f134); 1 face-hidden frames [53]; app matcher (live) on MediaPipe heavy (compressed) not completed
- short_broad_female_experienced: 14 clearance failing frames (to_o1b f55-f55, to_p1 f86-f89, to_pflug f91-f92, to_alber f120-f123, to_r1 f144-f146); 2 face-hidden frames [55, 56]; app matcher (live) on MediaPipe heavy (compressed) not completed
- short_broad_female_beginner: 16 clearance failing frames (to_o1b f58-f58, to_p1 f99-f104, to_pflug f105-f108, to_alber f141-f145); 3 face-hidden frames [58, 59, 60]
- MediaPipe: guards-basic is an upper_body drill, so the app's framing gate needs both elbows and both wrists at visibility >= 0.42. In a pure side view the far (left) arm is hidden behind the torso and the right arm. On the female clips MediaPipe heavy keeps left_elbow below 0.42 on every frame, so the app never leaves calibration. For both bodies the left wrist drops below 0.42 through Pflug/Alber, so Pflug cannot pass on MediaPipe output. The ground truth completes on both app paths for all 6 clips. Female transition retry (Oct 1, 19:25-21:50 UTC+5): about 45 alternative routes were checked frame by frame with the same motion sampler and clearance/face checks as the renderer (slower transitions, extra waypoints, wider/higher arc over the head, hands lower/further right, blade yawed, edge roll held at 90 deg, elbows flared). None was clean in every segment: the best found still leaves 3-4 forearm-penetration frames leaving Ochs, 2 frames (grip-torso + forearm) into Alber and 1 face-hidden frame in the rise to Ochs. Only the Alber-to-Vom-Tag return became clean (blade yawed right). Because no candidate reached zero, the female clips were not re-rendered and the current clips stay staged.
