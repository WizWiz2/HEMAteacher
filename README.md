# HEMA Motion Coach

Локальное приложение для самостоятельной отработки footwork между занятиями с тренером.
Человек выбирает движение, которое тренер уже показал, снимает попытку на одну камеру, и программа показывает, чем попытка отличается от эталонной записи.

Это не тренер и не оценка «правильной» техники HEMA. Это вторая пара глаз: сравнение с конкретной записью.

> **Architecture direction:** core training is browser-first. Live checkpoint drills and detailed uploaded-video analysis both run on the user device. See [CR-001](docs/CR-001-LIVE-CHECKPOINT-DRILLS.md), [CR-002](docs/CR-002-FIELD-TEST-REDESIGN.md) and [CR-003](docs/CR-003-BROWSER-FIRST.md), and [CR-004](docs/CR-004-PERSONALIZED-ANATOMY.md). FastAPI remains only as an optional legacy/cloud layer.

## Live drills

Главный MVP-flow теперь работает без загрузки видео: камера и MediaPipe Pose Landmarker работают прямо в браузере, а упражнение проходит как последовательность checkpoint'ов.

В репозитории есть прототипный beginner-набор:
- advance;
- retreat;
- passing step forward;
- passing step backward;
- четыре базовые позиции (Vom Tag, Ochs, Pflug, Alber);
- пять Meisterhäue: Zornhau, Krumphau, Zwerchhau, Schielhau, Scheitelhau.

Для каждого checkpoint используется один machine-readable target pose. Из него одновременно:
- строится визуальный SVG-эталон для пользователя;
- вычисляются target-features для matcher.

Поэтому картинка и алгоритм не могут ожидать разные позы. Материал помечен как `unvalidated`: его должен прожарить HEMA-тренер до использования как учебного стандарта. Клинок пока только визуальный ориентир; matcher проверяет тело, руки и ноги.

См. [Training content](docs/TRAINING-CONTENT.md).


### После первого полевого теста

См. [CR-002 — Field-test usability redesign](docs/CR-002-FIELD-TEST-REDESIGN.md).

Живая тренировка теперь:
- адаптируется к горизонтальной веб-камере ноутбука;
- различает `upper_body` и `full_body` упражнения;
- использует forgiving beginner matcher вместо требования попасть во все параметры одновременно;
- показывает одну крупную подсказку прямо поверх камеры;
- может проговаривать подсказки голосом;
- рисует target как стилизованную фехтбух-гравюру с видимым machine skeleton;
- умеет в экспериментальный marker-mode меча: циановая метка у гарды + ярко-розовая ближе к острию.

Без цветных меток приложение по-прежнему **не заявляет**, что видит клинок.


## Quick start

Двойной щелчок по `start.bat` в корне репозитория.

Обычный запуск теперь поднимает **только frontend**:
- Vite;
- MediaPipe WASM + модель;
- live checkpoint engine;
- локальный offline video analysis;
- IndexedDB для эталонов и результатов.

FastAPI по умолчанию **не запускается**.

Для остановки приложения запустите `stop.bat`.

Если зачем-то нужны старые серверные маршруты:

```bash
python launcher.py --with-backend
```

### Browser-only offline analysis

Для подробного анализа:

1. откройте «Подробный разбор видео»;
2. выберите движение;
3. один раз импортируйте видео-эталон тренера;
4. браузер извлечёт pose locally и сохранит видео + pose в IndexedDB;
5. снимите или загрузите попытку;
6. MediaPipe, normalization, feature extraction, segmentation, DTW, comparison и feedback выполнятся на устройстве;
7. результат тоже останется в IndexedDB.

Видео в этом flow **не отправляется на сервер**.

### Static deployment

```bash
cd frontend
npm ci
npm run build
```

Содержимое `frontend/dist/` можно отдавать обычным static hosting/CDN. Для core-функций Python/FastAPI/GPU на сервере не нужны.

Каталоги drills/movements и analysis profile экспортируются из YAML:

```bash
python scripts/export_static_content.py
```

CI проверяет, что `frontend/public/content/*.json` синхронизированы с `data/*.yaml`.

## Architecture

