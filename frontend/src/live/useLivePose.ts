import { useEffect, useRef, useState } from "react";
import type { PoseFrame } from "../types";
import type { TrackingMode, WeaponMarkers, WeaponTrackingMode } from "../drill/types";
import { assessFraming, type FramingAssessment } from "./framing";
import { liveFeatures, poseUsable, type FeatureMap } from "./features";
import type { RawPose } from "./landmarks";
import { normalizePose, torsoPixels, TorsoScale, type Facing } from "./normalize";
import { MediaPipeLivePose } from "./poseLandmarker";
import { smoothFeatures, trimHistory, type TimedSample } from "./smoothing";
import { detectWeaponMarkers } from "./weaponMarkers";

export interface LiveSample {
  timeMs: number;
  raw: RawPose;
  normalized: RawPose | null;
  features: FeatureMap | null;
  smoothed: FeatureMap | null;
  enough: boolean;
  usable: boolean;
  framing: FramingAssessment;
  weapon: WeaponMarkers | null;
}

export interface LivePoseOptions {
  smoothingMs?: number;
  trackingMode?: TrackingMode;
  weaponTracking?: WeaponTrackingMode;
}

export function useLivePose(facing: Facing, onSample: (sample: LiveSample) => void, options: LivePoseOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onSampleRef = useRef(onSample);
  const facingRef = useRef(facing);
  const optionsRef = useRef(options);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  onSampleRef.current = onSample;
  facingRef.current = facing;
  optionsRef.current = options;

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    const detector = new MediaPipeLivePose();
    const scale = new TorsoScale();
    const markerCanvas = document.createElement("canvas");
    let history: TimedSample[] = [];
    let lastWeaponAt = 0;
    let weapon: WeaponMarkers | null = null;

    detector.onPose((raw) => {
      const active = optionsRef.current;
      const trackingMode = active.trackingMode ?? "full_body";
      const smoothedScale = scale.push(torsoPixels(raw));
      const normalized = smoothedScale ? normalizePose(raw, facingRef.current, smoothedScale) : null;
      const features = normalized ? liveFeatures(normalized.landmarks) : null;
      history = trimHistory([...history, { timeMs: raw.timestampMs, features }], raw.timestampMs);
      const smoothed = smoothFeatures(history, raw.timestampMs, active.smoothingMs ?? 100, 3, trackingMode);
      const framing = assessFraming(raw, trackingMode);

      if (active.weaponTracking === "optional" && raw.timestampMs - lastWeaponAt >= 90) {
        weapon = detectWeaponMarkers(video, markerCanvas);
        lastWeaponAt = raw.timestampMs;
      } else if (active.weaponTracking !== "optional") {
        weapon = null;
      }

      draw(canvas, video, raw, weapon);
      onSampleRef.current({
        timeMs: raw.timestampMs,
        raw,
        normalized,
        features,
        smoothed: smoothed.features,
        enough: smoothed.enough,
        usable: poseUsable(features, trackingMode) && framing.ready,
        framing,
        weapon,
      });
    });

    const boot = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
        video.srcObject = stream;
        await video.play();
        await detector.start(video);
        setLive(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Камера или модель позы не запустились");
      }
    };
    void boot();

    return () => {
      stopped = true;
      detector.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { videoRef, canvasRef, error, live };
}

function draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, raw: RawPose, weapon: WeaponMarkers | null) {
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
  ctx.strokeStyle = "#b31f19";
  ctx.fillStyle = "#b31f19";
  ctx.lineWidth = 2.5;
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
