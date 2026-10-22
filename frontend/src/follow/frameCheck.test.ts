import { describe, expect, it } from "vitest";
import { frameCheck, frameRate } from "./frameCheck";

const framing = (missing: string[], coverage: number, message = "КАМЕРА · ГОТОВО") => ({ ready: !missing.length, coverage, missing, message });

describe("pre-set frame check", () => {
  it("passes a whole body at a good distance on the GPU", () => {
    expect(frameCheck(framing([], 0.8), 30, "GPU").every(i => i.ok)).toBe(true);
  });
  it("flags missing feet, distance, low fps and the CPU fallback", () => {
    expect(frameCheck(framing(["left_ankle"], 0.5, "НЕ ВИЖУ СТОПЫ · отойди дальше или наклони камеру ниже"), 30, "GPU")[0]).toMatchObject({ ok: false, text: "Не вижу стопы: отойди дальше или наклони камеру ниже" });
    expect(frameCheck(framing([], 0.4), 30, "GPU").find(i => i.id === "distance")?.ok).toBe(false);
    expect(frameCheck(framing([], 0.99), 30, "GPU").find(i => i.id === "distance")?.text).toMatch(/близко/);
    expect(frameCheck(framing([], 0.8), 8, "GPU").find(i => i.id === "fps")?.ok).toBe(false);
    expect(frameCheck(framing([], 0.8), 30, "CPU").some(i => i.id === "delegate" && !i.ok)).toBe(true);
    expect(frameCheck(null, null, null)).toEqual([{ id: "body", ok: false, text: "Не вижу человека в кадре" }]);
  });
  it("measures the frame rate", () => {
    expect(frameRate([0, 100, 200, 300, 400])).toBeCloseTo(10);
    expect(frameRate([0, 100])).toBeNull();
  });
});