```text
                         Browser
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│ Camera ──→ MediaPipe ──→ normalized pose ──→ live matcher  │
│                                                             │
│ Uploaded video                                              │
│      │                                                      │
│      ▼                                                      │
│ browser video decoder                                      │
│      │                                                      │
│      ▼                                                      │
│ MediaPipe Pose                                             │
│      │                                                      │
│      ▼                                                      │
│ normalization → features → segmentation                     │
│                          │                                  │
│ Reference in IndexedDB ──┴→ Web Worker: DTW + comparison  │
│                                      │                      │
│                                      ▼                      │
│                                   feedback                  │
│                                                             │
│ IndexedDB: reference videos / poses / local sessions        │
└─────────────────────────────────────────────────────────────┘

Static assets:
data/*.yaml → export_static_content.py → frontend/public/content/*.json

Optional legacy/cloud layer:
FastAPI / old server-side video pipeline / future account sync
```

Главный принцип: вычислительная стоимость растёт на устройстве пользователя, а не на VPS. Один пользователь и тысяча пользователей не создают тысячу MediaPipe/DTW jobs на сервере.

Монорепозиторий по-прежнему содержит `backend/`, но он не нужен для обычного browser-first запуска.

## Development

Фронтенд:

```bash
cd frontend
npm install
npm run dev
```

Интерфейс: http://localhost:5173.

### Static hosting (ChatGPT Sites)

The training app runs entirely in the browser. To build a standalone site:

```bash
cd frontend && npm ci && cd ..
node scripts/build-site.mjs
node scripts/check-static-build.mjs
```

Publish `dist/` at the domain root over HTTPS. The build includes MediaPipe WASM,
the pose model, lesson content, and the analysis Web Worker. Client routes use
hash URLs (for example `/#/drills/id`), so static hosting needs no route rewrite.
Camera access needs HTTPS (or localhost); sessions and
recordings are local to the device's IndexedDB. GitHub Actions validates the
static build and uploads it as the `hematrainer-static` artifact.

Sites publication currently uses the Sites connector. Its repository write
credential is short lived and scoped to one Site, so the GitHub Actions job does
not have an unattended Sites deployment credential. A green CI run means the
artifact is ready; it does not mean the Site has been updated.

Backend нужен только для legacy API и серверных экспериментов:

```bash
python launcher.py --with-backend
```



### Personalized anatomy

Live drills briefly calibrate the user's body proportions before matching. Limb lengths are stored locally and used to retarget checkpoint poses, so the matcher and spectral target compare technique on the user's own proportions rather than on a fixed mannequin.

Detailed uploaded-video analysis canonicalizes both the trainer/reference sequence and the attempt to the attempt user's measured proportions before DTW and comparison.



### Training camera views

Live drills support both **side** and **front** camera views. Side view remains the most reliable default. Front view maps MediaPipe depth into the canonical fore/aft axis and deliberately uses softer tolerances for depth-sensitive features.

The camera can be expanded to a full-viewport training surface, and preview mirroring can be toggled manually. Selfie cameras are mirrored automatically; rear cameras are not.

See [CR-005](docs/CR-005-DRILL-UX-VIEWS.md).

## Tests

```bash
cd backend
python -m pip install -r requirements-test.txt
python -m pytest
```

Покрыты нормализация (сдвиг, масштаб, отзеркаливание), углы на синтетических точках, DTW на одинаковой и замедленной последовательности, одно искусственное расхождение признака, правила замечаний и сквозной прогон синтетического шага: близкая попытка получает более высокую схожесть, чем нарочно удлинённый шаг, а медленная попытка стыкуется по фазе, а не по номеру кадра. Плохой вход (стопа не видна) не получает числовую схожесть.

## Known limitations

- Одна камера.
- Ракурс задан заранее. В этой версии все движения снимаются сбоку. Произвольный 3D-ракурс не восстанавливается.
- В кадре один человек.
- Только footwork, без оружия.
- Клинок, спарринг и удары не разбираются.
- Схожесть с эталоном — не объективная правильность исторического фехтования.
- Высота таза измеряется относительно стоп, а не пола комнаты.
- Глубина (ось Z) с одной камеры неточная, боковые признаки имеют маленький вес.
- Подробный разбор выполняется после записи, но локально в браузере; видео на сервер не уходит.
