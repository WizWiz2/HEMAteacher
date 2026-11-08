import { describe, expect, it } from "vitest";
import { buildRecordingJson, buildRecordingZip, chooseMimeType, crc32, safeFilename, SetRecorder, zipStore, type RecorderFactory } from "./setRecording";

const meta = {drill: "zornhau", drillName: "Цорнхау", view: "front", facing: "right", tempo: 0.75, mirroredPreview: true};
const lm = {nose: {x: 0.512345678, y: 0.2, z: 0, visibility: 0.9}};

function fakeStream(): {stream: MediaStream; end: () => void} {
  const listeners: (() => void)[] = [];
  const track = {addEventListener: (_: string, f: () => void) => listeners.push(f)};
  return {stream: {getVideoTracks: () => [track], getAudioTracks: () => []} as unknown as MediaStream, end: () => listeners.forEach(f => f())};
}
function fakeRecorder() {
  const r = {mimeType: "video/webm", state: "inactive", ondataavailable: null as null | ((e: {data: Blob}) => void),
    onstop: null as null | (() => void), onerror: null, start() { r.state = "recording"; },
    stop() { r.state = "inactive"; r.ondataavailable?.({data: new Blob(["tail"])}); r.onstop?.(); },
    emit(n: number) { r.ondataavailable?.({data: new Blob([new Uint8Array(n)])}); }};
  const factory: RecorderFactory = () => r;
  return {r, factory};
}

describe("set recording", () => {
  it("picks a supported mime type or none", () => {
    expect(chooseMimeType(t => t === "video/mp4")).toBe("video/mp4");
    expect(chooseMimeType(undefined)).toBeUndefined();
    expect(chooseMimeType(() => { throw new Error("x"); })).toBeUndefined();
  });

  it("makes safe file names", () => {
    expect(safeFilename("passing-step/forward ../", "front", new Date(2026, 10, 8, 15, 4, 7))).toBe("hema-follow_passing-step-forward_front_2026-11-08_15-04-07.zip");
  });

  it("aligns poses and reps to the recording clock", async () => {
    let now = 1000;
    const {r, factory} = fakeRecorder();
    const rec = new SetRecorder(fakeStream().stream, meta, {factory, now: () => now, wallClock: () => new Date("2026-11-08T10:00:00Z")});
    now = 1500; rec.addPose({sampleTimeMs: 9500, usable: true, width: 640, height: 480, landmarks: lm});
    rec.setReps([{index: 1, startMs: 9100, endMs: 9400, similarity: 48, tempo: 2.345, consistency: null, hint: null}]);
    r.emit(10); now = 2000;
    const res = await rec.stop();
    expect(res.durationMs).toBe(1000);
    expect(res.poses[0].tMs).toBe(500);
    expect(res.poses[0].landmarks.nose.x).toBe(0.51235);
    expect(res.reps[0]).toMatchObject({startTMs: 100, endTMs: 400, tempo: 2.35});
    expect(res.stopReason).toBe("user");
    expect(res.video.size).toBe(14);
    rec.addPose({sampleTimeMs: 1, usable: true, width: 1, height: 1, landmarks: lm});
    expect(res.poses).toHaveLength(1);
  });

  it("auto-stops on size cap, duration cap and camera end, and reports why", async () => {
    const reasons: string[] = [];
    const a = fakeRecorder();
    const r1 = new SetRecorder(fakeStream().stream, meta, {factory: a.factory, maxBytes: 100, onAutoStop: x => reasons.push(x)});
    a.r.emit(150);
    expect((await r1.stop()).stopReason).toBe("max-size");

    let now = 0; const b = fakeRecorder();
    const r2 = new SetRecorder(fakeStream().stream, meta, {factory: b.factory, maxMs: 1000, now: () => now, onAutoStop: x => reasons.push(x)});
    now = 1200; r2.addPose({sampleTimeMs: 0, usable: false, width: 1, height: 1, landmarks: {}});
    expect((await r2.stop()).stopReason).toBe("max-duration");

    const c = fakeRecorder(); const s = fakeStream();
    const r3 = new SetRecorder(s.stream, meta, {factory: c.factory, onAutoStop: x => reasons.push(x)});
    s.end();
    expect((await r3.stop("user")).stopReason).toBe("camera-stopped");
    expect(reasons).toEqual(["max-size", "max-duration", "camera-stopped"]);
  });

  it("builds a versioned json and a valid stored zip", async () => {
    const {factory} = fakeRecorder();
    const rec = new SetRecorder(fakeStream().stream, meta, {factory});
    const res = await rec.stop("drill-changed");
    const json = buildRecordingJson(res, "video.webm");
    expect(json.schemaVersion).toBe(1);
    expect(json.stopReason).toBe("drill-changed");
    const zip = new Uint8Array(await (await buildRecordingZip(res)).arrayBuffer());
    const dv = new DataView(zip.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    const eocd = zip.length - 22;
    expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
    expect(dv.getUint16(eocd + 10, true)).toBe(3);
    const names = new TextDecoder().decode(zip);
    for (const n of ["video.webm", "set.json", "README.txt"]) expect(names).toContain(n);
  });

  it("crc32 matches the reference value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(zipStore([]).size).toBe(22);
  });
});
