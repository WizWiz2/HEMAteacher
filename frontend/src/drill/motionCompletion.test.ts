import { describe, it, expect } from "vitest";
import { endStanceRatio, sequencePath } from "./motionRecognition";

const samples = (fd: number[]) => fd.map((foot_distance, i) => ({ timeMs: i * 33, features: { foot_distance } }));

describe("completion checks", () => {
  it("end stance: a step back into stance keeps the spacing, a pause with feet together does not", () => {
    expect(endStanceRatio(samples([.6, .6, .6, .6, .6, .9, 1.1, .7, .6, .6, .6, .6, .6]))).toBeCloseTo(1);
    expect(endStanceRatio(samples([.6, .6, .6, .6, .6, .4, .2, .1, .1, .1, .1, .1]))).toBeLessThan(.5);
    expect(endStanceRatio(samples([.6]))).toBeNaN();
  });
  it("sequence path: half of a straight path is half as long; unobserved channels are skipped", () => {
    const row = (x: number) => [x, 0, null, null, null, null, null, null, null, 0, 0, null, null, 0];
    const scales = Array(14).fill(1);
    const full = sequencePath([0, 1, 2, 3, 4].map(row), scales), half = sequencePath([0, .5, 1, 1.5, 2].map(row), scales);
    expect(half / full).toBeCloseTo(.5);
  });
});
