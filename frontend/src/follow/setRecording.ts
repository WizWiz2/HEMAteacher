/**
 * Optional, explicit recording of one follow-along set: camera video + pose landmarks + reps,
 * packed into a local zip. Nothing is uploaded anywhere; the archive only leaves the device
 * when the user downloads it.
 */
import type { LandmarkMap } from "../live/landmarks";

export const RECORDING_SCHEMA_VERSION = 1;
/** Hard caps so a forgotten recording cannot eat the phone's memory. */
export const DEFAULT_MAX_BYTES = 300 * 1024 * 1024;
export const DEFAULT_MAX_MS = 10 * 60 * 1000;

const MIME_CANDIDATES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4;codecs=avc1", "video/mp4"];

export function chooseMimeType(isSupported: ((type: string) => boolean) | undefined): string | undefined {
  if (!isSupported) return undefined;
  return MIME_CANDIDATES.find(type => { try { return isSupported(type); } catch { return false; } });
}

export function recordingSupport(): {ok: true} | {ok: false; reason: string} {
  if (typeof MediaRecorder === "undefined") return {ok: false, reason: "Этот браузер не умеет записывать видео (нет MediaRecorder). Подход пройдёт без записи."};
  return {ok: true};
}

export function videoExtension(mime: string): string {
  return /mp4/i.test(mime) ? "mp4" : "webm";
}

/** Filesystem-safe ASCII name: hema-follow_zornhau_front_2026-11-08_15-43-07.zip */
export function safeFilename(drill: string, view: string, date: Date): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "drill";
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
  return `hema-follow_${clean(drill)}_${clean(view)}_${stamp}.zip`;
}

export interface RecordingMeta {
  drill: string;
  drillName: string;
  view: string;
  facing: string;
  tempo: number;
  mirroredPreview: boolean;
  appVersion?: string;
}

export interface RecordedPose {
  /** ms since the recorder started (same clock as the video, approximately). */
  tMs: number;
  /** Pose sample clock used by the rep counter (FollowRep.startMs/endMs are on this clock). */
  sampleTimeMs: number;
  usable: boolean;
  width: number;
  height: number;
  landmarks: LandmarkMap;
}

export interface RecordedRep {
  index: number;
  startMs: number;
  endMs: number;
  /** Same reps converted to ms since recorder start. */
  startTMs: number | null;
  endTMs: number | null;
  similarity: number;
  tempo: number;
  consistency: number | null;
  hint: string | null;
}

export type StopReason = "user" | "max-size" | "max-duration" | "drill-changed" | "camera-changed" | "camera-stopped" | "error" | "page-left";

export const STOP_REASON_TEXT: Record<StopReason, string> = {
  "user": "",
  "max-size": "Запись остановлена: достигнут предел размера. Сохранено всё до этого момента.",
  "max-duration": "Запись остановлена: достигнут предел 10 минут. Сохранено всё до этого момента.",
  "drill-changed": "Запись остановлена: сменилось упражнение или вид камеры.",
  "camera-changed": "Запись остановлена: сменилась камера.",
  "camera-stopped": "Запись остановлена: камера отключилась.",
  "error": "Запись прервалась из-за ошибки браузера. Сохранено то, что успело записаться.",
  "page-left": "Запись остановлена.",
};

export interface RecordingResult {
  video: Blob;
  mimeType: string;
  meta: RecordingMeta;
  startedAtIso: string;
  durationMs: number;
  poses: RecordedPose[];
  reps: RecordedRep[];
  stopReason: StopReason;
  error: string | null;
}

