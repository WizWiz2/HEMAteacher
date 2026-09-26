import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteSession, getPose, getResult, getSession } from "../api";
import { drawImageSkeleton, drawNormalizedSkeleton, fitCanvas, frameAt } from "../skeleton";
import type { AlignmentPair, ComparisonResult, PoseSequence, SessionInfo, TimelineMarker } from "../types";

const STAGES: Array<[string, string]> = [
  ["uploaded", "Видео получено"],
  ["extracting_pose", "Считываем положение тела"],
  ["normalizing", "Приводим скелет к одному масштабу"],
  ["aligning", "Сопоставляем фазы шага"],
  ["analyzing", "Считаем различия"],
];

const PHASE: Record<string, string> = {
  preparation: "начало",
  stride: "середина шага",
  landing: "приземление",
  completion: "завершение",
  overall: "весь шаг",
};

export function SessionPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    async function poll() {
      try {
        const info = await getSession(id);
        if (stop) return;
        setSession(info);
        if (info.status === "completed") {
          setResult(await getResult(id));
          return;
        }
        if (info.status === "failed") return;
        timer = window.setTimeout(poll, 1000);
      } catch (reason) {
        if (!stop) setError(reason instanceof Error ? reason.message : "Не удалось получить статус");
      }
    }
    void poll();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [id]);

  async function remove() {
    if (!confirm("Удалить эту попытку с диска?")) return;
    await deleteSession(id);
    navigate("/");
  }

  if (error) return <p className="error">{error}</p>;
  if (!session) return <p className="muted">Открываю попытку…</p>;

  return (
    <main className="stack">
      {session.status !== "completed" && session.status !== "failed" && (
        <section className="stack">
          <h1>Разбираю попытку</h1>
          <ol className="checklist">
            {STAGES.map(([key, label]) => (
              <li key={key}>{label}{session.status === key ? "…" : ""}</li>
            ))}
          </ol>
        </section>
      )}
      {session.status === "failed" && (
        <section className="callout">
          <h1>Не удалось разобрать</h1>
          <p>{session.error_reason}</p>
        </section>
      )}
      {result && <ResultView result={result} />}
      <div className="row">
        {session.movement_id && <Link className="button ghost" to={`/movements/${session.movement_id}`}>К движению</Link>}
        <button type="button" className="ghost" onClick={() => void remove()}>Удалить попытку</button>
      </div>
    </main>
  );
}

function ResultView({ result }: { result: ComparisonResult }) {
  const [referencePose, setReferencePose] = useState<PoseSequence | null>(null);
  const [attemptPose, setAttemptPose] = useState<PoseSequence | null>(null);
  const [referenceNorm, setReferenceNorm] = useState<PoseSequence | null>(null);
  const [attemptNorm, setAttemptNorm] = useState<PoseSequence | null>(null);

  useEffect(() => {
    let alive = true;
    async function load(url: string | undefined, space: string) {
      if (!url) return null;
      try {
        return await getPose(space === "image" ? url : `${url}?space=${space}`);
      } catch {
        return null;
      }
    }
    void Promise.all([
      load(result.reference_pose_url, "image"),
      load(result.attempt_pose_url, "image"),
      load(result.reference_pose_url, "normalized"),
      load(result.attempt_pose_url, "normalized"),
    ]).then(([refImage, attImage, refNorm, attNorm]) => {
      if (!alive) return;
      setReferencePose(refImage);
      setAttemptPose(attImage);
      setReferenceNorm(refNorm);
      setAttemptNorm(attNorm);
    });
    return () => {
      alive = false;
    };
  }, [result]);

  if (!result.reliable) {
    return (
      <section className="callout">
        <h1>Не удалось надёжно проанализировать</h1>
        <p>{result.message}</p>
      </section>
    );
  }

  return (
    <section className="stack">
      <div>
        <h1>Что отличается от эталона</h1>
        {result.message && <p className="lede">{result.message}</p>}
      </div>
      <div className="feedback">
        {result.feedback.map((item) => (
          <article key={`${item.feature}-${item.phase_name}`} className={`note ${item.severity}`}>
            <p>{item.message}</p>
          </article>
        ))}
      </div>
      <div className="score">
        <span>
          Схожесть с этой записью
          <br />
          <span className="muted">Не оценка техники и не рейтинг.</span>
        </span>
        <strong>{result.similarity?.toFixed(0)}</strong>
      </div>
      {result.reference_video_url && result.attempt_video_url && (
        <ComparisonPlayer
          referenceSrc={result.reference_video_url}
          attemptSrc={result.attempt_video_url}
          referencePose={referencePose}
          attemptPose={attemptPose}
          referenceNorm={referenceNorm}
          attemptNorm={attemptNorm}
          alignment={result.alignment}
          markers={result.timeline_markers}
        />
      )}
      <Diagnostics result={result} />
    </section>
  );
}

