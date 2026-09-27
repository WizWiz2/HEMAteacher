# CR-002 — Field-test usability redesign

Status: Implemented in feature branch

## Trigger

First hands-on test exposed five problems:

1. the UI did not use the visual language of historical German fencing manuscripts;
2. laptop webcams are landscape and forced the user too far away;
3. the beginner matcher was too strict, especially for Vom Tag;
4. body pose estimation does not see a staff or longsword blade;
5. feedback text below the camera is unreadable when the user stands several metres away.

## Product changes

### Camera-first drill screen

The training screen has no persistent exercise sidebar.

Navigation lives in a compact top menu. The camera takes the majority of horizontal space on desktop/laptop. The target manuscript plate occupies the smaller side column.

### Tracking modes

Drills now declare:

- `full_body` — footwork and cuts where the feet matter;
- `upper_body` — guards where the user may stand much closer to a laptop webcam.

Framing guidance explicitly tells the user when body parts are missing from frame.

### Forgiving beginner matcher

A checkpoint now has:

- `passThreshold` — weighted fraction of conditions that must pass;
- `requiredFeatures` — important features that can never be ignored;
- weights and tolerances.

This replaces the previous all-or-nothing requirement that every configured feature pass simultaneously.

### Distant feedback

The current correction is rendered as one large high-contrast overlay on the camera image.

Optional Russian speech synthesis reads changing corrections aloud.

Secondary details remain visible but no longer compete with the primary cue.

### Manuscript target renderer

Target poses are rendered as parchment/ink engraving-style figures.

The same machine-readable target pose drives:
- the engraved body figure;
- the red skeleton overlay;
- key joint points;
- checkpoint feature targets.

Visual instruction and machine expectation therefore remain coupled.

### Weapon prototype

MediaPipe Pose Landmarker still does not identify a blade.

CR-002 adds an explicit optional marker mode:
- cyan marker near the guard/grip;
- magenta marker near the tip.

The browser detects both markers from the camera and reconstructs a rough blade line. The live overlay shows the detected line and compares its angle with the checkpoint sword guide.

Without both markers the application does **not** claim to measure the sword.

This mode is intentionally a prototype and is not yet used as a hard checkpoint gate.

## Acceptance criteria

- laptop landscape video is no longer forced into portrait;
- guard drills calibrate without visible feet;
- footwork still requires feet;
- Vom Tag uses a forgiving threshold and only key features are mandatory;
- one prominent correction is readable from a distance;
- speech feedback can be toggled;
- target appears as an engraving with visible skeleton/key points;
- no permanent exercise sidebar exists on the drill screen;
- marker mode can detect two colored markers and draw a blade line;
- no weapon claim is made when markers are missing;
- all existing frontend/backend tests and production build pass.
