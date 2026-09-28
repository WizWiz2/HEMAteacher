# CR-005 — Drill UX, camera views and coherent target figure

Status: Implemented

## Trigger

Hands-on testing exposed six issues:

1. after the final checkpoint the correction banner could remain visually red/ambiguous;
2. camera orientation could feel mirrored depending on the selected physical camera/browser;
3. the training camera could not be expanded to a distraction-free full-screen view;
4. the manuscript target figure looked assembled from disconnected raster body parts;
5. the target art mixed visual cues that read as front/profile inconsistently;
6. training only had a side-camera interpretation.

## Completion state

Once the drill runtime reaches `completed`:
- the large coach banner becomes green;
- it says `ГОТОВО ✓`;
- the camera status says `УПРАЖНЕНИЕ · ГОТОВО`;
- voice feedback says `Готово`.

The final screen no longer looks like the learner still needs to correct something.

## Camera mirroring

The preview and skeleton canvas are mirrored together.

Default behavior:
- a physical `user`/selfie camera is mirrored for intuitive self-view;
- an `environment`/rear camera is shown naturally;
- the learner can always toggle **Зеркало** manually.

Mirroring is display-only and does not change machine coordinates or scoring.

## Full-screen training focus

The camera can be expanded into a fixed full-viewport training surface.

The expanded view keeps:
- live camera;
- learner skeleton;
- spectral target;
- compact target plate;
- large coach cue;
- camera/status line.

It hides the rest of the page behind the camera instead of merely stretching the normal layout.

## Coherent manuscript figure

The previous target renderer used independent raster pieces for head, torso, sleeves, hose and boots. This created disconnected or inconsistent body parts.

The new renderer is procedural SVG built from the exact target skeleton:
- one connected torso;
- thick connected upper/lower arms;
- thick connected thighs/shins;
- connected feet;
- consistent head/neck;
- manuscript-like ink + cloth styling;
- red machine skeleton and joint points remain visible above the figure.

The renderer therefore cannot silently drift away from the machine target.

## Side and front camera views

The training screen now offers:

- **Сбоку** — primary/recommended view;
- **Спереди** — additional front-camera view.

### Side view

The existing screen x/y pose normalization is preserved.

### Front view

MediaPipe depth is mapped to the canonical fore/aft axis and camera screen x becomes the body lateral axis.

Because monocular depth is less reliable than image-plane x/y:
- depth-sensitive feature tolerances are widened;
- their scoring weights are reduced;
- depth-sensitive features are removed from hard `requiredFeatures`.

Vertical and joint-angle features keep their normal tolerances.

The front target drawing uses target `z/y` projection so it is genuinely a front view rather than a mirrored side illustration.

Weapon marker angle matching remains side-view only for now because current target sword data does not contain a full 3D blade line.

## Acceptance criteria

- completed drills visibly turn green and say they are finished;
- selfie/rear camera mirroring is predictable and manually overridable;
- camera can fill the viewport on desktop/mobile;
- target human is visually connected rather than floating body parts;
- target caption accurately says side/front;
- learner can switch side/front and the matcher uses the corresponding normalization;
- front-view depth scoring is explicitly softer rather than pretending monocular depth is equally precise;
- side-view behavior and existing tests remain intact.
