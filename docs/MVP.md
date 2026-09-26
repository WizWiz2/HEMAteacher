# HEMA Motion Coach — MVP

## 0. Цель проекта

Создать работающий MVP приложения для самостоятельной тренировки HEMA между занятиями с тренером.

Приложение **не обучает HEMA с нуля** и **не пытается определить, является ли техника пользователя объективно правильной**.

Его задача уже и полезнее:

> Пользователь выбирает движение, которое ранее показал тренер, записывает свою попытку на одну камеру, а приложение сравнивает движение пользователя с эталонной записью и показывает конкретные различия.

Основной сценарий MVP — **footwork / проходки без оружия**.

Пример:

1. Тренер записал правильный passing step.
2. Пользователь ставит телефон.
3. Видит эталон.
4. Записывает свою попытку.
5. Система извлекает скелет из обеих записей.
6. Выравнивает движения во времени.
7. Сравнивает положение тела и траектории.
8. Показывает:
   - визуальное наложение;
   - участки движения с наибольшим расхождением;
   - 1–3 конкретных замечания.

Главная гипотеза MVP:

> Можно ли по видео с одного обычного телефона получить feedback, который реально помогает человеку корректировать HEMA footwork самостоятельно?

---

# 1. Что входит в MVP

Обязательный функционал:

### Library

Пользователь видит небольшую библиотеку движений.

Для MVP достаточно 3–5 движений:

- advance;
- retreat;
- passing step forward;
- passing step backward;
- cross step или другой более сложный footwork-паттерн.

Название конкретных движений должно быть конфигурируемым.

Каждое движение имеет:

- id;
- название;
- краткое описание;
- эталонное видео;
- эталонный skeleton;
- рекомендуемый ракурс камеры;
- список анализируемых признаков.

---

### Reference playback

Пользователь может:

- посмотреть эталонное видео;
- поставить на паузу;
- замедлить воспроизведение;
- увидеть skeleton overlay поверх эталона.

---

### Recording

Пользователь может записать собственную попытку.

На экране перед записью показать инструкции:

- всё тело должно быть видно;
- телефон должен стоять неподвижно;
- использовать рекомендованный ракурс;
- в кадре должен находиться один человек;
- желательно однотонный или визуально простой фон;
- движение выполнять без меча для первой версии.

Не требуется real-time analysis.

После записи видео отправляется на анализ.

---

### Pose extraction

Для каждого кадра получить landmarks человеческого тела.

Хранить как минимум:

- timestamp;
- x;
- y;
- z/depth estimate, если доступно;
- visibility/confidence.

В MVP анализ должен работать прежде всего по 2D/2.5D landmarks.

Не строить полноценную 3D-реконструкцию пространства.

---

### Motion comparison

Система должна сравнить reference motion и user motion несмотря на:

- различную длительность записи;
- разную скорость выполнения;
- небольшую разницу расстояния до камеры;
- разный рост и пропорции тела.

Pipeline:

video
→ frames
→ pose landmarks
→ cleanup
→ body normalization
→ motion segmentation
→ temporal alignment
→ feature extraction
→ comparison
→ feedback

---

### Result screen

После анализа показать:

1. эталон;
2. запись пользователя;
3. skeleton overlay;
4. synchronized playback;
5. общую шкалу timeline;
6. участки с существенными расхождениями;
7. текстовый feedback.

Feedback должен быть конкретным.

Плохо:

> Technique score: 72%.

Хорошо:

> На второй половине шага передняя стопа ушла примерно на 18% дальше относительно длины ноги, чем в эталоне.

> Корпус начал разворачиваться раньше переноса веса.

> Во время завершения шага расстояние между стопами осталось заметно больше эталонного.

Числовой score можно отображать как дополнительную информацию, но он не должен быть основным результатом.

---

# 2. Что НЕ входит в MVP

Это принципиальные ограничения scope.

НЕ делать:

