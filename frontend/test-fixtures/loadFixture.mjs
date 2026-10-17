// Node-only loader for the compact pose fixture (tests and scripts). Kept outside src/ so the app build stays browser-only.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

let cached = null;
export function loadMotionFixture() {
  cached ??= JSON.parse(gunzipSync(readFileSync(fileURLToPath(new URL("./motion-poses.json.gz", import.meta.url)))).toString());
  return cached;
}
export function loadDrills() {
  return JSON.parse(readFileSync(fileURLToPath(new URL("../public/content/drills.json", import.meta.url)), "utf8"));
}

// Experimental blade tracking (docs/blade-tracking.md): blade detections of src/live/bladeDetector.ts on the fixture
// clips' videos (built by scripts/build-blade-fixture.mjs, which needs the rendered videos).
let bladeCached = null;
export function loadBladeDetections() {
  bladeCached ??= JSON.parse(gunzipSync(readFileSync(fileURLToPath(new URL("./motion-blade.json.gz", import.meta.url)))).toString());
  return bladeCached;
}
/** Copy of the fixture with clip.b = detections at or above minConfidence (null elsewhere). */
export function withBlade(fx, minConfidence) {
  const det = loadBladeDetections().clips;
  return {...fx, clips: fx.clips.map(c => det[c.id] ? {...c, b: det[c.id].map(r => r.length && r[4] >= minConfidence * 100 ? r.slice(0, 4).map(v => v / 1e4) : null)} : c)};
}
