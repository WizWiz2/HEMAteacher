import { describe, expect, it } from "vitest";
import { createDrillRuntime, stepDrill } from "./drillEngine";
import type { Checkpoint, Drill } from "./types";

function drillWith(count: number): Drill {
  const checkpoints: Checkpoint[] = Array.from({ length: count }, (_, index) => ({
    id: `cp-${index}`,
    title: `Точка ${index + 1}`,
    holdMs: 100,
    constraints: { foot_distance: { target: 1, tolerance: 0.2 } },
  }));
  return {
    id: "synthetic",
    name: "Synthetic",
    description: "",
    cameraView: "side",
    checkpoints,
  };
}

const good = { type: "sample" as const, features: { foot_distance: 1 }, enoughSamples: true };

describe("drill state machine", () => {
  it.each([2, 5, 7])("runs %i checkpoints without a fixed count", (count) => {
    const drill = drillWith(count);
    let runtime = createDrillRuntime();
    expect(runtime.state).toBe("calibrating");
    runtime = stepDrill(runtime, drill, { type: "quality", ok: true });
    expect(runtime.state).toBe("ready");
    expect(runtime.startedAt).toBeUndefined();

    runtime = stepDrill(runtime, drill, { ...good, timeMs: 0 });
    expect(runtime.state).toBe("ready");

    let time = 0;
    for (let index = 0; index < count; index += 1) {
      time += 100;
      runtime = stepDrill(runtime, drill, { ...good, timeMs: time });
      if (index < count - 1) {
        expect(runtime.state).toBe("running");
        expect(runtime.checkpointIndex).toBe(index + 1);
        time += 1;
        runtime = stepDrill(runtime, drill, { ...good, timeMs: time });
        expect(runtime.match?.passed).toBe(false);
      }
    }
    expect(runtime.state).toBe("completed");
    expect(runtime.startedAt).toBe(100);
    expect(runtime.finishedAt).toBe(time);
    runtime = stepDrill(runtime, drill, { type: "retry" });
    expect(runtime.state).toBe("ready");
    expect(runtime.checkpointIndex).toBe(0);
    expect(runtime.startedAt).toBeUndefined();
  });
});
