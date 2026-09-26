import { useEffect, useRef, useState } from "react";
import type { PoseFrame } from "../types";
import { liveFeatures, poseUsable, type FeatureMap } from "./features";
import type { RawPose } from "./landmarks";
import { normalizePose, torsoPixels, TorsoScale, type Facing } from "./normalize";
import { MediaPipeLivePose } from "./poseLandmarker";
import { smoothFeatures, trimHistory, type TimedSample } from "./smoothing";

export interface LiveSample {
  timeMs: number;
  raw: RawPose;
  normalized: RawPose | null;
  features: FeatureMap | null;
  smoothed: FeatureMap | null;
  enough: boolean;
  usable: boolean;
}

export function useLivePose(facing: Facing, onSample: (sample: LiveSample) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onSampleRef = useRef(onSample);
  const facingRef = useRef(facing);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  onSampleRef.current = onSample;
  facingRef.current = facing;

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    const detector = new MediaPipeLivePose();
    const scale = new TorsoScale();
    let history: TimedSample[] = [];
    detector.onPose((raw) => {
      const smoothedScale = scale.push(torsoPixels(raw));
      const normalized = smoothedScale ? normalizePose(raw, facingRef.current, smoothedScale) : null;
      const features = normalized ? liveFeatures(normalized.landmarks) : null;
      history = trimHistory([...history, { timeMs: raw.timestampMs, features }], raw.timestampMs);
      const smoothed = smoothFeatures(history, raw.timestampMs);
      draw(canvas, video, raw);
      onSampleRef.current({
        timeMs: raw.timestampMs,
        raw,
        normalized,
        features,
        smoothed: smoothed.features,
        enough: smoothed.enough,
        usable: poseUsable(features),
      });
    });
    const boot = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
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

function draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, raw: RawPose) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const pose: PoseFrame = {
    timestamp_ms: raw.timestampMs,
    landmarks: raw.landmarks,
  };
  const box = contentBox(video);
  ctx.strokeStyle = "#e2c48a";
  ctx.fillStyle = "#e2c48a";
  ctx.lineWidth = 2;
  const points = new Map<string, [number, number]>();
  for (const [name, landmark] of Object.entries(pose.landmarks)) {
    if (landmark.visibility < 0.25) continue;
    points.set(name, [box.x + landmark.x * box.w, box.y + landmark.y * box.h]);
  }
  const edges: Array<[string, string]> = [
    ["left_shoulder", "right_shoulder"],
    ["left_shoulder", "left_hip"],
    ["right_shoulder", "right_hip"],
    ["left_hip", "right_hip"],
    ["left_hip", "left_knee"],
    ["left_knee", "left_ankle"],
    ["right_hip", "right_knee"],
    ["right_knee", "right_ankle"],
    ["left_shoulder", "nose"],
    ["right_shoulder", "nose"],
  ];
  ctx.beginPath();
  for (const [start, end] of edges) {
    const a = points.get(start);
    const b = points.get(end);
    if (!a || !b) continue;
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  for (const [x, y] of points.values()) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function contentBox(video: HTMLVideoElement) {
  const elW = video.clientWidth;
  const elH = video.clientHeight;
  const vw = video.videoWidth || elW;
  const vh = video.videoHeight || elH;
  if (!elW || !elH || !vw || !vh) return { x: 0, y: 0, w: elW, h: elH };
  const scale = Math.min(elW / vw, elH / vh);
  const w = vw * scale;
  const h = vh * scale;
  return { x: (elW - w) / 2, y: (elH - h) / 2, w, h };
}
