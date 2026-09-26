# HEMA Motion Coach

Локальное приложение для самостоятельной отработки footwork между занятиями с тренером.
Человек выбирает движение, которое тренер уже показал, снимает попытку на одну камеру, и программа показывает, чем попытка отличается от эталонной записи.

Это не тренер и не оценка «правильной» техники HEMA. Это вторая пара глаз: сравнение с конкретной записью.

> **Architecture direction:** the primary MVP flow is being changed to live checkpoint-based drills. See [CR-001 — Live Checkpoint Drills](docs/CR-001-LIVE-CHECKPOINT-DRILLS.md). The existing offline video-analysis flow remains as a secondary feature.

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


## Quick start

Двойной щелчок по `start.bat` в корне репозитория. Скрипт проверяет Python и Node.js, при необходимости ставит их через winget, создаёт окружение, докачивает модель позы и открывает http://127.0.0.1:5173/ . Окна «HEMA API» и «HEMA Web» должны остаться открытыми.

На Python 3.13 живая тренировка работает. Подробный разбор загруженного видео на сервере требует Python 3.12: у MediaPipe нет колёс для 3.13. Тогда либо поставьте 3.12 и запустите `start.bat` ещё раз после удаления папки `.venv`, либо используйте Docker.

Тот же запуск через Docker:

```bash
docker compose up --build
```

- Компьютер: http://localhost:8080
- Телефон в той же сети: `https://<адрес-компьютера>:8443`

На телефоне браузер попросит подтвердить самоподписанный сертификат. После этого страница считается защищённой, и камера в браузере открывается. По обычному `http://` в локальной сети камера в мобильном браузере не заработает — тогда снимите ролик камерой телефона и загрузите файл.

Каталог из пяти движений уже есть. Видео эталонов в репозиторий не входят: их нужно импортировать.

## Add reference

Положите ролик в `data/incoming/` (папка может не существовать — создайте её) и выполните внутри контейнера:

```bash
docker compose exec backend python scripts/import_reference.py --movement passing-step-forward --video /data/incoming/reference.mp4
```

Команда проверяет видео, один раз снимает позу, нормализует скелет и сохраняет результат в `data/references/passing-step-forward/`. Повторно гонять MediaPipe на каждый запрос пользователя не нужно.

Так же импортируются `advance`, `retreat`, `passing-step-backward`, `cross-step`. Имена и описания правятся в `data/movements/*.yaml`.

Офлайн-сравнение двух роликов без интерфейса:

```bash
docker compose exec backend python scripts/compare.py --reference /data/incoming/reference.mp4 --attempt /data/incoming/attempt.mp4 --output /data/result
```

В каталоге появятся позы, нормализованные скелеты, `alignment.json`, `comparison.json` и `comparison.mp4` с двумя выровненными скелетами.

Отладочный ролик поверх исходного видео:

```bash
docker compose exec backend python scripts/analyze_video.py --movement passing-step-forward --video /data/incoming/attempt.mp4 --debug-output /data/debug
```

## Architecture

```text
Браузер
  библиотека движений, плеер эталона, запись, сравнение
        │  mp4
        ▼
FastAPI
        ▼
OpenCV  →  кадры
        ▼
MediaPipe Pose Landmarker  →  точки скелета
        ▼
нормализация (таз, масштаб корпуса, лицо в +X)
        ▼
признаки footwork
        ▼
DTW  →  одна и та же фаза шага, даже если темп другой
        ▼
сравнение с порогами из YAML
        ▼
до трёх текстовых замечаний
```

Монорепозиторий: `frontend/` (React, TypeScript, Vite), `backend/` (FastAPI), `data/` (YAML движений, профили, видео и JSON), `scripts/`.

Метаданные попыток — SQLite (`data/coach.sqlite`). Видео и скелеты — файлы в `data/sessions/` и `data/references/`. PostgreSQL нет. Аккаунтов нет. Видео никуда наружу не уходит, отдельного облачного инференса нет.

Удаление попытки: кнопка на экране результата или `DELETE /api/v1/sessions/{id}`.

## Development

MediaPipe ставится на Python 3.12. На 3.13 колёс нет, поэтому полный разбор видео рассчитан на контейнер. Юнит-тесты математики MediaPipe не требуют.

Бэкенд с хоста, если есть Python 3.12 и скачанная модель:

```bash
python scripts/download_model.py
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Фронтенд:

```bash
cd frontend
npm install
npm run dev
```

Vite проксирует `/api` на `http://127.0.0.1:8000`. Интерфейс: http://localhost:5173. На localhost камера доступна и по HTTP.

Пороги качества — `config/settings.yaml`. Веса и формулировки замечаний — `data/profiles/footwork_v1.yaml`. Что именно измеряется — `docs/FEATURES.md`.

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
- Разбор не идёт в реальном времени: видео уходит на анализ после записи.