interface RecorderLike {
  mimeType: string;
  state: string;
  ondataavailable: ((e: {data: Blob}) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}
export type RecorderFactory = (stream: MediaStream, mimeType: string | undefined) => RecorderLike;

export interface SetRecorderOptions {
  maxBytes?: number;
  maxMs?: number;
  now?: () => number;
  wallClock?: () => Date;
  factory?: RecorderFactory;
  /** Called once when the recording ends for any reason other than the user stopping it. */
  onAutoStop?: (reason: StopReason) => void;
}

const defaultFactory: RecorderFactory = (stream, mimeType) =>
  new MediaRecorder(stream, {...(mimeType ? {mimeType} : {}), videoBitsPerSecond: 2_500_000}) as unknown as RecorderLike;

/** Records the given (already open, video-only) camera stream. Never opens a camera or a microphone itself. */
export class SetRecorder {
  private recorder: RecorderLike;
  private chunks: Blob[] = [];
  private bytes = 0;
  private t0: number;
  private startedAt: Date;
  private poses: RecordedPose[] = [];
  private reps = new Map<number, RecordedRep>();
  /** sampleTimeMs -> tMs offset, from the latest pose. */
  private clockOffset: number | null = null;
  private reason: StopReason = "user";
  private errorText: string | null = null;
  private done: Promise<RecordingResult>;
  private finished = false;
  readonly mimeType: string;
  private opts: Required<Omit<SetRecorderOptions, "onAutoStop" | "factory">> & Pick<SetRecorderOptions, "onAutoStop">;

  constructor(stream: MediaStream, private meta: RecordingMeta, options: SetRecorderOptions = {}) {
    this.opts = {maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES, maxMs: options.maxMs ?? DEFAULT_MAX_MS,
      now: options.now ?? (() => performance.now()), wallClock: options.wallClock ?? (() => new Date()), onAutoStop: options.onAutoStop};
    const audio = stream.getAudioTracks?.() ?? [];
    // Video only: never record sound even if a track slipped in.
    const videoOnly = audio.length && typeof MediaStream !== "undefined" ? new MediaStream(stream.getVideoTracks()) : stream;
    const mime = chooseMimeType(typeof MediaRecorder !== "undefined" ? MediaRecorder.isTypeSupported.bind(MediaRecorder) : undefined);
    this.recorder = (options.factory ?? defaultFactory)(videoOnly, mime);
    this.mimeType = this.recorder.mimeType || mime || "video/webm";
    this.t0 = this.opts.now();
    this.startedAt = this.opts.wallClock();
    this.done = new Promise(resolve => {
      this.recorder.ondataavailable = e => {
        if (!e.data || e.data.size === 0) return;
        this.chunks.push(e.data); this.bytes += e.data.size;
        if (this.bytes >= this.opts.maxBytes) this.autoStop("max-size");
      };
      this.recorder.onerror = e => {
        const err = (e as {error?: {name?: string; message?: string}})?.error;
        this.errorText = err ? `${err.name ?? "Error"}: ${err.message ?? ""}` : "MediaRecorder error";
        this.autoStop("error");
      };
      this.recorder.onstop = () => { this.finished = true; resolve(this.result()); };
    });
    for (const track of stream.getVideoTracks()) track.addEventListener?.("ended", () => this.autoStop("camera-stopped"));
    this.recorder.start(1000);
  }

  get elapsedMs() { return this.opts.now() - this.t0; }
  get sizeBytes() { return this.bytes; }
  get active() { return !this.finished && this.recorder.state !== "inactive"; }

  addPose(p: {sampleTimeMs: number; usable: boolean; width: number; height: number; landmarks: LandmarkMap}) {
    if (!this.active) return;
    const tMs = this.opts.now() - this.t0;
    if (tMs >= this.opts.maxMs) { this.autoStop("max-duration"); return; }
    this.clockOffset = tMs - p.sampleTimeMs;
    this.poses.push({tMs: round(tMs), sampleTimeMs: round(p.sampleTimeMs), usable: p.usable, width: p.width, height: p.height, landmarks: roundLandmarks(p.landmarks)});
  }

  /** Upserts reps (the counter may refine the last one). */
  setReps(reps: readonly {index: number; startMs: number; endMs: number; similarity: number; tempo: number; consistency: number | null; hint: string | null}[]) {
    if (!this.active) return;
    const off = this.clockOffset;
    for (const r of reps) this.reps.set(r.index, {index: r.index, startMs: round(r.startMs), endMs: round(r.endMs),
      startTMs: off === null ? null : round(r.startMs + off), endTMs: off === null ? null : round(r.endMs + off),
      similarity: r.similarity, tempo: Math.round(r.tempo * 100) / 100, consistency: r.consistency, hint: r.hint});
  }