- регистрацию пользователей;
- аккаунты;
- облачные профили;
- социальные функции;
- рейтинги;
- gamification;
- подписки;
- платежи;
- сложную авторизацию;
- real-time coaching;
- голосового тренера;
- LLM как обязательную часть анализа;
- распознавание меча;
- анализ клинка;
- анализ противника;
- анализ sparring;
- распознавание ударов;
- автоматическое определение техники;
- обучение собственной нейросети;
- multi-camera capture;
- biomechanical physics simulation;
- полноценную 3D-реконструкцию;
- native iOS/Android приложение.

Также не делать production infrastructure раньше времени.

MVP должен запускаться локально через Docker Compose.

---

# 3. Архитектура

Использовать monorepo.

Предлагаемая структура:

```text
hema-motion-coach/
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── player/
│   │   ├── recording/
│   │   └── types/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── domain/
│   │   ├── services/
│   │   │   ├── video/
│   │   │   ├── pose/
│   │   │   ├── normalization/
│   │   │   ├── alignment/
│   │   │   ├── features/
│   │   │   └── feedback/
│   │   ├── models/
│   │   └── main.py
│   │
│   └── tests/
│
├── data/
│   ├── movements/
│   ├── references/
│   └── sessions/
│
├── scripts/
│   ├── import_reference.py
│   └── analyze_video.py
│
├── docker-compose.yml
├── README.md
└── docs/
```

---

# 4. Technology stack

## Frontend

Use:

- React;
- TypeScript;
- Vite;
- browser MediaRecorder/getUserMedia;
- responsive mobile-first UI.

The web application must be usable from a modern mobile browser.

Do NOT introduce React Native/Flutter at MVP stage.

Reason:

The hypothesis concerns motion analysis, not native mobile engineering.

If the CV prototype proves useful, native/mobile packaging can be considered separately.

---

## Backend

Use:

- Python 3.12+;
- FastAPI;
- Pydantic;
- NumPy;
- OpenCV;
- MediaPipe Tasks Vision.

Optional lightweight dependencies are allowed where useful.

Avoid heavy ML frameworks unless actually required.

No PyTorch/TensorFlow dependency merely for future-proofing.

---

## Persistence

For MVP:

- SQLite for metadata;
- filesystem for videos and skeleton JSON.

Do not use PostgreSQL.

Example:

```text
data/
  references/
    passing-step-forward/
      reference.mp4
      pose.json

  sessions/
    01HX.../
      input.mp4
      pose.json
      normalized_pose.json
      comparison.json
```

---

# 5. Domain model

## Movement

```json
{
  "id": "passing-step-forward",
  "name": "Passing Step Forward",
  "description": "...",
  "camera_view": "side",
  "reference_video": "...",
  "reference_pose": "...",
  "analysis_profile": "footwork_v1"
}
```

---

## PoseFrame

```json
{
  "timestamp_ms": 120,
  "landmarks": {
    "left_hip": {
      "x": 0.47,
      "y": 0.52,
      "z": -0.03,
      "visibility": 0.98
    }
  }
}
```

Internally landmarks may use numeric MediaPipe indices, but domain/business code should expose semantic names where practical.

---

## MotionSequence

```text
MotionSequence
    fps
    duration
    frames[]
    quality
```

Quality must include at least:

```json
{
  "frames_total": 150,
  "frames_valid": 146,
  "pose_detection_ratio": 0.973,
  "low_confidence_landmarks": []
}
```

---

## AnalysisSession

```text
id
movement_id
created_at
video_path
status
pose_path
comparison_path
```

Status:

```text
uploaded
extracting_pose
normalizing
aligning
analyzing
completed
failed
```

---

# 6. Pose processing

Implement `PoseExtractor` behind an interface.

Example:

```python
class PoseExtractor(Protocol):
    def extract(self, video_path: Path) -> MotionSequence:
        ...
```

Initial implementation:

```text
MediaPipePoseExtractor
```

This is important: comparison logic must not directly depend on MediaPipe.

Later it should be possible to swap pose estimation implementation without rewriting the analysis engine.

---

# 7. Pose quality validation

Before comparison validate input.

Reject or warn if:

- body is frequently outside frame;
- feet are not visible;
- pose cannot be detected in too many frames;
- video contains multiple people;
- camera changes orientation significantly;
- movement is too short;
- user stands at obviously incompatible camera angle.

Exact thresholds should live in configuration.

Example:

