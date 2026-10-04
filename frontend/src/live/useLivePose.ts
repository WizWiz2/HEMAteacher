import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseFrame } from "../types";
import type { TargetPose, TrackingMode, WeaponMarkers, WeaponTrackingMode } from "../drill/types";
import { type FramingAssessment } from "./framing";
import { type FeatureMap } from "./features";
import type { RawPose } from "./landmarks";
import { type CameraView, type Facing } from "./normalize";
import { MediaPipeLivePose } from "./poseLandmarker";
import { LiveSampleProcessor } from "./sampleProcessor";
import { detectWeaponMarkers } from "./weaponMarkers";
import { BladeTracker, bladeTrackingEnabled, loadBladeModel } from "./bladeTracking";
import { projectTargetGhost } from "./targetGhost";

export interface LiveSample {
  cameraView?: CameraView;
  timeMs: number;
  raw: RawPose;
  normalized: RawPose | null;
  features: FeatureMap | null;
  smoothed: FeatureMap | null;
  enough: boolean;
  usable: boolean;
  framing: FramingAssessment;
  motionUsable?: boolean;
  motionFraming?: FramingAssessment;
  weapon: WeaponMarkers | null;
}

export type PhysicalCamera = "environment" | "user";

export interface LivePoseOptions {
  smoothingMs?: number;
  trackingMode?: TrackingMode;
  weaponTracking?: WeaponTrackingMode;
  targetPose?: TargetPose | null;
  targetGhost?: boolean;
  cameraView?: CameraView;
}

