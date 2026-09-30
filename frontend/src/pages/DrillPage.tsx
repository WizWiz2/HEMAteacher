import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDrill } from "../api";
import { CheckpointStoryboard } from "../components/CheckpointStoryboard";
import { LiveFeedback } from "../components/LiveFeedback";
import { LivePoseCanvas } from "../components/LivePoseCanvas";
import { TargetPose } from "../components/TargetPose";
import { createDrillRuntime, stepDrill } from "../drill/drillEngine";
import { primaryCue } from "../drill/feedback";
import { targetPoseFor } from "../drill/posePresets";
import { personalizeDrill } from "../drill/personalize";
import { adaptDrillForCameraView } from "../drill/cameraView";
import type { Drill, DrillRuntime, WeaponMarkers } from "../drill/types";
import { matchWeaponAngle } from "../drill/weaponMatch";
import type { CameraView, Facing } from "../live/normalize";
import { BodyProfileCalibrator, profileCoverage, type BodyProfile } from "../live/anatomy";
import { clearBodyProfile, loadBodyProfile, saveBodyProfile } from "../live/bodyProfileStorage";
import { useCoachVoice } from "../live/useCoachVoice";
import { useLivePose, type LiveSample } from "../live/useLivePose";
import { DrillResultPage, formatElapsed } from "./DrillResultPage";

