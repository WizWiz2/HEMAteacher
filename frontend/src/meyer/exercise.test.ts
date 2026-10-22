import {describe, expect, it} from "vitest";
import {SERIES, advanceRun, beginRun, makeSequence, pauseRun, recordAttempt, resumeRun, showHints, tickRun} from "./exercise";

describe("Meyer exercise timing and sequences", () => {
  it("reads four rings in viewer coordinates; flow preserves ring boundaries", () => {
    expect(SERIES).toEqual([
      ["upper-right", "lower-left", "lower-right", "upper-left"],
      ["lower-left", "upper-right", "upper-left", "lower-right"],
      ["lower-right", "upper-left", "upper-right", "lower-left"],
      ["upper-left", "lower-right", "lower-left", "upper-right"],
    ]);
    expect(makeSequence("flow", 0, 2)).toEqual([...SERIES.flat(), ...SERIES.flat()]);
    expect(makeSequence("learn", 2, 2)).toEqual([...SERIES[2], ...SERIES[2]]);
  });
  it("random cues do not immediately repeat and memory actually removes hints", () => {
    const sequence = makeSequence("reaction", 0, 4, () => 0);
    expect(sequence).toHaveLength(16);
    expect(sequence.every((s, i) => i === 0 || s !== sequence[i - 1])).toBe(true);
    expect(showHints("memory", 0)).toEqual({current: true, next: true, numbers: true});
    expect(showHints("memory", 4)).toEqual({current: true, next: false, numbers: false});
    expect(showHints("memory", 8)).toEqual({current: false, next: false, numbers: false});
    expect(showHints("reaction", 0).next).toBe(false);
  });
  it("camera learning waits, timed flow advances without a burst after timer delay", () => {
    const started = tickRun(beginRun([...SERIES[0]], 0), 5000, 1000, true);
    expect(started.phase).toBe("running");
    expect(tickRun(started, 9000, 1000, true)).toBe(started);
    const advanced = tickRun(started, 9000, 1000, false);
    expect(advanced.index).toBe(1);
    expect(advanced.due).toBe(10000);
    expect(advanceRun({...started, index: 3}, 9000, 1000).phase).toBe("completed");
  });
  it("pause/resume discards movements begun before the resumed cue and allows retry after a wrong direction", () => {
    const started = tickRun(beginRun([...SERIES[0]], 0), 5000, 1000, false);
    const resumed = tickRun(resumeRun(pauseRun(started, 5500), 6000), 9000, 1000, false);
    expect(resumed.index).toBe(0);
    expect(recordAttempt(resumed, "upper-right", 8500)).toBe(resumed);
    const wrong = recordAttempt(resumed, "lower-left", 9100);
    expect(wrong.attempts[0].matched).toBe(false);
    const correct = recordAttempt(wrong, "upper-right", 9200);
    expect(correct.attempts[0]).toEqual({matched: true, reactionMs: 200});
    expect(recordAttempt(correct, "upper-right", 9300)).toBe(correct);
  });
});
