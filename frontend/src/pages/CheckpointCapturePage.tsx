import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LivePoseCanvas } from "../components/LivePoseCanvas";
import { LIVE_FEATURES } from "../live/features";
import type { Facing } from "../live/normalize";
import { useLivePose, type LiveSample } from "../live/useLivePose";

export function CheckpointCapturePage() {
  const [facing, setFacing] = useState<Facing>("right");
  const [sample, setSample] = useState<LiveSample | null>(null);
  const [mirrorPreview, setMirrorPreview] = useState(false);
  const latest = useRef<LiveSample | null>(null);

  const live = useLivePose(facing, (next) => {
    latest.current = next;
    setSample((previous) => !previous || next.timeMs - previous.timeMs > 100 ? next : previous);
  });

  useEffect(() => {
    if (!live.live) return;
    const facingMode = live.cameraFacingMode ?? live.requestedCamera;
    setMirrorPreview(facingMode === "user");
  }, [live.live, live.cameraFacingMode, live.requestedCamera]);

  function capture() {
    const current = latest.current;
    if (!current?.normalized) return;
    const payload = {
      note: "Черновик для targetPose. Значения должен проверить тренер.",
      targetPose: { landmarks: current.normalized.landmarks },
      capturedFeatures: current.smoothed ?? current.features,
      suggestedFeatureTolerances: {
        foot_distance: 0.25,
        pelvis_height: 0.22,
        torso_angle: 15,
        hand_center_x: 0.28,
        hand_center_y: 0.24,
        hand_distance: 0.22,
        left_elbow_angle: 32,
        right_elbow_angle: 32,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "checkpoint-target.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function switchPhysicalCamera() {
    latest.current = null;
    setSample(null);
    await live.switchCamera();
  }

  const features = sample?.smoothed ?? sample?.features;
  const currentCamera = live.cameraFacingMode ?? live.requestedCamera;

  return (
    <main className="stack checkpoint-capture-page">
      <div>
        <h1>Снять контрольную точку</h1>
        <p className="lede">Камера, скелет и текущие признаки. Экспорт сразу пригоден как machine target.</p>
      </div>

      <div className="training-controls">
        <div className="control-group">
          <span className="control-label">Направление</span>
          <button type="button" className={facing === "left" ? "ghost active" : "ghost"} onClick={() => setFacing("left")}>Лицом ←</button>
          <button type="button" className={facing === "right" ? "ghost active" : "ghost"} onClick={() => setFacing("right")}>Лицом →</button>
        </div>
        <label className="toggle-control">
          <input type="checkbox" checked={mirrorPreview} onChange={(event) => setMirrorPreview(event.target.checked)} />
          <span>Зеркало</span>
        </label>
      </div>

      <div className="camera-pane checkpoint-capture-camera">
        <LivePoseCanvas videoRef={live.videoRef} canvasRef={live.canvasRef} mirrored={mirrorPreview} />

        {!live.live && (
          <div className="camera-start">
            <button type="button" onClick={() => void live.start()} disabled={live.phase !== "idle"}>
              {live.phase === "requesting"
                ? "Разреши доступ к камере…"
                : live.error
                  ? "Повторить запуск"
                  : "Включить камеру"}
            </button>
            {live.error && <p role="alert" className="camera-start-error">{live.error}</p>}
          </div>
        )}

        {live.live && (
          <button
            type="button"
            className="camera-switch-button"
            onClick={() => void switchPhysicalCamera()}
            disabled={live.phase === "requesting" || live.phase === "loading"}
            aria-label={currentCamera === "user" ? "Переключить на основную камеру" : "Переключить на селфи-камеру"}
          >
            {currentCamera === "user" ? "↺ Основная" : "↺ Селфи"}
          </button>
        )}

        {live.live && live.phase === "loading" && (
          <span className="camera-loading">Камера работает · загружаю распознавание позы…</span>
        )}

        {live.live && (
          <div className="camera-status">
            <span>{currentCamera === "user" ? "Селфи" : "Основная камера"}</span>
            <span className={sample?.normalized ? "status-ok" : "status-warn"}>
              {sample?.normalized ? "СКЕЛЕТ НАЙДЕН" : "ПОКАЖИСЬ КАМЕРЕ"}
            </span>
          </div>
        )}
      </div>

      <button type="button" onClick={capture} disabled={!sample?.normalized}>Снять targetPose</button>

      <table><tbody>
        {LIVE_FEATURES.map((name) => (
          <tr key={name}><td>{name}</td><td>{formatFeature(features?.[name])}</td></tr>
        ))}
      </tbody></table>

      <Link className="muted" to="/">Назад</Link>
    </main>
  );
}

function formatFeature(value: number | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(3);
}
