# Zornhau mock calibration clips

Synthetic side-camera clips (~6 s, 180 frames, 30 fps, 1280x720) of Zornhau from Vom Tag, rendered in Blender with MakeHuman/MPFB bodies and a webcam-style post-process (noise, compression, mild blur/exposure variance).

Each `<body>_<level>.mp4` has a `<body>_<level>.json` sidecar with per-frame ground-truth landmarks (MediaPipe 33-point layout), checkpoint timeline, injected level deviations, per-frame sword/body clearance distances and a face-visibility check.

| Clip | Body | Level |
|---|---|---|
| tall_slim_male_beginner | tall, slim, long-limbed male | beginner |
| tall_slim_male_experienced | tall, slim, long-limbed male | experienced |
| tall_slim_male_master | tall, slim, long-limbed male | master |
| short_broad_female_beginner | short, heavier, broad female | beginner |
| short_broad_female_experienced | short, heavier, broad female | experienced |
| short_broad_female_master | short, heavier, broad female | master |

Vom Tag is held at the right shoulder. Level faults (stance width, bent elbows, lean, legs, rotation, timing, blade angle in the cut) are capped so that the hands, grip, crossguard and blade never cover the face in the guard, the return or the cut.

All clips pass an automated clearance check (no blade/guard/grip intersecting head or body, both hands on the hilt) and a face-visibility check (0 frames with more than 2% of the face covered). MediaPipe heavy detects the pose on 100% of frames with 0% left/right swaps.

The committed mp4s are re-encoded to webcam-like size (H.264 High, CRF 25, yuv420p, faststart, no audio; ~2.3-2.5 MB each instead of ~15.6 MB). Compared with the full-size renders, MediaPipe heavy still detects the pose on 100% of frames with no new left/right swaps; the median landmark shift is ~0.005 torso lengths.

Known limitations:
- From a pure side view MediaPipe's depth estimate spreads the wrists far apart, so `hand_distance` and elbow angles computed with z are unreliable.
- With the current drill settings the Vom Tag pose already scores high enough to pass zorn-init and zorn-extend, so those checkpoints pass while the fighter is still in the guard, even on the ground truth. This is a drill-setting effect, not a clip defect.
- The rear crossguard tip passes within a few pixels of the nose on the male experienced and master clips, and the pommel passes at the chin for 2 frames of the female beginner cut (touching, not covering).
