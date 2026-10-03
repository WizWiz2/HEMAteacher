// Test/evaluation helper: loads the compact pose fixture (test-fixtures/motion-poses.json.gz). Node only.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import type { Fixture } from "./motionTraining";
import type { Drill } from "./types";

let cached: Fixture | null = null;
export function loadMotionFixture(): Fixture {
  cached ??= JSON.parse(gunzipSync(readFileSync(fileURLToPath(new URL("../../test-fixtures/motion-poses.json.gz", import.meta.url)))).toString());
  return cached!;
}
export function loadDrills(): Drill[] {
  return JSON.parse(readFileSync(fileURLToPath(new URL("../../public/content/drills.json", import.meta.url)), "utf8"));
}