```yaml
pose_quality:
  minimum_valid_frame_ratio: 0.85
  minimum_landmark_visibility: 0.6
```

Do not silently generate confident feedback from bad input.

If pose quality is insufficient, return:

```text
Unable to analyze reliably.
Reason: right foot was outside the frame during 37% of movement.
```

---

# 8. Skeleton normalization

Raw image coordinates are unsuitable for comparison.

Normalize skeleton independently for each frame/sequence.

At minimum:

### Translation normalization

Use pelvis/hip center as local origin:

```text
root = midpoint(left_hip, right_hip)
```

Translate all landmarks relative to root.

---

### Scale normalization

Normalize by stable body measurement.

Preferred candidates:

- shoulder width;
- hip width;
- torso length;
- estimated leg length.

Do not normalize based on image dimensions alone.

The implementation should make scale strategy configurable.

---

### Orientation

For MVP enforce a known camera orientation.

Example:

```text
camera_view = side
```

Do not try to solve arbitrary-camera 3D orientation in v1.

Support mirroring when necessary.

---

# 9. Temporal alignment

The reference may take 1.2 seconds while the user takes 2 seconds.

Frame N must therefore not simply be compared with frame N.

Implement temporal alignment.

Initial method:

**Dynamic Time Warping (DTW).**

Input:

```text
reference feature sequence
user feature sequence
```

Output:

```text
(reference_frame, user_frame)
```

mapping.

Build DTW internally or use a small well-maintained library, but wrap it behind:

```python
class MotionAligner(Protocol):
    def align(
        self,
        reference: MotionSequence,
        attempt: MotionSequence
    ) -> AlignmentResult:
        ...
```

Comparison logic must not depend directly on DTW.

---

# 10. Feature extraction

Do not compare raw landmark coordinates only.

Build semantic motion features.

## MVP footwork features

At minimum:

### Feet

- left/right foot position relative to pelvis;
- distance between feet;
- forward/backward displacement;
- lateral displacement;
- trajectory of ankles;
- trajectory of heels/toes where available.

### Legs

- knee angle;
- hip angle;
- approximate knee-over-foot relationship;
- leg extension.

### Body

- pelvis height;
- torso lean;
- torso rotation proxy;
- shoulder position relative to pelvis;
- vertical bounce.

### Timing

- movement start;
- maximum stride;
- foot plant;
- movement completion.

Example feature vector:

```text
[
  left_ankle_x,
  left_ankle_y,
  right_ankle_x,
  right_ankle_y,
  foot_distance,
  left_knee_angle,
  right_knee_angle,
  pelvis_height,
  torso_angle
]
```

All features must be documented with units/normalization.

---

# 11. Comparison engine

Architecture:

```python
class MotionComparator:
    def compare(
        reference: PreparedMotion,
        attempt: PreparedMotion,
        alignment: AlignmentResult,
        profile: AnalysisProfile,
    ) -> ComparisonResult:
        ...
```

Comparison must calculate per-feature and per-phase deviations.

Example:

```json
{
  "feature": "foot_distance",
  "phase": "landing",
  "reference": 0.74,
  "attempt": 0.91,
  "delta": 0.17,
  "severity": "warning"
}
```

Severity:

```text
info
warning
major
```

Thresholds live in movement/analysis profile configuration.

Do NOT hardcode HEMA coaching rules throughout Python code.

---

# 12. Analysis profiles

Introduce configurable analysis profiles.

Example:

```yaml
id: footwork_v1

features:
  foot_distance:
    weight: 1.0
    warning_threshold: 0.12
    major_threshold: 0.22

  pelvis_height:
    weight: 0.6
    warning_threshold: 0.08

  torso_angle:
    weight: 0.7
    warning_threshold_deg: 10
```

This will later allow a trainer to tune what is important.

For MVP these profiles can be manually written YAML files.

No UI editor required.

---

# 13. Feedback engine

Feedback must initially be deterministic.

Do NOT use an LLM to invent biomechanical explanations.

Pipeline:

```text
comparison metrics
→ rule engine
→ prioritized observations
→ human-readable templates
```

Example rule:

```text
IF
foot_distance_delta > threshold
AND phase == landing

THEN
"At the end of the step your stance is wider than the reference."
```

Another:

```text
IF
pelvis_vertical_variation > reference + threshold

THEN
"Your body rises noticeably during the step. Try to keep the pelvis at a more consistent height."
```

Important:

The application compares against a **reference recording**.

Therefore wording must prefer:

```text
"compared with the reference"
```

instead of claiming:

```text
"this is incorrect HEMA technique"
```

The software is not an authority on historical fencing technique.

---

# 14. Feedback prioritization

Do not overwhelm the user with 20 errors.

Return maximum:

```text
3 primary observations
```

Sort approximately by:

```text
severity × feature_weight × duration
```

Additionally provide raw detailed metrics in an expandable diagnostics section.

---

# 15. Overall score

An overall similarity score may exist:

```text
0–100
```

but must be secondary.

Do not call it:

```text
Technique score
Skill score
HEMA rating
```

Call it:

```text
Motion similarity
```

It indicates similarity to this specific reference recording.

---

# 16. Visualization

The result viewer is critical to MVP.

Implement synchronized playback:

```text
Reference | User
```

with the same logical phase of motion shown side-by-side.

Optional mode:

```text
Overlay
```

Draw skeleton:

- reference;
- user.

Show relevant joints.

Allow:

- play;
- pause;
- scrub;
- 0.25×;
- 0.5×;
- 1×.

Show timeline markers for major deviations.

Example:

```text
0% ----- ! -------- !! --------- ! ---- 100%
```

Clicking marker seeks both videos to that movement phase.

---

# 17. API

## List movements

```http
GET /api/v1/movements
```

Response:

```json
[
  {
    "id": "passing-step-forward",
    "name": "Passing Step Forward",
    "camera_view": "side"
  }
]
```

---

## Movement details

```http
GET /api/v1/movements/{movement_id}
```

---

## Submit attempt

```http
POST /api/v1/movements/{movement_id}/attempts
Content-Type: multipart/form-data
```

Input:

```text
video
```

Response:

```json
{
  "session_id": "..."
}
```

---

## Session status

```http
GET /api/v1/sessions/{session_id}
```

---

## Analysis result

```http
GET /api/v1/sessions/{session_id}/result
```

Example:

```json
{
  "movement_id": "passing-step-forward",
  "similarity": 78.4,

  "quality": {
    "pose_detection_ratio": 0.96
  },

  "feedback": [
    {
      "severity": "major",
      "phase": 0.63,
      "feature": "foot_distance",
      "message": "Your final stance is wider than the reference."
    }
  ],

  "alignment": [],
  "metrics": {}
}
```

---

# 18. Reference import

Provide CLI command:

```bash
python scripts/import_reference.py \
  --movement passing-step-forward \
  --video ./reference.mp4
```

It must:

1. validate video;
2. extract pose;
3. normalize sequence;
4. calculate features;
5. persist results.

Reference processing must happen once, not every user request.

---

# 19. Debug tooling

This is mandatory.

CV development without visualization will become impossible to debug.

Implement developer/debug export that creates a rendered MP4 containing:

```text
video
+ landmarks
+ joints
+ frame/time
+ detected phase
```

Also create an optional comparison debug video:

```text
reference skeleton
+
attempt skeleton
+
aligned frame IDs
+
selected metrics
```

CLI:

```bash
python scripts/analyze_video.py \
  --movement passing-step-forward \
  --video attempt.mp4 \
  --debug-output ./debug/
```

---

# 20. Automated tests

Tests are required for mathematical/business logic.

At minimum:

### Normalization

Test that the same skeleton:

- shifted in image;
- uniformly scaled;

produces approximately equal normalized pose.

---

### Joint angles

Use synthetic landmarks with known angles.

---

### DTW

Test identical sequence:

```text
distance ≈ 0
```

Test same sequence at different playback speeds.

Expected:

```text
alignment remains approximately correct
```

---

### Comparison

Synthetic difference in one feature must generate expected metric.

---

### Feedback

Known ComparisonResult must generate expected feedback rule.

---

# 21. Golden integration tests

Add small fixture dataset:

