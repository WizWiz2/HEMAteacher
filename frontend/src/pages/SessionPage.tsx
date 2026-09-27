import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteLocalSession, getLocalSession, getReference, type LocalReference, type LocalSession } from "../motion/storage";
import { normalizeSequence } from "../motion/normalize";
import { drawImageSkeleton, drawNormalizedSkeleton, fitCanvas, frameAt } from "../skeleton";
import type { AlignmentPair, ComparisonResult, PoseSequence, TimelineMarker } from "../types";

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
  const [session, setSession] = useState<LocalSession | null>(null);
  const [reference, setReference] = useState<LocalReference | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getLocalSession(id)
      .then(async (stored) => {
        if (!alive) return;
        if (!stored) throw new Error("Локальная попытка не найдена в этом браузере.");
        setSession(stored);
        setReference(await getReference(stored.movementId));
      })
      .catch((reason: Error) => alive && setError(reason.message));
    return () => { alive = false; };
  }, [id]);

  async function remove() {
    if (!confirm("Удалить эту локальную попытку?")) return;
    await deleteLocalSession(id);
    navigate("/analysis");
  }

  if (error) return <p className="error">{error}</p>;
  if (!session) return <p className="muted">Открываю локальную попытку…</p>;

  return (
    <main className="stack">
      <div>
        <span className="rubric">Browser-only session</span>
        <h1>Разбор попытки</h1>
        <p className="muted">Результат, поза и видео хранятся только в IndexedDB этого браузера.</p>
      </div>
      <ResultView session={session} reference={reference} />
      <div className="row">
        <Link className="button ghost" to={`/movements/${session.movementId}`}>К движению</Link>
        <button type="button" className="ghost" onClick={() => void remove()}>Удалить попытку</button>
      </div>
    </main>
  );
}

function ResultView({ session, reference }: { session: LocalSession; reference: LocalReference | null }) {
  const result = session.result;
  const attemptUrl = useMemo(() => URL.createObjectURL(session.video), [session.video]);
  const referenceUrl = useMemo(() => reference ? URL.createObjectURL(reference.video) : null, [reference]);
  const referenceNormalized = useMemo(() => reference ? normalizeSequence(reference.pose) : null, [reference]);
  useEffect(() => () => {
    URL.revokeObjectURL(attemptUrl);
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  }, [attemptUrl, referenceUrl]);

  if (!result.reliable) {
    return (
      <section className="callout">
        <h2>Не удалось надёжно проанализировать</h2>
        <p>{result.message}</p>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="feedback">
        {result.feedback.length === 0 && <p className="callout">Крупных расхождений с этой записью не найдено.</p>}
        {result.feedback.map((item) => (
          <article key={`${item.feature}-${item.phase_name}`} className={`note ${item.severity}`}>
            <p>{item.message}</p>
          </article>
        ))}
      </div>
      <div className="score manuscript-panel">
        <span>
          Схожесть с этой записью
          <br />
          <span className="muted">Не оценка техники и не рейтинг.</span>
        </span>
        <strong>{result.similarity?.toFixed(0) ?? "—"}</strong>
      </div>
      {reference && referenceUrl ? (
        <ComparisonPlayer
          referenceSrc={referenceUrl}
          attemptSrc={attemptUrl}
          referencePose={reference.pose}
          attemptPose={session.pose}
          referenceNorm={referenceNormalized}
          attemptNorm={session.normalizedPose}
          alignment={result.alignment}
          markers={result.timeline_markers}
        />
      ) : (
        <p className="callout">Эталон был удалён после анализа. Численный результат сохранился, но синхронное видео сравнить уже нельзя.</p>
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
      paint(refCanvas.current, refVideo.current, frameAt(referencePose, timeRef.current), "#8a3a23");
      paint(attCanvas.current, attVideo.current, frameAt(attemptPose, attemptMs), "#b8211b");
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
        <button type="button" className={mode === "split" ? "ghost active" : "ghost"} onClick={() => setMode("split")}>Рядом</button>
        <button
          type="button"
          className={mode === "overlay" ? "ghost active" : "ghost"}
          onClick={() => setMode("overlay")}
          disabled={!referenceNorm || !attemptNorm}
        >
          Наложение
        </button>
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
            <figcaption className="muted">Попытка</figcaption>
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
  const rows = Object.entries(result.metrics).flatMap(([feature, metric]) =>
    Object.entries(metric.phases).map(([phase, values]) => ({
      feature: metric.label || feature,
      phase: PHASE[phase] ?? phase,
      ...values,
      unit: metric.unit,
    })),
  );

  return (
    <details>
      <summary>Подробные измерения</summary>
      <p className="muted">
        Поза нашлась в {Math.round((result.quality.pose_detection_ratio ?? 0) * 100)}% кадров.
        DTW, признаки и feedback рассчитаны локально в браузере.
      </p>
      <table>
        <thead><tr><th>Признак</th><th>Фаза</th><th>Эталон</th><th>Попытка</th><th>Разница</th></tr></thead>
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
  return unit === "degrees" ? `${value.toFixed(0)}°` : value.toFixed(2);
}
function attemptTime(alignment: AlignmentPair[], referenceMs: number) {
  if (!alignment.length) return 0;
  let low=0,high=alignment.length-1;
  while(low<high){const mid=(low+high)>>1;if(alignment[mid].reference_time_ms<referenceMs)low=mid+1;else high=mid;}
  const next=alignment[low],prev=alignment[Math.max(0,low-1)];
  return Math.abs(prev.reference_time_ms-referenceMs)<=Math.abs(next.reference_time_ms-referenceMs)?prev.attempt_time_ms:next.attempt_time_ms;
}
function seek(video: HTMLVideoElement | null, seconds: number) {
  if (!video || !Number.isFinite(seconds) || video.readyState < 1) return;
  if (Math.abs(video.currentTime - seconds) > 0.045) video.currentTime = seconds;
}
function paint(canvas:HTMLCanvasElement|null,video:HTMLVideoElement|null,pose:ReturnType<typeof frameAt>,color:string){
  if(!canvas||!video)return;const fitted=fitCanvas(canvas);if(fitted)drawImageSkeleton(fitted.ctx,video,pose,color);
}
function paintOverlay(canvas:HTMLCanvasElement|null,reference:ReturnType<typeof frameAt>,attempt:ReturnType<typeof frameAt>){
  if(!canvas)return;const fitted=fitCanvas(canvas);if(!fitted)return;
  drawNormalizedSkeleton(fitted.ctx,fitted.width,fitted.height,reference,"#8a3a23",fitted.width*.5);
  drawNormalizedSkeleton(fitted.ctx,fitted.width,fitted.height,attempt,"#b8211b",fitted.width*.5);
}
