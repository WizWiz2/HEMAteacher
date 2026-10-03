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
