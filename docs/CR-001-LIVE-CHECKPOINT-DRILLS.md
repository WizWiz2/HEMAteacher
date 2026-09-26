# CR-001 — Live Checkpoint Drills as the Primary MVP Flow

Status: Proposed  
Priority: High  
Scope: Product flow + frontend realtime pose pipeline  
Supersedes: primary user flow described in `docs/MVP.md`  
Keeps: existing offline video-analysis pipeline as a secondary feature

## 1. Reason for change

The current MVP is centered around:

```text
record video
→ upload
→ backend pose extraction
→ normalization
→ DTW
→ comparison
→ post-run report
```

This is useful as a detailed analysis tool, but it is not the strongest product demo and requires the user to finish a recording before receiving feedback.

The new primary product hypothesis is:

> A beginner can practice a HEMA movement as a sequence of meaningful pose checkpoints while the application watches them in real time, automatically advances through the movement, and gives immediate corrections.

The application should feel closer to a movement/rhythm training game than to a video upload analyzer.

The key demo should be understandable without explanation: a trainer or beginner opens a drill, stands in front of the camera, matches the shown target pose, receives immediate confirmation, progresses to the next checkpoint, and completes the movement.

## 2. Product decision

Live checkpoint drills become the primary MVP experience.

The existing offline video-analysis feature remains in the repository and may later be used for:

- detailed post-run diagnostics;
- trainer review;
- motion research/debugging;
- transition analysis;
- future advanced training modes.

Do not delete the existing backend analysis pipeline.

## 3. Primary user flow

1. User opens the drill library.
2. User selects a drill.
3. Browser requests camera permission.
4. Pose estimation starts locally in the browser.
5. The screen shows:
   - live user camera;
   - live skeleton overlay;
   - target checkpoint illustration or skeleton;
   - checkpoint progress;
   - up to 2–3 current corrections.
6. User matches the checkpoint.
7. If the checkpoint remains valid for its required duration, it passes automatically.
8. The next checkpoint appears automatically.
9. After the final checkpoint:
   - drill completes;
   - elapsed time is shown;
   - user can retry immediately.

No `Next` button is used during training.

## 4. Architectural change

### Current primary architecture

```text
Browser camera
→ recorded file
→ FastAPI
→ OpenCV
→ MediaPipe Python
→ normalize
→ features
→ DTW
→ comparison
→ report
```

### New primary architecture

```text
Browser camera
→ MediaPipe Pose Landmarker in browser
→ semantic landmarks
→ normalization
→ per-frame features
→ short temporal smoothing
→ checkpoint matcher
→ drill state machine
→ live UI
```

The backend must NOT be in the realtime inference path.

FastAPI remains responsible for:

- drill definitions and assets;
- existing video analysis;
- optional future persistence/history;
- future trainer tooling.

## 5. Domain model

### Drill

```ts
interface Drill {
  id: string;
  name: string;
  description: string;
  cameraView: "side";
  checkpoints: Checkpoint[];
}
```

Checkpoint count is dynamic.

There must be no hardcoded assumption that a drill has a fixed number of checkpoints.

Simple actions may have 3–4 checkpoints; complex actions may have more.

### Checkpoint

```ts
interface Checkpoint {
  id: string;
  title: string;
  illustrationUrl?: string;
  holdMs: number;
  constraints: Record<string, FeatureConstraint>;
  weights?: Record<string, number>;
}
```

```ts
type FeatureConstraint =
  | {
      target: number;
      tolerance: number;
    }
  | {
      min: number;
      max: number;
    };
```

Only explicitly configured features affect checkpoint validity.

A checkpoint does not compare the whole skeleton indiscriminately.

Example:

```json
{
  "id": "feet-cross",
  "title": "Feet passing",
  "holdMs": 100,
  "constraints": {
    "foot_distance": {
      "target": 0.18,
      "tolerance": 0.12
    },
    "pelvis_height": {
      "target": 1.85,
      "tolerance": 0.15
    },
    "torso_angle": {
      "target": 2,
      "tolerance": 10
    }
  }
}
```

