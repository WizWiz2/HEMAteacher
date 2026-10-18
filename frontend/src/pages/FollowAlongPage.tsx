import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DRILL_NAMES, type MotionView } from "../drill/continuousMotion";
import { useLivePose, type LiveSample } from "../live/useLivePose";
import type { RawPose } from "../live/landmarks";
import type { Facing } from "../live/normalize";
import { RepCounter, summarize, type CounterPhase, type FollowRep, type FollowSummary } from "../follow/repCounter";
import { REFERENCE_STYLE, drawSkeleton, loadReferences, loopProgress, placePose, poseAt, referenceKey, type ReferenceClip, type ReferenceSet } from "../follow/reference";
import { bodyAnchor, containBox, followAnchor, placeGhost, type GhostAnchor } from "../follow/ghostAlign";
import "../follow/follow.css";

const STRIKES = ["zornhau", "zwerchhau", "schielhau", "scheitelhau", "krumphau"];
const STEPS = ["advance", "retreat", "passing-step-forward", "passing-step-backward"];
const TEMPOS = [{value: 0.5, label: "Медленно · ½"}, {value: 0.75, label: "Спокойно · ¾"}, {value: 1, label: "Как у эталона"}];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pluralRules = new Intl.PluralRules("ru");
function repsLabel(n: number) {
  const form = pluralRules.select(n);
  return `${n} ${form === "one" ? "повтор" : form === "few" ? "повтора" : "повторов"}`;
}

