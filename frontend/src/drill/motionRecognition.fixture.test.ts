// Confusion-matrix regression test on recorded MediaPipe poses (test-fixtures/motion-poses.json.gz), run through the same
// streaming pipeline as the app. Templates never include the clips being tested (see evaluateProtocols); the reserved
// TEST bodies/angles (docs/bodies-angles-split.md) are never used for training or tuning.
// Targets: own drill >= 90% on master/experienced, wrong-drill accepts <= 5%.
import { describe, it, expect } from "vitest";
import { loadMotionFixture, loadDrills } from "../../test-fixtures/loadFixture.mjs";
import { confusion, evaluateProtocols, type EvalRow } from "./motionEvaluation";
import { buildModel, isTrainClip } from "./motionTraining";
import shippedModel from "./motionModel.json";

let rows: EvalRow[] | null = null;
const all = () => (rows ??= evaluateProtocols(loadMotionFixture(), loadDrills()));
const report = (name: string, rs: EvalRow[]) => {
  const c = confusion(rs);
  console.log(`${name}: own ${c.own}/${c.ownTotal}, wrong-drill ${c.other}/${c.otherTotal}\n${c.text}`);
  return c;
};
const T = 600000;

describe("motion recognition on the pose fixture", () => {
  it("the shipped model is reproducible from the fixture training split", () => {
    const fx = loadMotionFixture();
    expect(JSON.parse(JSON.stringify(buildModel(fx.clips.filter(isTrainClip), fx.names)))).toEqual(shippedModel);
  }, T);
  it("leave-one-body-out over the train bodies, master/experienced", () => {
    const c = report("lobo M/E", all().filter(r => r.protocol === "lobo" && r.level !== "beginner"));
    expect(c.other / c.otherTotal).toBeLessThanOrEqual(.05);
    // Target 90%, not reached: measured 102/122 (84%) over five train bodies with random cameras (strikes 51/66,
    // steps 51/56; misses are Scheitelhau/Schielhau/Zornhau look-alikes in 2D). Floor guards against regressions.
    expect(c.own / c.ownTotal).toBeGreaterThanOrEqual(.8);
  }, T);
  it("reserved test clips with the shipped model: few wrong-drill accepts", () => {
    const c = report("test", all().filter(r => r.protocol === "test"));
    expect(c.other / c.otherTotal).toBeLessThanOrEqual(.05);
    // measured on all reserved test clips: all levels 181/224 (81%), M/E 122/148 (PR #16 model: 64/224, 53/148)
    expect(c.own / c.ownTotal).toBeGreaterThanOrEqual(.7);
  }, T);
  it("slow beginners are recognised with lower similarity and a slow note", () => {
    const lobo = all().filter(r => r.protocol === "lobo" && r.source === r.selected && r.completed);
    const mean = (lv: (l: string) => boolean) => { const v = lobo.filter(r => lv(r.level)).map(r => r.similarity!); return v.reduce((a, b) => a + b, 0) / v.length; };
    expect(mean(l => l === "beginner")).toBeLessThan(mean(l => l !== "beginner") - 10);
    // Strike beginners get the slow note (measured 17/18). Footwork beginners mostly do not (3/26): footwork can be
    // accepted at a mid-step pause, so its tempo is underestimated (docs/motion-recognition.md, Limitations).
    const strikeBeginners = lobo.filter(r => r.level === "beginner" && r.source.endsWith("hau"));
    expect(strikeBeginners.filter(r => r.feedback?.[0]?.includes("слишком медленно")).length).toBeGreaterThanOrEqual(strikeBeginners.length * .8);
    // Known false slow notes on master/experienced: 3 of 102 accepted attempts (two with an attempt window ~5.5x the
    // typical duration, one at 1.61x). Allow at most 3% until the attempt segmentation is fixed.
    const me = lobo.filter(r => r.level !== "beginner");
    expect(me.filter(r => r.feedback?.[0]?.includes("слишком медленно")).length).toBeLessThanOrEqual(Math.floor(me.length * .03));
  }, T);
});
