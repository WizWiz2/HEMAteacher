import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LivePoseCanvas } from "../components/LivePoseCanvas";
import { LIVE_FEATURES } from "../live/features";
import type { Facing } from "../live/normalize";
import { useLivePose, type LiveSample } from "../live/useLivePose";

export function CheckpointCapturePage() {
  const [facing, setFacing] = useState<Facing>("right");
  const [sample, setSample] = useState<LiveSample | null>(null);
  const latest = useRef<LiveSample | null>(null);
  const live = useLivePose(facing, (next) => {
    latest.current = next;
    if (!sample || next.timeMs - sample.timeMs > 100) setSample(next);
  });

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

  const features = sample?.smoothed ?? sample?.features;
  return (
    <main className="stack">
      <div>
        <h1>Снять контрольную точку</h1>
        <p className="lede">Камера, скелет и текущие признаки. Экспорт теперь сразу пригоден как machine target.</p>
      </div>
      <div className="row">
        <button type="button" className={facing === "left" ? "ghost active" : "ghost"} onClick={() => setFacing("left")}>Лицом ←</button>
        <button type="button" className={facing === "right" ? "ghost active" : "ghost"} onClick={() => setFacing("right")}>Лицом →</button>
      </div>
      <LivePoseCanvas videoRef={live.videoRef} canvasRef={live.canvasRef} />
      {live.error && <p className="error">{live.error}</p>}
      <button type="button" onClick={capture} disabled={!sample?.normalized}>Снять targetPose</button>
      <table><tbody>
        {LIVE_FEATURES.map((name) => <tr key={name}><td>{name}</td><td>{formatFeature(features?.[name])}</td></tr>)}
      </tbody></table>
      <Link className="muted" to="/">Назад</Link>
    </main>
  );
}

function formatFeature(value: number | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(3);
}
