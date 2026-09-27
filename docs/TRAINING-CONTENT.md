# Training content

## Scope

The live library is intentionally a prototype curriculum, not an authoritative reconstruction.

Current beginner set:

1. Advance
2. Retreat
3. Passing step forward
4. Passing step backward
5. Four basic guards/positions: Vom Tag, Ochs, Pflug, Alber
6. Zornhau
7. Krumphau
8. Zwerchhau
9. Schielhau
10. Scheitelhau

The five named master strikes and the four named guards are grounded in the Liechtenauer textual tradition. The exact checkpoint poses, tolerances and sequencing in this repository are **prototype material** and remain `unvalidated: true` until a HEMA trainer reviews them.

Useful primary/secondary source hub:
- https://www.wiktenauer.com/wiki/Johannes_Liechtenauer
- https://wiktenauer.com/wiki/Pseudo-Peter_von_Danzig/Combined

## Single source of truth

A checkpoint references a `targetPoseId`.

Frontend pose presets live in:

```text
frontend/src/drill/posePresets.ts
```

That target is used twice:

1. `TargetPose.tsx` renders the user-facing vector illustration.
2. `checkpointMatcher.ts` derives target feature values from the same pose.

This intentionally avoids the failure mode where a generated picture shows one posture while the matcher expects another.

## Current weapon limitation

MediaPipe Pose Landmarker does not track a longsword blade.

For guard and Meisterhau drills the application currently evaluates:
- stance / foot distance;
- pelvis height;
- torso angle;
- hand center position;
- hand separation;
- elbow angles.

The sword line drawn in the target SVG is a **visual guide only**.

Do not describe these drills as validating blade angle, edge alignment, point trajectory or contact mechanics.

Weapon tracking should be a separate later CR.

## Trainer review checklist

For each drill, ask the trainer to review:
- whether the selected checkpoints are meaningful;
- whether a checkpoint should be static or transient;
- which features should be ignored;
- target tolerances;
- missing transition constraints;
- whether the sequence could teach a beginner a bad habit;
- whether the camera angle is sufficient.

After review, replace prototype pose presets or capture new poses with `/dev/checkpoint-capture`.


## Field-test tracking modes

`guards-basic` uses `upper_body`: shoulders, elbows, wrists and hips must be visible, but the user does not need to step far enough away for both feet to remain in frame.

Footwork and Meisterhau drills use `full_body` because lower-body movement remains part of the exercise.

## Forgiving beginner matching

Checkpoint validity is no longer equivalent to "every feature is inside tolerance".

Each checkpoint can define:
- `passThreshold` — weighted share of features that should pass;
- `requiredFeatures` — features that must pass regardless of overall score;
- per-feature weights.

This is deliberately more forgiving for beginner static guards, where monocular pose jitter and individual body proportions otherwise produce misleading failures.

## Optional weapon marker mode

For weapon-bearing drills the user can enable a marker prototype:
- cyan marker/tape near the guard/grip;
- magenta marker/tape toward the tip.

The browser finds both color clusters and estimates a rough blade line and angle.

This is **not** blade recognition. It is a controlled prototype to validate whether adding weapon geometry materially improves training before investing in a dedicated sword detector.
