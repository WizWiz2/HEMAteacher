import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDrill } from "../api";
import { CheckpointProgress } from "../components/CheckpointProgress";
import { LiveFeedback } from "../components/LiveFeedback";
import { LivePoseCanvas } from "../components/LivePoseCanvas";
import { TargetPose } from "../components/TargetPose";
import { createDrillRuntime, stepDrill } from "../drill/drillEngine";
import type { Drill, DrillRuntime } from "../drill/types";
import type { Facing } from "../live/normalize";
import { useLivePose, type LiveSample } from "../live/useLivePose";
import { DrillResultPage, formatElapsed } from "./DrillResultPage";

export function DrillPage() {
  const { id = "" } = useParams();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<DrillRuntime>(createDrillRuntime());
  const [facing, setFacing] = useState<Facing>("right");
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(0);
  const runtimeRef = useRef(runtime);
  const drillRef = useRef(drill);
  const qualitySince = useRef<number | null>(null);
  runtimeRef.current = runtime;
  drillRef.current = drill;

  useEffect(() => {
    getDrill(id).then(setDrill).catch((reason: Error) => setError(reason.message));
  }, [id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(timer);
  }, []);

  const live = useLivePose(facing, (sample) => onSample(sample));

  function onSample(sample: LiveSample) {
    const current = drillRef.current;
    if (!current) return;
    let next = runtimeRef.current;
    if (next.state === "calibrating") {
      if (sample.usable) {
        qualitySince.current ??= sample.timeMs;
        if (sample.timeMs - qualitySince.current >= 300) {
          next = stepDrill(next, current, { type: "quality", ok: true });
        }
      } else {
        qualitySince.current = null;
      }
    }
    if (next.state === "ready" || next.state === "running") {
      const beforeIndex = next.checkpointIndex;
      const beforeState = next.state;
      next = stepDrill(next, current, {
        type: "sample",
        timeMs: sample.timeMs,
        features: sample.smoothed,
        enoughSamples: sample.enough,
      });
      if (next.checkpointIndex !== beforeIndex || (beforeState !== next.state && next.state === "completed")) {
        chime();
        setFlash(true);
        window.setTimeout(() => setFlash(false), 350);
      }
    }
    runtimeRef.current = next;
    setRuntime(next);
  }

  function retry() {
    if (!drill) return;
    const next = stepDrill(runtimeRef.current, drill, { type: "retry" });
    runtimeRef.current = next;
    setRuntime(next);
  }

  if (error) return <p className="error">{error}</p>;
  const checkpoint = drill?.checkpoints[runtime.checkpointIndex];
  const elapsed = runtime.startedAt == null ? 0 : (runtime.finishedAt ?? now) - runtime.startedAt;
  const total = drill?.checkpoints.length ?? 0;

  return (
    <main className={`stack drill-shell ${flash ? "pulse" : ""}`}>
      {!drill && <p className="muted">Открываю упражнение…</p>}
      {drill && (
        <div className="card-top">
          <h1>{drill.name}</h1>
          <span className="badge">
            {runtime.state === "completed" ? total : runtime.checkpointIndex + 1} / {total}
          </span>
        </div>
      )}
      {drill?.unvalidated && (
        <p className="callout">Черновик. Числа и картинки не проверены тренером и не описывают правильную технику.</p>
      )}
      <div className="row">
        <button type="button" className={facing === "left" ? "ghost active" : "ghost"} onClick={() => setFacing("left")}>
          Лицом ←
        </button>
        <button type="button" className={facing === "right" ? "ghost active" : "ghost"} onClick={() => setFacing("right")}>
          Лицом →
        </button>
      </div>
      <div className="drill-stage">
        <LivePoseCanvas videoRef={live.videoRef} canvasRef={live.canvasRef} />
        {checkpoint && <TargetPose title={checkpoint.title} illustrationUrl={checkpoint.illustrationUrl} />}
      </div>
      {live.error && <p className="error">{live.error}</p>}
      {runtime.state === "calibrating" && (
        <p className="cue wait">Встань боком: в кадре голова и обе стопы. Телефон не двигай.</p>
      )}
      <p className="confidence" aria-label="Совпадение с контрольной точкой">
        {Math.round((runtime.match?.confidence ?? 0) * 100)}%
      </p>
      <LiveFeedback match={runtime.match} enough={runtime.state !== "calibrating" && (runtime.match != null)} />
      {drill && (
        <CheckpointProgress
          count={drill.checkpoints.length}
          index={runtime.checkpointIndex}
          completed={runtime.state === "completed"}
        />
      )}
      <p className="elapsed">{formatElapsed(elapsed)}</p>
      {runtime.state === "completed" && <DrillResultPage elapsedMs={elapsed} onRetry={retry} />}
      <Link className="muted" to="/">К списку</Link>
    </main>
  );
}

function chime() {
  const audio = new AudioContext();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = 660;
  oscillator.connect(gain);
  gain.connect(audio.destination);
  gain.gain.setValueAtTime(0.04, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.12);
  window.setTimeout(() => void audio.close(), 300);
}