export function DrillPage() {
  const { id = "" } = useParams();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<DrillRuntime>(createDrillRuntime());
  const [facing, setFacing] = useState<Facing>("right");
  const [cameraView, setCameraView] = useState<CameraView>("side");
  const [mirrorPreview, setMirrorPreview] = useState(false);
  const [cameraExpanded, setCameraExpanded] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [bodyProfile, setBodyProfile] = useState<BodyProfile | null>(() => loadBodyProfile());
  const [targetGhostEnabled, setTargetGhostEnabled] = useState(true);
  const [weaponMarkersEnabled, setWeaponMarkersEnabled] = useState(false);
  const [framingMessage, setFramingMessage] = useState("ПОКАЖИСЬ КАМЕРЕ");
  const [framingReady, setFramingReady] = useState(false);
  const [weaponMarkers, setWeaponMarkers] = useState<WeaponMarkers | null>(null);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(0);

  const runtimeRef = useRef(runtime);
  const cameraPaneRef = useRef<HTMLDivElement>(null);
  const drillRef = useRef<Drill | null>(null);
  const bodyProfileRef = useRef(bodyProfile);
  const calibratorRef = useRef(new BodyProfileCalibrator());
  const profileRefinedRef = useRef(false);
  const qualitySince = useRef<number | null>(null);
  const lastFraming = useRef("");
  runtimeRef.current = runtime;
  bodyProfileRef.current = bodyProfile;

  useEffect(() => {
    getDrill(id)
      .then((value) => {
        setDrill(value);
        setRuntime(createDrillRuntime());
        setWeaponMarkersEnabled(false);
        calibratorRef.current.reset();
        profileRefinedRef.current = false;
        qualitySince.current = null;
      })
      .catch((reason: Error) => setError(reason.message));
  }, [id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!cameraExpanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [cameraExpanded]);

  const personalizedDrill = useMemo(() => personalizeDrill(drill, bodyProfile), [drill, bodyProfile]);
  const activeDrill = useMemo(
    () => adaptDrillForCameraView(personalizedDrill, cameraView),
    [personalizedDrill, cameraView],
  );
  drillRef.current = activeDrill;

  const checkpoint = activeDrill?.checkpoints[runtime.checkpointIndex];
  const smoothingMs = checkpoint?.smoothingMs ?? 100;
  const trackingMode = activeDrill?.trackingMode ?? "full_body";
  const activeWeaponTracking = cameraView === "side" && weaponMarkersEnabled ? activeDrill?.weaponTracking ?? "none" : "none";
  const targetPose = checkpoint?.targetPose ?? targetPoseFor(checkpoint?.targetPoseId);

  const live = useLivePose(
    facing,
    (sample) => onSample(sample),
    {
      smoothingMs,
      trackingMode,
      weaponTracking: activeWeaponTracking,
      targetPose,
      targetGhost: targetGhostEnabled,
      cameraView,
    },
  );

  useEffect(() => {
    if (!live.live) return;
    const facingMode = live.cameraFacingMode ?? live.requestedCamera;
    setMirrorPreview(facingMode === "user");
  }, [live.live, live.cameraFacingMode, live.requestedCamera]);

  function onSample(sample: LiveSample) {
    const current = drillRef.current;
    if (!current) return;

    if (sample.normalized && sample.framing.ready) {
      calibratorRef.current.push(sample.normalized);
      if (!profileRefinedRef.current && calibratorRef.current.ready(current.trackingMode ?? "full_body", 18)) {
        const nextProfile = calibratorRef.current.build(bodyProfileRef.current);
        if (nextProfile && profileCoverage(nextProfile, current.trackingMode ?? "full_body") >= 0.8) {
          bodyProfileRef.current = nextProfile;
          setBodyProfile(nextProfile);
          saveBodyProfile(nextProfile);
          profileRefinedRef.current = true;
        }
      }
    }

    if (sample.framing.message !== lastFraming.current) {
      lastFraming.current = sample.framing.message;
      setFramingMessage(sample.framing.message);
      setFramingReady(sample.framing.ready);
    }
    if (current.weaponTracking === "optional") setWeaponMarkers(sample.weapon);

    let next = runtimeRef.current;
    if (next.state === "calibrating") {
      const anatomyReady =
        profileRefinedRef.current &&
        profileCoverage(bodyProfileRef.current, current.trackingMode ?? "full_body") >= 0.8;
      if (sample.usable && anatomyReady) {
        qualitySince.current ??= sample.timeMs;
        if (sample.timeMs - qualitySince.current >= 450) {
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

  function changeCameraView(nextView: CameraView) {
    if (nextView === cameraView) return;
    setCameraView(nextView);
    setWeaponMarkersEnabled(false);
    calibratorRef.current.reset();
    profileRefinedRef.current = false;
    qualitySince.current = null;
    const next = createDrillRuntime();
    runtimeRef.current = next;
    setRuntime(next);
  }

  async function switchPhysicalCamera() {
    calibratorRef.current.reset();
    profileRefinedRef.current = false;
    qualitySince.current = null;
    const next = createDrillRuntime();
    runtimeRef.current = next;
    setRuntime(next);
    await live.switchCamera();
  }

  function retry() {
    const current = drillRef.current;
    if (!current) return;
    const next = stepDrill(runtimeRef.current, current, { type: "retry" });
    runtimeRef.current = next;
    setRuntime(next);
  }

  const anatomyCoverage = profileCoverage(bodyProfile, trackingMode);
  const anatomyReady = anatomyCoverage >= 0.8 && profileRefinedRef.current;

  function recalibrateBody() {
    clearBodyProfile();
    setBodyProfile(null);
    bodyProfileRef.current = null;
    calibratorRef.current.reset();
    profileRefinedRef.current = false;
    qualitySince.current = null;
    const next = createDrillRuntime();
    runtimeRef.current = next;
    setRuntime(next);
  }

  const weaponMatch = useMemo(
    () => cameraView === "side"
      ? matchWeaponAngle(weaponMarkersEnabled ? weaponMarkers : null, targetPose, facing)
      : { available: false, passed: false },
    [cameraView, weaponMarkersEnabled, weaponMarkers, targetPose, facing],
  );

  const cue = primaryCue(runtime.match);
  const calibrationMessage = runtime.state === "calibrating" && framingReady && !anatomyReady
    ? "ПОВТОРИ ПОЗУ НА СТЕНДЕ · ЗАДЕРЖИСЬ"
    : framingMessage;
  const spokenText = runtime.state === "completed"
    ? "Готово"
    : runtime.state === "calibrating" && (!framingReady || !anatomyReady)
      ? calibrationMessage
      : cue && !cue.ok
        ? cue.text
        : weaponMatch.available && !weaponMatch.passed
          ? "Поверни меч ближе к линии эталона"
          : null;
  useCoachVoice(spokenText, voiceEnabled);

  if (error) return <p className="error">{error}</p>;
  const elapsed = runtime.startedAt == null ? 0 : (runtime.finishedAt ?? now) - runtime.startedAt;
  const total = drill?.checkpoints.length ?? 0;

  return (
    <main className={`stack drill-shell ${flash ? "pulse" : ""}`}>
      {!drill && <p className="muted">Открываю упражнение…</p>}
      {drill && (
        <>
          <section className="drill-heading manuscript-panel">
            <div>
              <span className="rubric">{categoryTitle(drill.category)}</span>
              <h1 className={drill.category === "meisterhau" ? "latin-drill-title" : undefined}>{drill.name}</h1>
              <p>{drill.description}</p>
            </div>
            <div className="checkpoint-counter">
              <strong>{runtime.state === "completed" ? total : runtime.checkpointIndex + 1}</strong>
              <span>из {total}</span>
            </div>
          </section>

          <CheckpointStoryboard
            drill={drill}
            index={runtime.checkpointIndex}
            completed={runtime.state === "completed"}
            facing={facing}
            cameraView={cameraView}
          />

          <div className="training-controls">
            <div className="control-group">
              <span className="control-label">Ракурс анализа</span>
              <button type="button" className={cameraView === "side" ? "ghost active" : "ghost"} onClick={() => changeCameraView("side")}>Сбоку</button>
              <button type="button" className={cameraView === "front" ? "ghost active" : "ghost"} onClick={() => changeCameraView("front")}>Спереди</button>
            </div>
            {cameraView === "side" ? (
              <div className="control-group">
                <span className="control-label">Направление</span>
                <button type="button" className={facing === "left" ? "ghost active" : "ghost"} onClick={() => setFacing("left")}>Лицом ←</button>
                <button type="button" className={facing === "right" ? "ghost active" : "ghost"} onClick={() => setFacing("right")}>Лицом →</button>
              </div>
            ) : (
              <span className="view-reliability">Фронтальный режим · глубина оценивается мягче</span>
            )}
            <label className="toggle-control">
              <input type="checkbox" checked={mirrorPreview} onChange={(event) => setMirrorPreview(event.target.checked)} />
              <span>Зеркало</span>
            </label>
            <label className="toggle-control">
              <input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} />
              <span>Голосовые подсказки</span>
            </label>
            <label className="toggle-control">
              <input type="checkbox" checked={targetGhostEnabled} onChange={(event) => setTargetGhostEnabled(event.target.checked)} />
              <span>Эталон поверх меня</span>
            </label>
            <span className={anatomyReady ? "anatomy-chip ready" : "anatomy-chip"}>
              {anatomyReady
                ? "Твои пропорции ✓"
                : bodyProfile
                  ? "Уточняю пропорции…"
                  : `Калибровка тела ${Math.round(anatomyCoverage * 100)}%`}
            </span>
            <button type="button" className="ghost anatomy-reset" onClick={recalibrateBody}>Перекалибровать</button>
            {drill.weaponTracking === "optional" && cameraView === "side" && (
              <label className="toggle-control">
                <input
                  type="checkbox"
                  checked={weaponMarkersEnabled}
                  onChange={(event) => setWeaponMarkersEnabled(event.target.checked)}
                />
                <span>Видеть меч по меткам</span>
              </label>
            )}
          </div>

          {drill.unvalidated && (
            <p className="callout compact">Черновой учебный материал: checkpoint'ы и допуски ещё должен проверить тренер.</p>
          )}

          {weaponMarkersEnabled && drill.weaponTracking === "optional" && cameraView === "side" && (
            <div className="weapon-help manuscript-panel">
              <strong>Маркерный режим меча</strong>
              <span><i className="marker cyan" /> голубая/циановая лента у гарды</span>
              <span><i className="marker magenta" /> ярко-розовая лента ближе к острию</span>
              <span className={weaponMarkers?.detected ? "weapon-ok" : "weapon-adjust"}>
                {weaponMarkers?.detected ? "✓ обе метки найдены — линия клинка отслеживается" : "Метки пока не найдены"}
              </span>
            </div>
          )}

          <section className="drill-stage">
            <div ref={cameraPaneRef} className={`camera-pane ${cameraExpanded ? "camera-expanded" : ""}`}>
              <LivePoseCanvas videoRef={live.videoRef} canvasRef={live.canvasRef} mirrored={mirrorPreview} />
              <button
                type="button"
                className="camera-expand-button"
                onClick={() => setCameraExpanded((value) => !value)}
                aria-label={cameraExpanded ? "Свернуть камеру" : "Развернуть камеру на весь экран"}
              >
                {cameraExpanded ? "✕ Свернуть" : "⛶ На весь экран"}
              </button>
              {live.live && (
                <button
                  type="button"
                  className="camera-switch-button"
                  onClick={() => void switchPhysicalCamera()}
                  disabled={live.phase === "requesting" || live.phase === "loading"}
                  aria-label={(live.cameraFacingMode ?? live.requestedCamera) === "user" ? "Переключить на основную камеру" : "Переключить на селфи-камеру"}
                >
                  {live.cameraFacingMode === "user" || (!live.cameraFacingMode && live.requestedCamera === "user")
                    ? "↺ Основная"
                    : "↺ Селфи"}
                </button>
              )}
              {!live.live && (
                <div className="camera-start">
                  <button type="button" onClick={() => void live.start()} disabled={live.phase !== "idle"}>
                    {live.phase === "requesting" ? "Разреши доступ к камере…" : live.error ? "Повторить запуск" : "Включить камеру"}
                  </button>
                  {live.error && <p role="alert" className="camera-start-error">{live.error}</p>}
                  {live.error && <a className="camera-direct-link" href={window.location.href} target="_blank" rel="noopener noreferrer">Открыть сайт напрямую ↗</a>}
                </div>
              )}
              {live.live && live.phase === "loading" && <span className="camera-loading">Камера работает · загружаю распознавание позы…</span>}
              {checkpoint && (
                <div className="mobile-target-peek" aria-label="Эталон текущей позиции">
                  <TargetPose checkpoint={checkpoint} facing={facing} cameraView={cameraView} cue={cue} calibrating={runtime.state === "calibrating"} />
                </div>
              )}
              <div className="ghost-legend">
                <span><i className="ghost-swatch live" /> ты</span>
                <span><i className="ghost-swatch target" /> эталон</span>
              </div>
              <LiveFeedback
                match={runtime.match}
                enough={runtime.state !== "calibrating" && runtime.match != null}
                framingMessage={calibrationMessage}
                calibrating={runtime.state === "calibrating"}
                weapon={weaponMatch}
                completed={runtime.state === "completed"}
              />
              <div className="camera-status">
                <span>
                  {cameraView === "front" ? "Спереди" : "Сбоку"} · {trackingMode === "upper_body" ? "верх тела" : "всё тело"}
                  {live.live ? ` · ${(live.cameraFacingMode ?? live.requestedCamera) === "user" ? "селфи" : "основная камера"}` : ""}
                </span>
                <span className={runtime.state === "completed" || (framingReady && anatomyReady) ? "status-ok" : "status-warn"}>
                  {runtime.state === "completed" ? "УПРАЖНЕНИЕ · ГОТОВО" : calibrationMessage}
                </span>
              </div>
            </div>
            {checkpoint && (
              <div className="desktop-target-card">
                <TargetPose checkpoint={checkpoint} facing={facing} cameraView={cameraView} cue={cue} calibrating={runtime.state === "calibrating"} />
              </div>
            )}
          </section>

          <section className="drill-foot manuscript-panel">
            <div>
              <span className="rubric">Текущая точка</span>
              <strong>{checkpoint?.title ?? "—"}</strong>
              {checkpoint?.cue && <span className="target-cue">{checkpoint.cue}</span>}
            </div>
            <div className="metric">
              <span>условий проходит</span>
              <strong>{Math.round((runtime.match?.passScore ?? 0) * 100)}%</strong>
            </div>
            <div className="metric">
              <span>время</span>
              <strong>{formatElapsed(elapsed)}</strong>
            </div>
          </section>

          {runtime.state === "completed" && <DrillResultPage elapsedMs={elapsed} onRetry={retry} />}
          <Link className="muted back-link" to="/">← К упражнениям</Link>
        </>
      )}
    </main>
  );
}

function categoryTitle(category: Drill["category"]) {
  if (category === "meisterhau") return "Meisterhau";
  if (category === "guards") return "Стойки и позиции";
  return "Footwork";
}

function chime() {
  const audio = new AudioContext();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = 720;
  oscillator.connect(gain);
  gain.connect(audio.destination);
  gain.gain.setValueAtTime(0.05, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.16);
  window.setTimeout(() => void audio.close(), 300);
}