## 6. Checkpoints vs transitions

A checkpoint describes an important pose/state.

A transition describes what is allowed while moving between checkpoints.

These are intentionally separate concepts.

Future example:

```yaml
transition:
  from: feet-cross
  to: max-stride
  constraints:
    pelvis_vertical_range:
      max: 0.12
    right_ankle_path:
      corridor: 0.18
```

Full transition analysis is NOT part of this iteration.

For the first demo, use enough meaningful and intermediate checkpoints to constrain the movement sufficiently.

The data model must not prevent adding transition constraints later.

## 7. Frontend realtime pose processing

Add MediaPipe Tasks Vision Pose Landmarker to the frontend.

Suggested structure:

```text
frontend/src/live/
  poseLandmarker.ts
  normalize.ts
  features.ts
  smoothing.ts

frontend/src/drill/
  types.ts
  checkpointMatcher.ts
  drillEngine.ts
  scoring.ts

frontend/src/components/
  LivePoseCanvas.tsx
  TargetPose.tsx
  CheckpointProgress.tsx
  LiveFeedback.tsx

frontend/src/pages/
  DrillPage.tsx
  DrillResultPage.tsx
```

### Live pose detector abstraction

The rest of the application must not depend directly on MediaPipe-specific result structures.

Convert landmarks immediately to the existing semantic landmark naming convention.

Suggested interface:

```ts
interface LivePoseDetector {
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
  onPose(callback: (frame: PoseFrame) => void): void;
}
```

### Frame processing

Requirements:

- use camera frames continuously;
- use monotonic timestamps;
- never queue multiple pose inference calls;
- if inference is slower than incoming video, skip frames;
- prioritize low accumulated latency over processing every frame.

## 8. Reuse existing backend math

The current repository already contains useful validated concepts.

Port the relevant logic from:

```text
backend/app/services/normalization/normalizer.py
backend/app/services/features/footwork.py
```

to TypeScript for the live browser pipeline.

The browser and backend versions should use the same feature names and normalization concepts where possible.

Initial frontend feature set:

- left_ankle_x;
- left_ankle_y;
- right_ankle_x;
- right_ankle_y;
- foot_distance;
- pelvis_height;
- left_knee_angle;
- right_knee_angle;
- torso_angle;
- knee_over_foot_left;
- knee_over_foot_right.

Do not initially port every existing backend feature.

## 9. Normalization

Live pose values must not be compared in raw image coordinates.

Use the same conceptual model as the current backend:

- pelvis center as origin;
- stable body-relative scale;
- +Y upward;
- consistent forward X direction;
- visibility threshold.

For the first realtime demo, prefer an explicit user-facing orientation control:

```text
Facing ←
Facing →
```

Do not rely exclusively on automatic direction detection from nose/hip geometry in the critical path.

## 10. Temporal smoothing and debouncing

A checkpoint must never pass from one noisy MediaPipe frame.

Maintain a short feature history, initially approximately:

```text
250–350 ms
```

Use robust aggregation such as median over recent valid samples.

A checkpoint may pass only when:

1. configured constraints are satisfied;
2. enough recent samples are valid;
3. the checkpoint remains valid for `holdMs`.

Dynamic intermediate checkpoints may use approximately:

```text
50–100 ms
```

Static/end-position checkpoints may use approximately:

```text
300–500 ms
```

The exact values belong to the drill definition/configuration.

## 11. Checkpoint matcher

Create:

```text
frontend/src/drill/checkpointMatcher.ts
```

Responsibilities:

- evaluate all configured checkpoint constraints;
- return per-feature pass/fail state;
- calculate display confidence/match percentage;
- track stable valid duration;
- emit `passed` only after `holdMs`.

Suggested result:

```ts
interface CheckpointMatch {
  passed: boolean;
  confidence: number;

  features: Record<
    string,
    {
      passed: boolean;
      value: number;
      target?: number;
      delta?: number;
    }
  >;
}
```

The display confidence is feedback only and must not be described as an objective HEMA technique score.

## 12. Drill state machine

Create:

```text
frontend/src/drill/drillEngine.ts
```

States:

```ts
type DrillState =
  | "calibrating"
  | "ready"
  | "running"
  | "completed";
```

Runtime:

```ts
interface DrillRuntime {
  state: DrillState;
  checkpointIndex: number;
  startedAt?: number;
  finishedAt?: number;
}
```

Behaviour:

### calibrating

- camera starts;
- pose detector initializes;
- capture quality guidance is shown.

### ready

- checkpoint 0 is active;
- timer has not started.

### running

When checkpoint 0 passes:

- start timer;
- advance to checkpoint 1.

Every subsequent successful checkpoint advances automatically.

### completed

After the final checkpoint:

- stop timer;
- show elapsed time;
- show completion state;
- allow immediate retry.

## 13. First game mode: Learn

Only Learn mode is required in this iteration.

Rules:

- incorrect pose does not restart the whole drill;
- user stays on the current checkpoint until it passes;
- useful corrections are shown live;
- timer may be shown but is informational;
- no leaderboard or competitive scoring.

Future modes may include:

- Flow — continuous sequence, violations may invalidate the run;
- Challenge — quality threshold + valid transitions + completion time.

Do not implement Flow or Challenge now.

## 14. Live feedback

During movement show at most 2–3 corrections.

Examples:

```text
↓ Lower pelvis
→ Front foot farther
↶ Straighten torso
```

Do not show detailed tables or full diagnostics during the movement.

The existing offline result page remains the place for detailed metrics.

## 15. Target representation

Visual target and machine target are separate.

Visual target:

```text
illustrationUrl
```

Generated placeholder illustrations are acceptable for the prototype.

Machine target:

```text
explicit numeric feature constraints
or captured normalized reference pose/features
```

Generated images must NOT be treated as biomechanical ground truth.

Prototype material must be clearly identified as unvalidated training material until reviewed by a HEMA trainer.

## 16. Developer checkpoint capture tool

Add a developer-only page:

```text
/dev/checkpoint-capture
```

Required behaviour:

1. open camera;
2. show live skeleton;
3. show current normalized feature values;
4. allow `Capture`;
5. export current normalized pose + feature values as JSON.

This exists to create prototype drills quickly without manually calculating joint geometry.

Backend persistence is not required for the first version.

## 17. Drill data

Add:

```text
data/drills/
```

Create at least one prototype drill:

```text
passing-step-demo
```

It must contain at least 5 checkpoints, with checkpoint count loaded entirely from data.

Use placeholder constraints for the demo.

Do not present placeholder values as validated HEMA instruction.

## 18. Main UI

Primary route:

```text
/drills/:id
```

Expected mobile layout:

```text
┌─────────────────────────────────┐
│ Passing Step        3 / 7       │
│                                 │
│ ┌───────────┐ ┌───────────────┐ │
│ │   USER    │ │    TARGET     │ │
│ │  camera   │ │ illustration  │ │
│ │ + skeleton│ │ / skeleton    │ │
│ └───────────┘ └───────────────┘ │
│                                 │
│            87%                  │
│                                 │
│ ✓ foot distance                 │
│ ↓ pelvis lower                  │
│ ✓ torso                         │
│                                 │
│ ● ● ◉ ○ ○ ○ ○                   │
│                                 │
│             00:03.41            │
└─────────────────────────────────┘
```

Checkpoint advancement is automatic.

A short visual and/or audio signal should acknowledge checkpoint success.

## 19. Home page

The home page should prioritize live training.

Primary CTA:

```text
Start training
```

Drill cards open:

```text
/drills/:id
```

Existing offline video analysis becomes a secondary action:

```text
Detailed video analysis
```

The product subtitle should no longer describe the application primarily as comparison with a trainer recording.