export function FollowAlongPage() {
  const [drill, setDrill] = useState("zornhau");
  const [view, setView] = useState<MotionView>("front");
  const [facing, setFacing] = useState<Facing>("right");
  const [tempo, setTempo] = useState(0.75);
  const [ghost, setGhost] = useState(true);
  const [sound, setSound] = useState(true);
  const [refs, setRefs] = useState<ReferenceSet | null>(null);
  const [session, setSession] = useState<"idle" | "running" | "done">("idle");
  const [reps, setReps] = useState<FollowRep[]>([]);
  const [phase, setPhase] = useState<CounterPhase>("waiting");
  const [framing, setFraming] = useState("");
  const [summary, setSummary] = useState<FollowSummary | null>(null);
  const [flash, setFlash] = useState(0);

  const counter = useRef<RepCounter>(new RepCounter(drill, view));
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const lastRaw = useRef<RawPose | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const refCanvas = useRef<HTMLCanvasElement>(null);
  const ghostCanvas = useRef<HTMLCanvasElement>(null);
  const startedAt = useRef(performance.now());
  const anchor = useRef<GhostAnchor | null>(null);
  const settings = useRef({drill, view, tempo, ghost, facing, sound});
  settings.current = {drill, view, tempo, ghost, facing, sound};

  useEffect(() => {void loadReferences().then(setRefs);}, []);
  useEffect(() => {
    counter.current = new RepCounter(drill, view);
    startedAt.current = performance.now();
    setReps([]); setSummary(null); setPhase("waiting");
    setSession(s => (s === "running" ? "running" : "idle"));
  }, [drill, view]);

  const clip: ReferenceClip | null = refs?.clips[referenceKey(view, drill)] ?? null;
  // Fit the whole loop (steps travel) into the reference panel.
  const bounds = useMemo(() => {
    if (!clip || !refs) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const f of clip.frames) for (let k = 0; k < refs.joints.length; k++) {
      const x = f[2 * k], y = f[2 * k + 1];
      if (x === null || y === null) continue;
      x0 = Math.min(x0, x / 1000); x1 = Math.max(x1, x / 1000); y0 = Math.min(y0, y / 1000); y1 = Math.max(y1, y / 1000);
    }
    return {x0, x1, y0: y0 - 0.25, y1};
  }, [clip, refs]);

  const beep = useCallback(() => {
    if (!settings.current.sound || !audio.current) return;
    const ctx = audio.current, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 784;
    gain.gain.setValueAtTime(.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .15);
    osc.start(); osc.stop(ctx.currentTime + .16);
  }, []);

  const onSample = useCallback((sample: LiveSample) => {
    lastRaw.current = sample.raw;
    const f = sample.motionFraming ?? sample.framing;
    setFraming(prev => (prev === f.message ? prev : f.message));
    const usable = sample.motionUsable ?? sample.usable;
    const rep = counter.current.push({timeMs: sample.timeMs, features: usable ? sample.features : null});
    setPhase(prev => (prev === counter.current.phase ? prev : counter.current.phase));
    if (rep && sessionRef.current === "running") {
      setReps([...counter.current.reps]);
      setFlash(n => n + 1);
      beep();
    }
  }, [beep]);

  const live = useLivePose(view === "front" ? "right" : facing, onSample, {cameraView: view, trackingMode: "full_body", targetGhost: false});
  const mirrored = live.live && (live.cameraFacingMode ?? live.requestedCamera) === "user";
  const mirroredRef = useRef(mirrored);
  mirroredRef.current = mirrored;

  // Animation: the reference panel and the ghost over the camera share one clock.
  useEffect(() => {
    let id = 0;
    const frame = () => {
      id = requestAnimationFrame(frame);
      if (!refs || !clip) return;
      const s = settings.current;
      const elapsed = performance.now() - startedAt.current;
      const pose = poseAt(refs, clip, elapsed, s.tempo);
      const flip = s.view === "side" && s.facing === "left";
      const rc = refCanvas.current;
      if (rc && bounds) {
        const ctx = prepare(rc);
        if (ctx) {
          const {w, h} = ctx;
          const scale = Math.min(w / ((bounds.x1 - bounds.x0) * 1.25), h / ((bounds.y1 - bounds.y0) * 1.15));
          const cx = w / 2 - (flip ? -1 : 1) * (bounds.x0 + bounds.x1) / 2 * scale, cy = h / 2 - (bounds.y0 + bounds.y1) / 2 * scale;
          drawFloor(ctx.ctx, w, cy + bounds.y1 * scale);
          drawSkeleton(ctx.ctx, placePose(pose, [cx, cy], scale, flip), REFERENCE_STYLE);
          const p = loopProgress(clip, elapsed, s.tempo);
          ctx.ctx.fillStyle = "rgba(143, 37, 29, .85)";
          ctx.ctx.fillRect(0, h - 5, w * p, 5);
        }
      }
      const gc = ghostCanvas.current, video = live.videoRef.current, raw = lastRaw.current;
      if (gc) {
        const ctx = prepare(gc);
        if (ctx && s.ghost && video && raw) {
          const box = containBox(video.clientWidth, video.clientHeight, video.videoWidth, video.videoHeight);
          // Anchor on the user's hip centre and torso, updated once per pose sample and smoothed by pose time.
          const body = bodyAnchor(raw.landmarks, box, raw.timestampMs);
          if (body && body.t !== anchor.current?.t) anchor.current = followAnchor(anchor.current, body);
          if (body && anchor.current) drawSkeleton(ctx.ctx, placeGhost(pose, anchor.current, flip), {...REFERENCE_STYLE, width: 2.4});
        }
      }
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [refs, clip, bounds, live.videoRef]);

  function startSession() {
    if (sound) {audio.current ??= new AudioContext(); void audio.current.resume();}
    counter.current.reset();
    setReps([]); setSummary(null); setSession("running");
  }
  function finishSession() {
    setSummary(summarize(reps));
    setSession("done");
  }

  const last = reps.at(-1);
  const status = session === "done" ? "Подход завершён"
    : !live.live ? "Включи камеру и встань в полный рост"
    : live.phase !== "ready" ? "Загружаю распознавание…"
    : phase === "waiting" ? (STRIKES.includes(drill) ? "Встань в стойку и замри на секунду" : "Встань в стойку и замри")
    : phase === "moving" ? "Движение…"
    : session === "running" ? "Повторяй за эталоном" : "Готов. Нажми «Начать подход»";
  const drillName = (id: string) => capital(DRILL_NAMES[id] ?? id);

  return <main className="stack follow-page">
    <section className="manuscript-panel follow-heading">
      <span className="rubric">Nachmachen · за мастером</span>
      <h1>Повторяй за эталоном</h1>
      <p>Слева движение мастера по кругу, справа ты. Приложение считает повторы и показывает, насколько траектория рук и ног близка к эталону.</p>
      <Link to="/">← К упражнениям</Link>
    </section>

    <section className="follow-picker" aria-label="Упражнение">
      <div><span className="control-label">Удары</span>
        <div className="follow-drills">{STRIKES.map(id => <button key={id} type="button" aria-pressed={drill === id} className={drill === id ? "active" : "ghost"} onClick={() => setDrill(id)}>{drillName(id)}</button>)}</div></div>
      <div><span className="control-label">Шаги</span>
        <div className="follow-drills">{STEPS.map(id => <button key={id} type="button" aria-pressed={drill === id} className={drill === id ? "active" : "ghost"} onClick={() => setDrill(id)}>{drillName(id)}</button>)}</div></div>
    </section>

    <section className="follow-stage">
      <figure className="manuscript-panel follow-reference">
        <div className="follow-pane-top"><span className="rubric">Эталон · {drillName(drill)}</span><span className="badge">{TEMPOS.find(t => t.value === tempo)?.label}</span></div>
        <canvas ref={refCanvas} className={`follow-reference-canvas ${mirrored ? "follow-mirrored" : ""}`} aria-label={`Анимация эталона: ${drillName(drill)}`} role="img" />
        <figcaption>{refs ? clip ? "Петля: стойка → движение → возврат" : "Для этого вида нет эталона" : "Загружаю эталон…"}</figcaption>
      </figure>
      <div className="follow-camera">
        <div className="camera-pane">
          <div className={`video-wrap live-frame ${mirrored ? "preview-mirrored" : ""}`}>
            <video ref={live.videoRef} playsInline muted autoPlay />
            <canvas ref={ghostCanvas} className="overlay" />
            <canvas ref={live.canvasRef} className="overlay" />
          </div>
          {live.live && ghost && <div className="ghost-legend"><span><i className="ghost-swatch live" />ты</span><span><i className="ghost-swatch target" />эталон</span></div>}
          {flash > 0 && last && <div key={flash} className="follow-rep-flash" aria-hidden="true">{last.index}</div>}
        </div>
        <div className="follow-camera-controls">
          {!live.live ? <button type="button" disabled={live.phase !== "idle"} onClick={() => void live.start("user")}>{live.phase === "requesting" ? "Разреши доступ…" : "Включить камеру"}</button>
            : <button type="button" className="ghost" disabled={live.phase !== "ready"} onClick={() => void live.switchCamera()}>Переключить камеру</button>}
          <span className="follow-framing" role="status">{live.error || (live.live && live.phase === "ready" ? framing : "")}</span>
        </div>
      </div>
    </section>

    <section className="manuscript-panel follow-board">
      <div className="follow-count"><span className="control-label">Повторы</span><strong>{reps.length}</strong></div>
      <div className="follow-last">
        <div className="follow-status" role="status">{status}</div>
        {last ? <>
          <div className="follow-score"><span>Сходство с эталоном</span><strong>{last.similarity}</strong><span>/ 100</span></div>
          <div className="follow-meter" aria-hidden="true"><i style={{width: `${last.similarity}%`}} /></div>
          {last.hint && <p className="follow-hint">{last.hint}</p>}
        </> : <p className="follow-hint">{session === "running" ? "Каждое завершённое движение с возвратом в стойку — один повтор." : "Сходство появится после первого повтора."}</p>}
        {reps.length > 1 && <ol className="follow-history" aria-label="Последние повторы">{reps.slice(-8).map(r => <li key={r.index} title={`Повтор ${r.index}`}>{r.similarity}</li>)}</ol>}
      </div>
      <div className="follow-actions">
        {session !== "running" ? <button type="button" onClick={startSession} disabled={!live.live || live.phase !== "ready"}>{session === "done" ? "Ещё подход" : "Начать подход"}</button>
          : <button type="button" onClick={finishSession}>Завершить подход</button>}
      </div>
      {session === "done" && summary && <div className="meyer-result follow-summary">
        <strong>{summary.reps ? `${drillName(drill)}: ${repsLabel(summary.reps)}` : "Повторов не засчитано"}</strong>
        {summary.averageSimilarity !== null && <span>Среднее сходство с эталоном: {summary.averageSimilarity} из 100 · лучший повтор: {summary.best}</span>}
        {summary.consistency !== null && <span>Стабильность (насколько повторы похожи друг на друга): {summary.consistency} из 100</span>}
        {summary.hints.map(h => <span key={h}>Чаще всего: {h.charAt(0).toLowerCase() + h.slice(1)}</span>)}
      </div>}
    </section>

    <section className="manuscript-panel follow-settings">
      <div className="follow-toggle-group" role="group" aria-label="Камера">
        <span className="control-label">Камера</span>
        <button type="button" className={view === "front" ? "ghost active" : "ghost"} onClick={() => setView("front")}>Спереди</button>
        <button type="button" className={view === "side" ? "ghost active" : "ghost"} onClick={() => setView("side")}>Сбоку</button>
        {view === "side" && <button type="button" className="ghost" onClick={() => setFacing(facing === "right" ? "left" : "right")}>{facing === "right" ? "Лицом вправо" : "Лицом влево"}</button>}
      </div>
      <label>Темп эталона <select value={tempo} onChange={e => setTempo(Number(e.target.value))}>
        {TEMPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select></label>
      <label className="toggle-control"><input type="checkbox" checked={ghost} onChange={e => setGhost(e.target.checked)} /> Эталон поверх камеры</label>
      <label className="toggle-control"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /> Звук на повтор</label>
    </section>

    <details className="meyer-about"><summary>Как считается</summary>
      <p>Повтор — это выход из стойки и возврат в неё (для ударов) или законченный шаг (для шагов). Сходство — расстояние между траекторией твоих кистей и стоп и эталонными повторами этого упражнения: 100 — совпадает, около 50 — заметно отличается. Сходство не определяет, какой именно удар ты сделал, и не проверяет клинок. Лучше всего камера видит, когда ты стоишь к ней лицом или вполоборота, целиком в кадре.</p>
    </details>
  </main>;
}

function prepare(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);}
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return {ctx, w, h};
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, y: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(80, 55, 36, .35)"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(w * .08, y + 6); ctx.lineTo(w * .92, y + 6); ctx.stroke();
  ctx.restore();
}