  stop(reason: StopReason = "user"): Promise<RecordingResult> {
    if (this.active) {
      this.reason = reason;
      this.durationEnd = this.opts.now();
      try { this.recorder.stop(); } catch { this.finished = true; }
    }
    return this.done;
  }

  private durationEnd: number | null = null;
  private autoStop(reason: StopReason) {
    if (!this.active) return;
    void this.stop(reason);
    this.opts.onAutoStop?.(reason);
  }

  private result(): RecordingResult {
    const end = this.durationEnd ?? this.opts.now();
    return {video: new Blob(this.chunks, {type: this.mimeType}), mimeType: this.mimeType, meta: this.meta,
      startedAtIso: this.startedAt.toISOString(), durationMs: round(end - this.t0), poses: this.poses,
      reps: [...this.reps.values()].sort((a, b) => a.index - b.index), stopReason: this.reason, error: this.errorText};
  }
}

const round = (n: number) => Math.round(n * 10) / 10;
function roundLandmarks(map: LandmarkMap): LandmarkMap {
  const r = (x: number) => Math.round(x * 1e5) / 1e5;
  const out: LandmarkMap = {};
  for (const [k, v] of Object.entries(map)) out[k] = {x: r(v.x), y: r(v.y), z: r(v.z), visibility: r(v.visibility ?? 0)};
  return out;
}

export function buildRecordingJson(res: RecordingResult, videoFile: string) {
  return {
    schemaVersion: RECORDING_SCHEMA_VERSION,
    kind: "hema-follow-set",
    note: "Local recording made by the user. Scores are a soft similarity to computer-rendered references, not a technique verdict.",
    startedAt: res.startedAtIso,
    durationMs: res.durationMs,
    stopReason: res.stopReason,
    error: res.error,
    drill: res.meta,
    video: {file: videoFile, mimeType: res.mimeType, sizeBytes: res.video.size, clock: "tMs = ms since recording start"},
    pose: {source: "MediaPipe Pose Landmarker (image coordinates 0..1)", count: res.poses.length,
      clock: "tMs on the video clock; sampleTimeMs on the rep counter clock", frames: res.poses},
    reps: res.reps,
    summary: {reps: res.reps.length,
      averageSimilarity: res.reps.length ? Math.round(res.reps.reduce((s, r) => s + r.similarity, 0) / res.reps.length) : null},
  };
}

const README = `HEMAteacher — запись подхода «Повторяй за эталоном»

Файлы:
- video.* — видео с камеры без звука.
- set.json — упражнение, позы MediaPipe по кадрам, повторы и мягкая оценка сходства.

Время: tMs — миллисекунды от начала записи (совпадает со временем видео с точностью до кадра).
Оценка сходства грубая и считается относительно компьютерных эталонов, это не оценка техники.
Запись сделана и хранится только на твоём устройстве.
`;

export async function buildRecordingZip(res: RecordingResult): Promise<Blob> {
  const videoFile = `video.${videoExtension(res.mimeType)}`;
  const json = JSON.stringify(buildRecordingJson(res, videoFile));
  const enc = new TextEncoder();
  const mtime = new Date(res.startedAtIso);
  return zipStore([
    {name: videoFile, data: new Uint8Array(await res.video.arrayBuffer())},
    {name: "set.json", data: enc.encode(json)},
    {name: "README.txt", data: enc.encode(README)},
  ], mtime);
}

// ---- Minimal uncompressed ZIP writer (video is already compressed; no dependency needed). ----
let crcTable: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStore(files: {name: string; data: Uint8Array}[], date = new Date()): Blob {
  const enc = new TextEncoder();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = (Math.max(0, date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const parts: BlobPart[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
    h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(h.buffer, name, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
    c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    const entry = new Uint8Array(46 + name.length); entry.set(new Uint8Array(c.buffer)); entry.set(name, 46);
    central.push(entry);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((s, e) => s + e.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], {type: "application/zip"});
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