export function useLivePose(facing: Facing, onSample: (sample: LiveSample) => void, options: LivePoseOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onSampleRef = useRef(onSample);
  const facingRef = useRef(facing);
  const optionsRef = useRef(options);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [phase, setPhase] = useState<"idle" | "requesting" | "loading" | "ready">("idle");
  const [cameraFacingMode, setCameraFacingMode] = useState<string | null>(null);
  const [requestedCamera, setRequestedCamera] = useState<PhysicalCamera>("environment");
  const requestedCameraRef = useRef<PhysicalCamera>("environment");
  const actualCameraRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<MediaPipeLivePose | null>(null);
  const requestId = useRef(0);
  const busy = useRef(false);
  onSampleRef.current = onSample;
  facingRef.current = facing;
  optionsRef.current = options;

  const start = useCallback(async (camera: PhysicalCamera = requestedCameraRef.current) => {
    if (busy.current) return;
    busy.current = true;
    const currentRequest = ++requestId.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      busy.current = false;
      setError("Экран камеры ещё не готов. Попробуй ещё раз.");
      return;
    }
    detectorRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    video.pause();
    video.srcObject = null;
    video.removeAttribute("src");
    requestedCameraRef.current = camera;
    setRequestedCamera(camera);
    setError(null);
    setLive(false);
    setPhase("requesting");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      busy.current = false;
      setPhase("idle");
      setError("Браузер не даёт доступ к камере. Открой сайт напрямую по HTTPS в Safari или Chrome.");
      return;
    }
    const detector = new MediaPipeLivePose();
    detectorRef.current = detector;
    const processor = new LiveSampleProcessor();
    const markerCanvas = document.createElement("canvas");
    let lastWeaponAt = 0;
    let weapon: WeaponMarkers | null = null;
    // experimental blade tracking (off by default, docs/blade-tracking.md)
    const blade = bladeTrackingEnabled() ? new BladeTracker() : null;
    if (blade) void loadBladeModel();

    detector.onPose((raw) => {
      const active = optionsRef.current;
      const trackingMode = active.trackingMode ?? "full_body";
      blade?.attach(raw, video, processor.scale.current());
      const sample = processor.process(raw, facingRef.current, trackingMode, active.cameraView ?? "side", active.smoothingMs ?? 100);
      const smoothedScale = processor.scale.current();

      if (active.weaponTracking === "optional" && raw.timestampMs - lastWeaponAt >= 90) {
        weapon = detectWeaponMarkers(video, markerCanvas);
        lastWeaponAt = raw.timestampMs;
      } else if (active.weaponTracking !== "optional") {
        weapon = null;
      }

      draw(canvas, video, raw, weapon, active.targetGhost ? active.targetPose ?? null : null, facingRef.current, smoothedScale, active.cameraView ?? "side");
      onSampleRef.current({...sample, weapon});
    });

    try {
      const stream = await openCameraStream(camera);
      if (currentRequest !== requestId.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const actualFacing = stream.getVideoTracks()[0]?.getSettings().facingMode ?? null;
      actualCameraRef.current = actualFacing;
      setCameraFacingMode(actualFacing);
      video.srcObject = stream;
      await video.play();
      if (currentRequest !== requestId.current) return;
      setLive(true);
      setPhase("loading");
      await detector.start(video);
      if (currentRequest !== requestId.current) return;
      setPhase("ready");
    } catch (reason) {
      if (currentRequest !== requestId.current) return;
      setError(cameraError(reason));
      setLive(false);
      setPhase("idle");
      detector.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      video.srcObject = null;
    } finally {
      if (currentRequest === requestId.current) busy.current = false;
    }
  }, []);

  const switchCamera = useCallback(async () => {
    if (busy.current) return;
    const actual = actualCameraRef.current;
    const current: PhysicalCamera = actual === "user" || actual === "environment"
      ? actual
      : requestedCameraRef.current;
    const next: PhysicalCamera = current === "user" ? "environment" : "user";

    requestId.current++;
    detectorRef.current?.stop();
    detectorRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    actualCameraRef.current = null;
    setCameraFacingMode(null);
    setLive(false);
    setPhase("idle");
    if (videoRef.current) videoRef.current.srcObject = null;

    await start(next);
  }, [start]);

  useEffect(() => () => {
    requestId.current++;
    detectorRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  return {
    videoRef,
    canvasRef,
    error,
    live,
    phase,
    start,
    switchCamera,
    cameraFacingMode,
    requestedCamera,
  };
}


async function openCameraStream(camera: PhysicalCamera): Promise<MediaStream> {
  const base = {
    audio: false as const,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia({
      ...base,
      video: {
        ...base.video,
        facingMode: { exact: camera },
      },
    });
  } catch (reason) {
    if (!(reason instanceof DOMException) || (reason.name !== "OverconstrainedError" && reason.name !== "NotFoundError")) {
      throw reason;
    }
    return navigator.mediaDevices.getUserMedia({
      ...base,
      video: {
        ...base.video,
        facingMode: { ideal: camera },
      },
    });
  }
}

function cameraError(reason: unknown): string {
  if (reason instanceof DOMException) {
    if (reason.name === "NotAllowedError" || reason.name === "SecurityError")
      return "Доступ к камере запрещён. Разреши камеру для этого сайта в настройках браузера и открой его напрямую, если сейчас он внутри ChatGPT.";
    if (reason.name === "NotFoundError" || reason.name === "OverconstrainedError")
      return "Камера не найдена. Проверь, что устройство позволяет её использовать.";
    if (reason.name === "NotReadableError" || reason.name === "AbortError")
      return "Камера занята другим приложением или не отвечает. Закрой его и попробуй ещё раз.";
  }
  return `Камера или распознавание позы не запустились: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`;
}

function draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, raw: RawPose, weapon: WeaponMarkers | null, targetPose: TargetPose | null, facing: Facing, torsoScale: number | null, cameraView: CameraView) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pose: PoseFrame = { timestamp_ms: raw.timestampMs, landmarks: raw.landmarks };
  const box = contentBox(video);
  const points = new Map<string, [number, number]>();
  for (const [name, landmark] of Object.entries(pose.landmarks)) {
    if (landmark.visibility < 0.25) continue;
    points.set(name, [box.x + landmark.x * box.w, box.y + landmark.y * box.h]);
  }
  const edges: Array<[string, string]> = [
    ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"],
    ["left_hip", "right_hip"], ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
    ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"], ["left_hip", "left_knee"],
    ["left_knee", "left_ankle"], ["right_hip", "right_knee"], ["right_knee", "right_ankle"],
    ["left_ankle", "left_foot_index"], ["right_ankle", "right_foot_index"],
  ];

  if (targetPose && torsoScale) {
    drawTargetGhost(ctx, raw, targetPose, facing, torsoScale, box, points, cameraView);
  }

  ctx.strokeStyle = "#b31f19";
  ctx.fillStyle = "#b31f19";
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  for (const [start, end] of edges) {
    const a = points.get(start), b = points.get(end);
    if (!a || !b) continue;
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  for (const [x, y] of points.values()) {
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  }

  if (weapon?.grip) drawMarker(ctx, box, weapon.grip.x, weapon.grip.y, "#18d6e8", "GRIP");
  if (weapon?.tip) drawMarker(ctx, box, weapon.tip.x, weapon.tip.y, "#ff3bc8", "TIP");
  if (weapon?.detected && weapon.grip && weapon.tip) {
    ctx.strokeStyle = "#f2d38a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(box.x + weapon.grip.x * box.w, box.y + weapon.grip.y * box.h);
    ctx.lineTo(box.x + weapon.tip.x * box.w, box.y + weapon.tip.y * box.h);
    ctx.stroke();
  }
}


