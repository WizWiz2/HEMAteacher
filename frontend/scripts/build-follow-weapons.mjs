// Visual blade tracks only. Recognition continues to use body landmarks.
// Side tracks use the renderer's sword_px. Front tracks project the labelled
// rig angles into the reference camera and are deliberately marked schematic.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadMotionFixture } from "../test-fixtures/loadFixture.mjs";

const root = new URL("../../", import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const refs = read("frontend/src/follow/referenceClips.json");
const fixture = loadMotionFixture();
const tracks = {};
for (const [key, ref] of Object.entries(refs.clips)) {
  const [view, drill] = key.split(":");
  if (!drill.endsWith("hau")) continue;
  const clip = fixture.clips.find(c => c.id === ref.source);
  const source = read(`test-data/mock-videos/${drill}/tall_slim_male_master.json`);
  const start = clip.move[0] - ref.moveMs[0];
  const first = source.frames[0].landmarks;
  const mid = (a, b) => [(a[0] + b[0]) * source.resolution[0] / 2, (a[1] + b[1]) * source.resolution[1] / 2];
  const hip = mid(first[23], first[24]), shoulder = mid(first[11], first[12]);
  const torso = Math.hypot(hip[0] - shoulder[0], hip[1] - shoulder[1]);
  const sourceMove = source.timeline_s.find(([, name]) => name === "finish")[0] * 1000;
  const mapTime = t => t <= clip.move[0] ? t : t <= clip.move[1]
    ? clip.move[0] + (t - clip.move[0]) / (clip.move[1] - clip.move[0]) * (sourceMove - clip.move[0])
    : sourceMove + (t - clip.move[1]) / (clip.t.at(-1) - clip.move[1]) * (source.frames.at(-1).t_ms - sourceMove);
  tracks[key] = ref.frames.map((_, i) => {
    const t = start + i * 1000 / ref.fps;
    if (view === "side") {
      const f = source.frames[Math.min(source.frames.length - 1, Math.round(t / 1000 * source.fps))];
      const { crossguard: a, tip: b } = f.sword_px;
      return [Math.round((b[0] - a[0]) / torso * 1000), Math.round((b[1] - a[1]) / torso * 1000)];
    }
    const seconds = mapTime(t) / 1000, tl = source.timeline_s;
    let j = 0;
    while (j < tl.length - 2 && tl[j + 1][0] < seconds) j++;
    const a = source.keyframes_used[tl[j][1]], b = source.keyframes_used[tl[j + 1][1]];
    const u = Math.max(0, Math.min(1, (seconds - tl[j][0]) / (tl[j + 1][0] - tl[j][0])));
    const smooth = u * u * (3 - 2 * u);
    const angle = (a.sword_ang + (b.sword_ang - a.sword_ang) * smooth) * Math.PI / 180;
    const lateral = (a.sword_lat + (b.sword_lat - a.sword_lat) * smooth) * Math.PI / 180;
    const az = (clip.camera.azimuth_deg ?? 90) * Math.PI / 180;
    const length = .95 / source.body.measured.torso_len_m;
    return [Math.round(length * (Math.cos(angle) * Math.cos(lateral) * Math.cos(az) + Math.sin(lateral) * Math.sin(az)) * 1000),
      Math.round(-length * Math.sin(angle) * Math.cos(lateral) * 1000)];
  });
}
const out = fileURLToPath(new URL("../src/follow/referenceWeapons.json", import.meta.url));
const json = JSON.stringify(tracks);
if (process.argv.includes("--check")) {
  if (readFileSync(out, "utf8") !== json) throw new Error("referenceWeapons.json is stale");
} else writeFileSync(out, json);
console.log(`Blade tracks verified: ${Object.keys(tracks).length}`);
