import { describe, expect, it } from "vitest";
import { matchCheckpoint } from "./checkpointMatcher";
import type { Checkpoint } from "./types";

const checkpoint: Checkpoint = {
  id: "stance",
  title: "Стойка",
  holdMs: 300,
  constraints: {
    foot_distance: { target: 0.8, tolerance: 0.1 },
    pelvis_height: { min: 0.9, max: 1.1 },
  },
};

describe("checkpoint constraints", () => {
  it("passes inside a target tolerance and a min/max range", () => {
    const result = matchCheckpoint({ foot_distance: 0.84, pelvis_height: 1 }, checkpoint, { validSince: 0 }, 300, true);
    expect(result.match.features.foot_distance.passed).toBe(true);
    expect(result.match.features.pelvis_height.passed).toBe(true);
    expect(result.match.passed).toBe(true);
  });

  it("fails outside the target tolerance", () => {
    const result = matchCheckpoint({ foot_distance: 1.2, pelvis_height: 1 }, checkpoint, { validSince: null }, 0, true);
    expect(result.match.features.foot_distance.passed).toBe(false);
    expect(result.match.passed).toBe(false);
  });

  it("does not pass before holdMs", () => {
    const started = matchCheckpoint({ foot_distance: 0.8, pelvis_height: 1 }, checkpoint, { validSince: null }, 1000, true);
    expect(started.match.passed).toBe(false);
    expect(started.state.validSince).toBe(1000);
    const early = matchCheckpoint({ foot_distance: 0.8, pelvis_height: 1 }, checkpoint, started.state, 1299, true);
    expect(early.match.passed).toBe(false);
    const ready = matchCheckpoint({ foot_distance: 0.8, pelvis_height: 1 }, checkpoint, started.state, 1300, true);
    expect(ready.match.passed).toBe(true);
  });
});