## 20. Existing functionality

Keep existing routes and backend flow:

```text
/record/:id
/sessions/:id
```

Keep existing:

```text
video
→ pose
→ normalize
→ DTW
→ comparison
```

Do not spend time refactoring this pipeline unless required for shared feature consistency.

## 21. Tests

Add frontend tests for:

### Feature calculations

Synthetic landmarks produce expected distances and joint angles.

### Constraint matching

- inside target tolerance → pass;
- outside target tolerance → fail;
- inside min/max range → pass.

### Noise handling

One noisy frame must not pass or fail a stable checkpoint by itself.

### holdMs

Checkpoint cannot pass before the configured hold duration.

### State machine

Verify:

```text
calibrating
→ ready
→ running
→ completed
```

with arbitrary checkpoint counts.

No checkpoint count may be hardcoded.

## 22. Performance requirements

The first target is a modern desktop browser and a modern smartphone browser.

Requirements:

- live UI remains responsive;
- pose inference must not build a frame backlog;
- skeleton follows the user without continuously increasing delay;
- checkpoint feedback is perceptibly realtime.

Stable behaviour is more important than maximizing FPS.

## 23. Implementation order

Implement incrementally.

### Milestone 1 — realtime technical spike

1. Add MediaPipe Tasks Vision frontend dependency.
2. Open camera.
3. Run pose estimation in browser.
4. Draw live skeleton.
5. Port normalization.
6. Port the initial feature subset.
7. Implement one hardcoded checkpoint.
8. Demonstrate stable PASS/FAIL with temporal debouncing.

Do not proceed to a full game UI until this works reliably.

### Milestone 2 — data-driven drill

1. Introduce Drill/Checkpoint types.
2. Load checkpoint array from data.
3. Implement checkpoint matcher.
4. Implement drill state machine.
5. Automatic checkpoint advancement.
6. Timer.
7. Completion/retry.

### Milestone 3 — demo UX

1. Target illustration/skeleton.
2. Progress dots.
3. 2–3 live corrections.
4. Success feedback.
5. Mobile layout polish.

### Milestone 4 — authoring helper

Implement developer checkpoint capture tool.

## 24. MVP acceptance criteria

The CR is implemented when one complete drill works without video upload or backend pose inference.

Given a passing-step demo with at least 5 data-defined checkpoints:

1. user opens drill on laptop or phone;
2. grants camera permission;
3. live video appears;
4. live skeleton appears;
5. target checkpoint appears;
6. current pose is evaluated continuously;
7. a single noisy frame cannot pass a checkpoint;
8. matching the checkpoint for `holdMs` advances automatically;
9. next target appears;
10. all checkpoints can be completed in order;
11. timer runs from first passed checkpoint to final passed checkpoint;
12. completion time is displayed;
13. Retry resets state immediately;
14. checkpoint count is dynamic;
15. the entire primary flow works without uploading recorded video;
16. existing detailed video-analysis flow still remains usable.

## 25. Non-goals

Do NOT add in this CR:

- authentication;
- trainer accounts;
- cloud profiles;
- global records;
- XP/achievements;
- leaderboards;
- multiplayer;
- weapon/sword tracking;
- full transition analysis;
- arbitrary camera angles;
- native mobile application;
- LLM coaching;
- automatic AI training-material generation pipeline;
- payments;
- social features.

## 26. Demo purpose

This iteration is not intended to prove that the application can objectively teach correct HEMA technique.

It is intended to prove that:

> A user can interact with a live sequence of body-position checkpoints in a way that feels understandable, responsive, useful, and worth showing to a HEMA trainer for domain review.

The trainer should be able to critique:

- whether the selected checkpoints make sense;
- which body parameters matter at each checkpoint;
- acceptable tolerances;
- missing transition constraints;
- which parts of the exercise could teach a beginner incorrectly;
- what additional training modes would be valuable.

That domain review is expected to shape the next CR.
