# Крест Мейера

Route: `/meyer`. Four-sector cue trainer, camera off by default. Four modes:

- Learning repeats a selected four-cut ring; optional camera gates advancement on a matched hand movement.
- Flow runs all four rings (16 cues), on a configurable beat.
- Memory removes next/number hints after the first four cues and all highlight hints after eight; audio keeps the beat.
- Reaction samples non-repeating targets and varies intervals by ±20%. With camera, latency is measured from cue to movement onset, not its completion.

The square shows opponent openings in **viewer** coordinates. Its ring order is UR–LL–LR–UL; LL–UR–UL–LR; LR–UL–UR–LL; UL–LR–LL–UR. Historical text uses the opponent's sides, which reverse screen left/right. This is a target diagram, not a rigid instruction to cut along the drawn diagonal. Source: Joachim Meyer 1570 four-openings diagram; modern explanatory reading: https://www.keithfarrell.net/blog/2017/05/meyers-four-openings-drill-aka-meyers-square/ . Reaction and fading prompts are product adaptations.

Countdown: 5 seconds on start, 3 on resume. Hiding the tab pauses. A delayed timer emits one fresh cue rather than rapidly replaying all missed beats. A stopped session does not report actual hits when camera is off. Camera and settings cannot be switched in the middle of an active run.

## Experimental camera

This is **not** the trained technique matcher or a blade detector. The user records and confirms one labelled wrist-path example per sector from a frontal view. Examples must differ by cosine <0.8. Hand midpoint coordinates are measured relative to shoulders, with aspect correction and shoulder-width scaling. Both wrists and shoulders need visibility ≥0.65. Tracking loss, >180 ms gaps, and large jumps reset the segment. A settled trajectory or reversal completes the swing; no target-pose hold is required. Matching needs cosine ≥0.82 and runner-up margin ≥0.18.

Limitations: wrist direction is not a blade hit, edge alignment, or a technique grade. Preparatory/return movements can resemble labelled swings. Camera angles, wrist occlusion, body rotation and complex cuts can make four sectors inseparable. Thresholds are heuristic, not calibrated against labelled Meyer-cut videos. Unit tests check synthetic direction separation, tracking gaps, jitter, body translation, jumps, reversals, sequence order, timing and pause handling. Live-camera recognition accuracy is unverified. Production UI explicitly calls the option experimental and offers cue-only training.