```text
tests/fixtures/
  reference/
  good_attempt/
  bad_attempt/
```

These should test full pipeline:

```text
video
→ pose
→ normalize
→ align
→ compare
→ feedback
```

The test does not require exact bit-for-bit equality.

Assert expected ranges and observations.

---

# 22. Logging

Use structured logs.

Each pipeline stage should log:

```text
session_id
movement_id
stage
duration_ms
```

Example:

```json
{
  "session_id": "...",
  "stage": "pose_extraction",
  "duration_ms": 1832
}
```

On failures include reason but not dump entire video/frame data into logs.

---

# 23. Configuration

No magic constants scattered across the code.

Use configuration for:

- visibility threshold;
- valid frame ratio;
- feature weights;
- comparison thresholds;
- supported video size;
- maximum duration;
- camera orientation;
- analysis profiles.

---

# 24. Privacy

MVP runs locally.

No external video upload.

No cloud inference.

No analytics.

No third-party API dependency is required for core functionality.

Videos remain in local application storage.

Provide ability to delete a session.

---

# 25. Docker

Required:

```bash
docker compose up --build
```

must start:

```text
frontend
backend
```

Application accessible locally.

No Kubernetes.

No Helm.

No Terraform.

Do not deploy anything during MVP development.

---

# 26. README

README must include:

## Quick start

```bash
docker compose up --build
```

## Add reference

Example CLI.

## Architecture

Short architecture diagram.

## Development

How to run frontend/backend separately.

## Tests

Commands for unit/integration tests.

## Known limitations

Explicitly document:

- single camera;
- controlled orientation;
- one person;
- footwork only;
- no weapon tracking;
- reference similarity ≠ objective technique correctness.

---

# 27. Architecture diagram

```text
┌──────────────────────────┐
│       Mobile Browser     │
│                          │
│ Movement Library         │
│ Reference Player         │
│ Camera Recorder          │
│ Comparison Viewer        │
└────────────┬─────────────┘
             │
             │ MP4
             ▼
┌──────────────────────────┐
│         FastAPI          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Video Processor      │
│       OpenCV             │
└────────────┬─────────────┘
             │ frames
             ▼
┌──────────────────────────┐
│      Pose Extractor      │
│      MediaPipe           │
└────────────┬─────────────┘
             │ landmarks
             ▼
┌──────────────────────────┐
│      Normalization       │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Feature Extraction     │
└────────────┬─────────────┘
             │
      ┌──────▼───────┐
      │ Temporal     │
      │ Alignment    │
      │ DTW          │
      └──────┬───────┘
             │
             ▼
┌──────────────────────────┐
│     Motion Comparator    │
└────────────┬─────────────┘
             │ metrics
             ▼
┌──────────────────────────┐
│     Feedback Engine      │
│ deterministic rules      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Comparison Result    │
└──────────────────────────┘
```

---

# 28. Implementation order

The agent MUST implement the project incrementally.

Do not begin with the complete UI.

## Phase 1 — Offline CV spike

Input:

```text
reference.mp4
attempt.mp4
```

Output:

```text
reference_pose.json
attempt_pose.json
overlay.mp4
```

Success condition:

Skeleton reliably follows both recordings.

---

## Phase 2 — Normalization

Implement:

```text
translation
scale
orientation
```

Create visualization of normalized skeletons.

Success condition:

Two recordings of the same movement from different distances to camera visually overlap reasonably after normalization.

---

## Phase 3 — Temporal alignment

Implement DTW.

Output synchronized skeleton comparison.

Success condition:

The same movement performed slowly and quickly aligns by motion phase rather than frame number.

---

## Phase 4 — Footwork metrics

Implement first semantic features.

Start only with:

```text
foot distance
foot displacement
pelvis height
knee angles
torso angle
```

Do not implement twenty metrics immediately.

---

## Phase 5 — Feedback

Implement deterministic rules for those metrics.

---

## Phase 6 — Debug viewer

Create comparison visualization.

This phase must happen before polishing product UI.

---

## Phase 7 — API

Wrap pipeline in FastAPI.

---

## Phase 8 — Minimal frontend

Pages:

```text
/
    Movement Library

/movements/:id
    Reference + Start Attempt

/record/:id
    Camera recording

/sessions/:id
    Processing / Result
```

---

## Phase 9 — UX polish

Only after complete end-to-end pipeline works.

---

# 29. First development milestone

The first milestone is intentionally tiny.

The following CLI command:

```bash
python scripts/compare.py \
    --reference reference.mp4 \
    --attempt attempt.mp4 \
    --output ./result/
```

must produce:

```text
result/
  reference_pose.json
  attempt_pose.json
  normalized_reference.json
  normalized_attempt.json
  alignment.json
  comparison.json
  comparison.mp4
```

`comparison.mp4` must visually show both aligned skeletons.

`comparison.json` must contain at least:

```json
{
  "similarity": 0.0,
  "features": {},
  "largest_deviations": []
}
```

Do not build the web application until this works.

---

# 30. MVP acceptance criteria

The MVP is considered successful when the following demonstration works:

### Given

A reference recording of one HEMA footwork movement.

### And

Three attempt recordings:

1. intentionally close reproduction;
2. same movement performed much slower;
3. movement containing an intentionally exaggerated technical difference.

### Then

The application must:

- detect the body successfully in most frames;
- normalize different body/image scale;
- align fast/slow attempts correctly;
- show synchronized skeleton visualization;
- identify the deliberately introduced difference;
- provide a human-readable explanation of that difference;
- rank the close reproduction as more similar than the deliberately bad reproduction.

Most importantly:

> A HEMA practitioner watching the visualization and reading the feedback should be able to understand what part of their repetition differed from the reference.

---

# 31. Definition of Done for MVP

MVP is DONE when:

- 3–5 reference footwork movements exist;
- recording from mobile browser works;
- reference and attempt poses are extracted;
- normalization works;
- temporal alignment works;
- at least 5 meaningful footwork features exist;
- result viewer works;
- maximum 3 prioritized feedback observations are shown;
- bad input is detected instead of producing nonsense;
- application runs locally with Docker Compose;
- core math has unit tests;
- at least one full pipeline integration test exists;
- README explains setup and limitations.

Anything beyond this is backlog.

---

# 32. Future backlog — DO NOT implement now

Potential future direction:

## Trainer mode

Trainer records their own reference motions.

```text
video
→ pose
→ cleanup
→ reference
```

---

## Composable movement graph

Represent technique as transitions:

```text
Guard A
   │
 Action X
   ▼
Guard B
```

A phrase becomes:

```text
Guard A
→ Action X
→ Guard B
→ Action Y
→ Guard C
```

This avoids having to record every possible combination as one large animation.

---

## Weapon tracking

Later:

```text
pose skeleton
+
sword detection
+
blade orientation
+
tip trajectory
```

---

## Phrase training

Analyze sequences of several actions.

---

## Live coaching

Real-time camera feedback.

---

## Native app

iOS/Android client after product validation.

---

## Trainer tooling

Allow trainers to:

- record references;
- annotate phases;
- select important features;
- choose tolerances;
- publish exercise packs.

---

# 33. Agent behavior requirements

When implementing this project:

1. Prefer simple explicit code over premature abstractions.

2. However, isolate external CV implementations behind interfaces.

3. Do not add infrastructure or dependencies without a current MVP requirement.

4. Before implementing a feature, check whether it belongs to the MVP scope defined above.

5. Keep algorithms separately testable from API/UI.

6. Every mathematically meaningful transformation needs tests.

7. Every CV step needs a debug visualization where practical.

8. Never hide pose-detection failure by returning fabricated metrics.

9. Similarity to the reference must never be presented as objective fencing correctness.

10. Do not introduce an LLM into the critical analysis pipeline.

11. Complete the offline:

```text
video → skeleton → normalized skeleton → alignment → metrics
```

pipeline before spending substantial effort on UI.

12. If requirements are ambiguous, choose the simplest implementation that preserves the architecture and MVP goal rather than adding features.

---

# 34. Product principle

The product is not:

> “An AI knows how to fence and teaches you.”

The product is:

> “Your trainer showed you how this movement should look. The app gives you another pair of eyes while you practice it alone.”

That distinction should guide every technical and UX decision.