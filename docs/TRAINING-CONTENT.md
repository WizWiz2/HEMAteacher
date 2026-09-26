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
