# HEMA Trainer (HEMAteacher)

Браузерное приложение для самостоятельной отработки длинного меча (немецкая школа) перед камерой между занятиями с тренером. Камера и MediaPipe Pose работают прямо в браузере, видео никуда не отправляется.

Это не тренер и не оценка «правильной» техники HEMA, а вторая пара глаз.

## Режимы

- **Повторяй за эталоном** (`/#/follow`) — основной режим. Слева эталон двигается по кругу в выбранном темпе, справа камера, поверх неё можно включить «призрак» эталона. Приложение считает повторы и показывает сходство траектории кистей и стоп с эталоном, стабильность и мягкие подсказки. Есть 9 движений: Zornhau, Zwerchhau, Schielhau, Scheitelhau, Krumphau, шаг вперёд и назад, проходной шаг вперёд и назад. Перед подходом показывается проверка кадра: всё тело видно, расстояние подходит, частота кадров, предупреждение, если распознавание идёт на процессоре.
- **Крест Мейера** (`/#/meyer`) — четыре сектора с подсветкой и ритмом: серии, непрерывное движение, память, реакция.
- **Отдельные упражнения** (`/#/drills/<id>`) — стойки, шаги и удары по фазам с голосовыми подсказками и распознаванием движения (подробности ниже).

Камера: основной сценарий — **человек стоит лицом к камере**, целиком в кадре, телефон или ноутбук примерно на уровне груди. Боковой ракурс тоже поддерживается.

## Текущее состояние (октябрь 2026)

- Эталоны и модели построены в основном на синтетике: рендеры Blender/MPFB плюс 12 реальных повторов из публичных видео. Своих записей целевых пользователей пока нет.
- «Повторяй за эталоном»:
  - на синтетических клипах повторы считаются надёжно, включая вход в середине движения и низкий fps;
  - на реальном человеке счёт ещё не проверен;
  - сходство откалибровано на рендерах, поэтому правильный живой повтор обычно набирает 40–60, а не 90+. Это грубая мера, смотреть стоит на динамику.
- Распознавание в отдельных упражнениях:
  - на синтетике работает;
  - на реальных людях пока слабое: своё движение узнаётся в 2 из 6 реальных фронтальных клипов;
  - стойки не распознаются.
- Контент помечен `unvalidated` — тренер его ещё не проверил.

## Запуск

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173, камера работает на localhost или по HTTPS
```

На Windows можно запустить `start.bat` (и остановить `stop.bat`). Сборка статического сайта описана ниже, в «Static deployment» и «Static hosting».

## Отдельные упражнения (live drills)

Работают без загрузки видео: камера и MediaPipe Pose Landmarker работают прямо в браузере, а упражнение проходит как последовательность checkpoint'ов.

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


## Запуск через start.bat (Windows)

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

1. откройте `/#/analysis` (в меню этого инструмента нет, это режим для разработки);
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

Live drills and follow-along support both **front** and **side** camera views. Front (facing the camera) is the main use case. The front view uses image-plane coordinates only (MediaPipe depth is ignored, z = 0) with its own model `motionModel.front.json`; passing steps are detected by the feet swapping image height.

The camera can be expanded to a full-viewport training surface, and preview mirroring can be toggled manually. Selfie cameras are mirrored automatically; rear cameras are not.

See [CR-005](docs/CR-005-DRILL-UX-VIEWS.md).

## Tests

```bash
cd frontend && npm test                      # vitest: recognition, follow-along counter, UI logic
node frontend/scripts/check-motion-scenarios.mjs   # streaming scenarios on recorded poses (repo root)
```

Legacy backend:

```bash
cd backend
python -m pip install -r requirements-test.txt
python -m pytest
```

Покрыты нормализация (сдвиг, масштаб, отзеркаливание), углы на синтетических точках, DTW на одинаковой и замедленной последовательности, одно искусственное расхождение признака, правила замечаний и сквозной прогон синтетического шага: близкая попытка получает более высокую схожесть, чем нарочно удлинённый шаг, а медленная попытка стыкуется по фазе, а не по номеру кадра. Плохой вход (стопа не видна) не получает числовую схожесть.

## Known limitations

- Одна камера.
- Ракурс задан заранее: лицом к камере (основной) или сбоку. Произвольный 3D-ракурс не восстанавливается.
- В кадре один человек.
- Клинок не отслеживается (кроме экспериментального режима с цветными метками); оцениваются кисти, корпус и стопы.
- Модели откалиброваны в основном на синтетике; на реальных людях распознавание и шкала сходства ещё не проверены как следует (см. «Текущее состояние»).
- Схожесть с эталоном — не объективная правильность исторического фехтования.
- Высота таза измеряется относительно стоп, а не пола комнаты.
- Глубина (ось Z) с одной камеры не используется во фронтальном виде; в боковом у неё маленький вес.
- Подробный разбор выполняется после записи, но локально в браузере; видео на сервер не уходит.