function ComparisonPlayer({
  referenceSrc,
  attemptSrc,
  referencePose,
  attemptPose,
  referenceNorm,
  attemptNorm,
  alignment,
  markers,
}: {
  referenceSrc: string;
  attemptSrc: string;
  referencePose: PoseSequence | null;
  attemptPose: PoseSequence | null;
  referenceNorm: PoseSequence | null;
  attemptNorm: PoseSequence | null;
  alignment: AlignmentPair[];
  markers: TimelineMarker[];
}) {
  const refVideo = useRef<HTMLVideoElement>(null);
  const attVideo = useRef<HTMLVideoElement>(null);
  const refCanvas = useRef<HTMLCanvasElement>(null);
  const attCanvas = useRef<HTMLCanvasElement>(null);
  const overlayCanvas = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const [uiTime, setUiTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<"split" | "overlay">("split");
  const duration = alignment.length ? alignment[alignment.length - 1].reference_time_ms : referencePose?.duration_ms ?? 1000;

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (playingRef.current) {
        timeRef.current = Math.min(duration, timeRef.current + dt * speedRef.current * 1000);
        if (timeRef.current >= duration) {
          playingRef.current = false;
          setPlaying(false);
        }
      }
      const attemptMs = attemptTime(alignment, timeRef.current);
      seek(refVideo.current, timeRef.current / 1000);
      seek(attVideo.current, attemptMs / 1000);
      paint(refCanvas.current, refVideo.current, frameAt(referencePose, timeRef.current), "#e2c48a");
      paint(attCanvas.current, attVideo.current, frameAt(attemptPose, attemptMs), "#8eb7d6");
      paintOverlay(overlayCanvas.current, frameAt(referenceNorm, timeRef.current), frameAt(attemptNorm, attemptMs));
      if (now - lastUi > 80) {
        lastUi = now;
        setUiTime(timeRef.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [alignment, attemptNorm, attemptPose, duration, referenceNorm, referencePose]);

  function scrub(position: number) {
    timeRef.current = position * duration;
    setUiTime(timeRef.current);
  }

  return (
    <div className="stack">
      <div className="row">
        <button type="button" onClick={() => { playingRef.current = !playingRef.current; setPlaying(playingRef.current); }}>
          {playing ? "Пауза" : "Смотреть"}
        </button>
        {[0.25, 0.5, 1].map((value) => (
          <button
            key={value}
            type="button"
            className={speed === value ? "ghost active" : "ghost"}
            onClick={() => { speedRef.current = value; setSpeed(value); }}
          >
            {value}×
          </button>
        ))}
        <button type="button" className={mode === "split" ? "ghost active" : "ghost"} onClick={() => setMode("split")}>
          Рядом
        </button>
        <button
          type="button"
          className={mode === "overlay" ? "ghost active" : "ghost"}
          onClick={() => setMode("overlay")}
          disabled={!referenceNorm || !attemptNorm}
        >
          Наложение
        </button>
      </div>
      <div className="legend">
        <span><i className="swatch ref" /> эталон</span>
        <span><i className="swatch you" /> попытка</span>
      </div>
      {mode === "split" ? (
        <div className="stage-grid split">
          <figure className="stack">
            <div className="video-wrap">
              <video ref={refVideo} src={referenceSrc} playsInline muted preload="auto" />
              <canvas ref={refCanvas} className="overlay" />
            </div>
            <figcaption className="muted">Эталон</figcaption>
          </figure>
          <figure className="stack">
            <div className="video-wrap">
              <video ref={attVideo} src={attemptSrc} playsInline muted preload="auto" />
              <canvas ref={attCanvas} className="overlay" />
            </div>
            <figcaption className="muted">Ваша попытка</figcaption>
          </figure>
        </div>
      ) : (
        <canvas ref={overlayCanvas} className="overlay-board" />
      )}
      <div className="timeline">
        {markers.map((marker, index) => (
          <button
            key={`${marker.reference_time_ms}-${index}`}
            type="button"
            className={`mark ${marker.severity}`}
            style={{ left: `${Math.min(100, Math.max(0, marker.position * 100))}%` }}
            aria-label={marker.feature}
            onClick={() => scrub(marker.position)}
          />
        ))}
        <input
          type="range"
          min={0}
          max={1000}
          value={duration ? Math.round((uiTime / duration) * 1000) : 0}
          aria-label="Фаза движения"
          onChange={(event) => scrub(Number(event.target.value) / 1000)}
        />
      </div>
    </div>
  );
}

function Diagnostics({ result }: { result: ComparisonResult }) {
  const rows = Object.entries(result.metrics).flatMap(([feature, metric]) => {
    if (!metric || typeof metric !== "object" || !("phases" in metric)) return [];
    return Object.entries(metric.phases).map(([phase, values]) => ({
      feature: metric.label || feature,
      phase: PHASE[phase] ?? phase,
      ...values,
      unit: metric.unit,
    }));
  });
  return (
    <details>
      <summary>Подробные измерения</summary>
      <p className="muted">
        Поза нашлась в {Math.round((result.quality.pose_detection_ratio ?? 0) * 100)}% кадров.
        Числа — в длинах корпуса или в градусах, ноль таза совмещён у обеих записей.
      </p>
      <table>
        <thead>
          <tr>
            <th>Признак</th>
            <th>Фаза</th>
            <th>Эталон</th>
            <th>Попытка</th>
            <th>Разница</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.feature}-${row.phase}`}>
              <td>{row.feature}</td>
              <td>{row.phase}</td>
              <td>{formatMetric(row.reference, row.unit)}</td>
              <td>{formatMetric(row.attempt, row.unit)}</td>
              <td>{formatMetric(row.delta, row.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function formatMetric(value: number, unit: string) {
  if (!Number.isFinite(value)) return "—";
  if (unit === "degrees") return `${value.toFixed(0)}°`;
  return value.toFixed(2);
}

function attemptTime(alignment: AlignmentPair[], referenceMs: number) {
  if (alignment.length === 0) return 0;
  let low = 0;
  let high = alignment.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (alignment[mid].reference_time_ms < referenceMs) low = mid + 1;
    else high = mid;
  }
  const next = alignment[low];
  const prev = alignment[Math.max(0, low - 1)];
  return Math.abs(prev.reference_time_ms - referenceMs) <= Math.abs(next.reference_time_ms - referenceMs)
    ? prev.attempt_time_ms
    : next.attempt_time_ms;
}

function seek(video: HTMLVideoElement | null, seconds: number) {
  if (!video || !Number.isFinite(seconds)) return;
  if (video.readyState < 1) return;
  if (Math.abs(video.currentTime - seconds) > 0.045) video.currentTime = seconds;
}

function paint(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
  pose: ReturnType<typeof frameAt>,
  color: string,
) {
  if (!canvas || !video) return;
  const fitted = fitCanvas(canvas);
  if (!fitted) return;
  drawImageSkeleton(fitted.ctx, video, pose, color);
}

function paintOverlay(
  canvas: HTMLCanvasElement | null,
  reference: ReturnType<typeof frameAt>,
  attempt: ReturnType<typeof frameAt>,
) {
  if (!canvas) return;
  const fitted = fitCanvas(canvas);
  if (!fitted) return;
  drawNormalizedSkeleton(fitted.ctx, fitted.width, fitted.height, reference, "#e2c48a", fitted.width * 0.5);
  drawNormalizedSkeleton(fitted.ctx, fitted.width, fitted.height, attempt, "#8eb7d6", fitted.width * 0.5);
}
