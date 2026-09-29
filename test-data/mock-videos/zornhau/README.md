# Zornhau mock calibration clips

Synthetic side-camera clips (~6 s, 180 frames, 30 fps, 1280x720) of Zornhau from Vom Tag, rendered in Blender with MakeHuman/MPFB bodies and a webcam-style post-process (noise, compression, mild blur/exposure variance).

Each `<body>_<level>.mp4` has a `<body>_<level>.json` sidecar with per-frame ground-truth landmarks (MediaPipe 33-point layout), checkpoint timeline, injected level deviations, and per-frame sword/body clearance distances.

| Clip | Body | Level |
|---|---|---|
| tall_slim_male_master | tall, slim, long-limbed male | master |
| short_broad_female_beginner | short, heavier, broad female | beginner |
| short_broad_female_experienced | short, heavier, broad female | experienced |
| short_broad_female_master | short, heavier, broad female | master |

All clips pass an automated clearance check (no blade/guard/grip intersecting head or body, both hands on the hilt). MediaPipe heavy detects the pose on 100% of frames with 0% left/right swaps.

Known limitation: from a pure side view MediaPipe's depth estimate spreads the wrists far apart, so `hand_distance` and elbow angles computed with z are unreliable.

tall_slim_male beginner/experienced are pending a re-render.
