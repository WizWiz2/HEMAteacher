# Vom Tag restoration — 2026-09-30

Restored the uncommitted shoulder-guard implementation on top of GitHub main
ff48a6e, checked against REPORT_vom_tag_engraving.md and its supplied screenshots.

- The scoring preset preserves the report's hand centre (0.66, 1.015).
- Both arms have equal spatial bone lengths; fists and blade share an axis.
- All six Vom Tag checkpoints require hand_center_x and hand_center_y.
- The engraving uses the recovered artwork and a fixed illustration rig, keeping
  its proportions independent of user calibration. Illustration coordinates are
  not asserted to be identical to the scoring landmarks.
- The sword renders in both views, includes a continuous hilt and perpendicular
  guard, and fits inside the card. Its frontal projection matches the wrist axis.
- Existing gallery and mock videos are retained.

Validation: frontend tests, TypeScript/production build, static content sync,
standalone Sites build check, plus the six supplied Blender landmark timelines
against all six guard checkpoints (36 combinations). This label-level check does
not run MediaPipe on video and does not validate recognition of a complete strike.

vom-tag-review.png is a fresh component render (side/front/mirrored side), not a
browser screenshot. Browser verification could not run in this session: the cloud
browser rejected the local URL, and local Chromium was unavailable.

The source report's out-of-scope motion, pelvis, and depth-calibration issues remain
separate work. No Sites production deployment is included in this GitHub change.