const GHOST_EDGES: Array<[string, string]> = [
  ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"], ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"], ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"], ["right_hip", "right_knee"], ["right_knee", "right_ankle"],
  ["left_ankle", "left_foot_index"], ["right_ankle", "right_foot_index"],
];

const GHOST_GUIDE_JOINTS = ["left_wrist", "right_wrist", "left_elbow", "right_elbow", "left_knee", "right_knee", "left_ankle", "right_ankle"];

function drawTargetGhost(
  ctx: CanvasRenderingContext2D,
  raw: RawPose,
  targetPose: TargetPose,
  facing: Facing,
  torsoScale: number,
  box: {x:number;y:number;w:number;h:number},
  livePoints: Map<string, [number, number]>,
  cameraView: CameraView,
) {
  const ghost = projectTargetGhost(raw, targetPose, facing, torsoScale, box, cameraView);
  if (!ghost) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(177, 104, 255, 0.95)";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = "rgba(190, 128, 255, 0.64)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  for (const [start, end] of GHOST_EDGES) {
    const a = ghost.points[start], b = ghost.points[end];
    if (!a || !b) continue;
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();

  ctx.shadowBlur = 5;
  ctx.strokeStyle = "rgba(255, 222, 128, 0.98)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const [start, end] of GHOST_EDGES) {
    const a = ghost.points[start], b = ghost.points[end];
    if (!a || !b) continue;
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();

  for (const [name, point] of Object.entries(ghost.points)) {
    if (!GHOST_GUIDE_JOINTS.includes(name)) continue;
    ctx.fillStyle = "rgba(255, 225, 136, 0.96)";
    ctx.beginPath();
    ctx.arc(point[0], point[1], 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.8;
  for (const name of GHOST_GUIDE_JOINTS) {
    const current = livePoints.get(name);
    const ideal = ghost.points[name];
    if (!current || !ideal) continue;
    const distance = Math.hypot(current[0] - ideal[0], current[1] - ideal[1]);
    if (distance < 10) continue;
    ctx.strokeStyle = distance > 34 ? "rgba(255, 92, 180, 0.92)" : "rgba(255, 215, 120, 0.76)";
    ctx.beginPath();
    ctx.moveTo(current[0], current[1]);
    ctx.lineTo(ideal[0], ideal[1]);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  if (ghost.sword) {
    ctx.shadowColor = "rgba(177, 104, 255, 0.95)";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "rgba(255, 225, 136, 0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ghost.sword.grip[0], ghost.sword.grip[1]);
    ctx.lineTo(ghost.sword.tip[0], ghost.sword.tip[1]);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMarker(ctx: CanvasRenderingContext2D, box: {x:number;y:number;w:number;h:number}, x:number, y:number, color:string, label:string) {
  const px = box.x + x * box.w, py = box.y + y * box.h;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
  ctx.font = "bold 12px Georgia";
  ctx.fillText(label, px + 10, py - 8);
}

function contentBox(video: HTMLVideoElement) {
  const elW = video.clientWidth, elH = video.clientHeight;
  const vw = video.videoWidth || elW, vh = video.videoHeight || elH;
  if (!elW || !elH || !vw || !vh) return { x: 0, y: 0, w: elW, h: elH };
  const scale = Math.min(elW / vw, elH / vh);
  const w = vw * scale, h = vh * scale;
  return { x: (elW - w) / 2, y: (elH - h) / 2, w, h };
}
