// Experimental blade tracking (docs/blade-tracking.md). OFF by default; enable with ?blade=1 (remembered) or
// localStorage "hema.bladeTracking" = "1"; ?blade=0 turns it off again. When on, every pose frame also runs the
// classical blade detector (bladeDetector.ts) on a <= 640 px grey copy of the video frame, adds the detected
// crossguard/tip as extra landmarks, and the recogniser switches to the model trained with blade channels.
import type { RawPose } from "./landmarks";
import { BLADE_DETECTOR_DEFAULTS, BladeTrack, bodyPoints, scanBlade, shoulderCentre, type BladeDetection, type GrayImage } from "./bladeDetector";
import { setRecognitionModel } from "../drill/continuousMotion";
import { BladeNet, type BladeNetWeights } from "./bladeNet";
import type { RecognitionModel } from "../drill/motionRecognition";

/** Extra confidence floor on the stored detections (fixture). 0: the hybrid detector already decides (confident frames
 *  start the track, weaker ones are accepted only inside its predicted window, the net fills the rest). */
export const BLADE_MIN_CONFIDENCE = 0;
const KEY = "hema.bladeTracking";

export function bladeTrackingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("blade");
    if (q === "1" || q === "0") window.localStorage.setItem(KEY, q);
    return window.localStorage.getItem(KEY) === "1";
  } catch { return false; }
}

let modelLoaded: Promise<void> | null = null;
/** Loads the blade-channel model (separate chunk, only downloaded when the flag is on). */
export function loadBladeModel(): Promise<void> {
  modelLoaded ??= import("../drill/motionModelBlade.json").then(m => setRecognitionModel((m.default ?? m) as unknown as RecognitionModel));
  return modelLoaded;
}

let net: BladeNet | null = null;
let netLoaded: Promise<void> | null = null;
/** Loads the tiny blade net (separate chunk, flag only). Until it is loaded only the classical track is used. */
export function loadBladeNet(): Promise<void> {
  netLoaded ??= import("./bladeNetWeights.json").then(m => { net = new BladeNet((m.default ?? m) as unknown as BladeNetWeights); });
  return netLoaded;
}
/** Net fallback: frames without a classical track detection use the net direction when its presence is >= this. */
export const BLADE_NET_MIN_PRESENCE = .5;

/** Hybrid detection on one grey frame: classical scan + temporal track first, else the tiny net (if given). */
export function hybridDetect(track: BladeTrack, bladeNet: BladeNet | null, img: GrayImage, hands: [number, number], torsoPx: number,
  landmarks: Parameters<typeof bodyPoints>[0], timeMs: number): BladeDetection | null {
  const scan = scanBlade(img, hands, torsoPx, BLADE_DETECTOR_DEFAULTS, bodyPoints(landmarks), shoulderCentre(landmarks));
  const d = track.update(scan, timeMs);
  if (d || !bladeNet) return d;
  const r = bladeNet.direction(img, hands, torsoPx);
  if (!r || r.presence < BLADE_NET_MIN_PRESENCE) return null;
  const ox = hands[0] * img.width, oy = hands[1] * img.height, c = Math.cos(r.angle), s = Math.sin(r.angle);
  const g = BLADE_DETECTOR_DEFAULTS.guardOffset * torsoPx, t = BLADE_DETECTOR_DEFAULTS.bladeLength * torsoPx;
  return { guard: [(ox + c * g) / img.width, (oy + s * g) / img.height], tip: [(ox + c * t) / img.width, (oy + s * t) / img.height], contrast: 0 };
}

/** Grey frame grabber reusing one canvas. */
export class BladeTracker {
  private canvas = document.createElement("canvas");
  private gray: Uint8Array | null = null;
  private track = new BladeTrack();
  last: BladeDetection | null = null;

  /** Detects the blade on the current video frame and adds blade_guard / blade_tip landmarks to `raw` (in place). */
  attach(raw: RawPose, video: HTMLVideoElement, torsoPxVideo: number | null): BladeDetection | null {
    this.last = null;
    const lw = raw.landmarks.left_wrist, rw = raw.landmarks.right_wrist;
    if (!lw || !rw || !torsoPxVideo || !video.videoWidth) return null;
    const scale = Math.min(1, 640 / video.videoWidth), w = Math.round(video.videoWidth * scale), h = Math.round(video.videoHeight * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.gray = new Uint8Array(w * h); }
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !this.gray) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const rgba = ctx.getImageData(0, 0, w, h).data, g = this.gray;
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
    const d = hybridDetect(this.track, net, { data: g, width: w, height: h }, [(lw.x + rw.x) / 2, (lw.y + rw.y) / 2], torsoPxVideo * scale,
      raw.landmarks, raw.timestampMs);
    if (!d) return null;
    raw.landmarks.blade_guard = { x: d.guard[0], y: d.guard[1], z: 0, visibility: 1 };
    raw.landmarks.blade_tip = { x: d.tip[0], y: d.tip[1], z: 0, visibility: 1 };
    this.last = d;
    return d;
  }
}
