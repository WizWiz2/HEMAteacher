import { describe, expect, it } from "vitest";
import { loadMotionFixture } from "../../test-fixtures/loadFixture.mjs";
import { CONTINUOUS_DRILLS, clipFeatures, clipView, type FixtureClip } from "../drill/motionTraining";
import type { TimedFeatures } from "../drill/motionRecognition";
import { RepCounter, inEndZone, isStrike, looksLikeGuard, resampleTimed, strikeEnds, scoreSegment, similarityScore, summarize, type FollowRep } from "./repCounter";

const fixture = loadMotionFixture();
const features = new Map<string, TimedFeatures[]>();
const featuresOf = (c: FixtureClip) => {
  let f = features.get(c.id);
  if (!f) { f = clipFeatures(c, fixture.names); features.set(c.id, f); }
  return f;
};
const count = (c: FixtureClip, samples = featuresOf(c), drill = c.drill) => {
  const counter = new RepCounter(drill, clipView(c));
  for (const s of samples) counter.push({ timeMs: s.timeMs, features: s.features ?? null });
  return counter.reps;
};
const decimate = (samples: TimedFeatures[], step: number) => samples.filter((_, i) => i % step === 0);
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor((v.length - 1) / 2)];
const share = (clips: FixtureClip[], ok: (c: FixtureClip) => boolean) => clips.filter(ok).length / clips.length;

// Synthetic clips: guard -> one movement -> hold -> return to guard (strikes) / step back (footwork) -> hold.
const frontClips = fixture.clips.filter(c => c.move && CONTINUOUS_DRILLS.includes(c.drill) && (c.variant === "front:train" || c.variant === "front:test"));
const sideClips = fixture.clips.filter(c => c.move && CONTINUOUS_DRILLS.includes(c.drill) && (c.variant === "main" || c.variant.startsWith("heldout")));

describe("follow-along repetition counter", () => {
  it("counts one repetition per synthetic frontal clip and ignores the return", () => {
    expect(frontClips.length).toBeGreaterThan(50);
    expect(share(frontClips, c => count(c).length === 1)).toBeGreaterThanOrEqual(0.85);
  });

  it("counts one repetition per synthetic side clip", () => {
    expect(share(sideClips, c => count(c).length === 1)).toBeGreaterThanOrEqual(0.9);
  });

  it("counts every drill in the frontal view", () => {
    for (const drill of CONTINUOUS_DRILLS) {
      const clips = frontClips.filter(c => c.drill === drill);
      expect(share(clips, c => count(c).length === 1), drill).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("keeps counting at phone frame rates (10 and 5 fps)", () => {
    for (const step of [3, 6]) {
      expect(share(frontClips, c => count(c, decimate(featuresOf(c), step)).length === 1), `step ${step}`).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("counts repeated movements back to back", () => {
    const clips = frontClips.filter(c => c.variant === "front:test").slice(0, 8);
    const ok = clips.filter(c => {
      const s = featuresOf(c).filter(x => x.features), span = s.at(-1)!.timeMs - s[0].timeMs + 33;
      const twice = [...s, ...s.map(x => ({ ...x, timeMs: x.timeMs + span }))];
      return count(c, twice).length === 2;
    });
    expect(ok.length / clips.length).toBeGreaterThanOrEqual(0.75);
  });

  it("does not take a pose held at the end of a strike for the guard (counting started mid-loop, frontal)", () => {
    // Regression: a looping clip joined at the hold after the cut made the counter lock onto the end pose as the
    // guard, so every repetition was return + guard + cut and scored ~25 instead of ~90 (2 of 35 clips were fine).
    // Joining also lands on stops inside the movement (a pause in the zwerchhau wind-up, a stop on the way back) and
    // wind-ups that pass back through the guard (krumphau, zwerchhau): those must not split or shift the repetition.
    const strikes = frontClips.filter(c => isStrike(c.drill));
    const results = strikes.map(c => {
      const s = featuresOf(c).filter(x => x.features), span = s.at(-1)!.timeMs - s[0].timeMs + 33;
      const normal = count(c, s), best = normal.length ? Math.max(...normal.map(r => r.similarity)) : 0;
      const join = c.move![1] + 200;
      const loops = [0, 1, 2, 3].flatMap(k => s.map(x => ({ ...x, timeMs: x.timeMs + k * span })));
      const reps = count(c, loops.filter(x => x.timeMs >= join).map(x => ({ ...x, timeMs: x.timeMs - join })));
      // Every counted repetition scores like the clip started from the guard (no return + guard + cut segments).
      return { c, counted: normal.length > 0, ok: reps.length >= 2 && Math.min(...reps.map(r => r.similarity)) >= best - 10 };
    });
    // Clips the counter does not count from a normal start either (a movement below minExtent) say nothing here.
    const counted = results.filter(r => r.counted);
    expect(counted.length).toBeGreaterThanOrEqual(strikes.length - 2);
    const ok = (list: typeof results) => list.filter(r => r.ok).length / list.length;
    expect(ok(counted)).toBeGreaterThanOrEqual(0.9);
    for (const drill of ["zornhau", "zwerchhau", "schielhau", "scheitelhau", "krumphau"]) {
      const clips = counted.filter(r => r.c.drill === drill);
      expect(clips.filter(r => r.ok).length, drill).toBeGreaterThanOrEqual(clips.length - 1);
    }
    for (const drill of ["zornhau", "schielhau"]) expect(ok(counted.filter(r => r.c.drill === drill)), drill).toBe(1);
  });

  it("scores the whole frontal krumphau / zwerchhau cut, not just the wind-up through the guard", () => {
    for (const drill of ["krumphau", "zwerchhau"]) {
      const clips = frontClips.filter(c => c.drill === drill);
      const sims = clips.map(c => count(c)).filter(r => r.length === 1).map(r => r[0].similarity);
      expect(sims.length, drill).toBeGreaterThanOrEqual(clips.length - 1);
      expect(median(sims), drill).toBeGreaterThanOrEqual(85);
    }
  });

  it("only takes a guard-like pose as the guard (frontal strikes)", () => {
    for (const drill of ["zornhau", "zwerchhau", "schielhau", "scheitelhau", "krumphau"]) {
      const ends = strikeEnds(drill, "front");
      expect(ends.length, drill).toBeGreaterThan(0);
      for (const e of ends) { expect(looksLikeGuard(e.guard, ends), drill).toBe(true); expect(looksLikeGuard(e.end, ends), drill).toBe(false); }
    }
    // The top of the wind-up is not the end of the cut; the end of each reference cut is.
    for (const drill of ["zwerchhau", "krumphau"]) for (const e of strikeEnds(drill, "front")) expect(inEndZone(e.end, strikeEnds(drill, "front")), drill).toBe(true);
    expect(inEndZone([-0.55, 1.6], strikeEnds("zwerchhau", "front"))).toBe(false);
    // The zwerchhau reference cutting from the other side is left out of the guard check.
    expect(strikeEnds("zwerchhau", "front").every(e => e.guard[0] < 0)).toBe(true);
    expect(strikeEnds("zornhau", "side")).toEqual([]);
    expect(strikeEnds("advance", "front")).toEqual([]);
  });

  it("does not count standing still with landmark jitter", () => {
    const c = frontClips.find(x => x.drill === "zornhau")!;
    const still = featuresOf(c).find(x => x.features)!;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.02;
    const samples = Array.from({ length: 300 }, (_, i) => ({
      timeMs: i * 33,
      features: Object.fromEntries(Object.entries(still.features!).map(([k, v]) => [k, v + rnd()])),
    }));
    for (const drill of CONTINUOUS_DRILLS) expect(count(c, samples, drill).length, drill).toBe(0);
  });

  it("restarts after tracking is lost instead of counting across the gap", () => {
    const c = frontClips.find(x => x.drill === "zwerchhau")!;
    const s = featuresOf(c);
    const [a, b] = c.move!;
    const gapped = s.map(x => (x.timeMs > a + 100 && x.timeMs < b - 100 ? { ...x, features: undefined } : x));
    expect(count(c, gapped).length).toBe(0);
  });
});

describe("follow-along similarity", () => {
  // Leave-one-body-out: a clip is never compared with its own body's templates.
  const scoreOf = (c: FixtureClip, drill: string, samples?: TimedFeatures[]) => {
    const s = samples ?? featuresOf(c).filter(x => x.timeMs >= c.move![0] - 100 && x.timeMs <= c.move![1] + 250);
    return scoreSegment(drill, s, clipView(c), c.body)!.similarity;
  };
  const rivals = (drill: string) => CONTINUOUS_DRILLS.filter(d => d !== drill && isStrike(d) === isStrike(drill));

  it("is high for the drill being followed and clearly lower for another drill (synthetic frontal, held-out bodies)", () => {
    const test = frontClips.filter(c => c.variant === "front:test");
    const own = test.map(c => scoreOf(c, c.drill));
    const other = test.flatMap(c => rivals(c.drill).map(d => scoreOf(c, d)));
    expect(median(own)).toBeGreaterThanOrEqual(70);
    expect(median(own) - median(other)).toBeGreaterThanOrEqual(15);
  });

  it("does not collapse at a low camera frame rate", () => {
    const test = frontClips.filter(c => c.variant === "front:test" && isStrike(c.drill));
    const drop = test.map(c => {
      const s = featuresOf(c).filter(x => x.timeMs >= c.move![0] - 100 && x.timeMs <= c.move![1] + 250);
      return scoreOf(c, c.drill, s) - scoreOf(c, c.drill, decimate(s, 5));
    });
    expect(median(drop)).toBeLessThanOrEqual(10);
  });

  it("on real frontal reps of unseen people is lower but still ranks the followed drill first on average", () => {
    // Honest baseline: real people score ~40-60 against synthetic-heavy templates; the score is soft feedback only.
    const real = fixture.clips.filter(c => c.variant === "real:front");
    const own = real.map(c => scoreOf(c, c.drill));
    const other = real.flatMap(c => rivals(c.drill).map(d => scoreOf(c, d)));
    expect(median(own)).toBeGreaterThan(median(other));
    expect(median(own)).toBeLessThan(80);
  });

  it("maps distance monotonically to 0..100", () => {
    expect(similarityScore(0)).toBe(100);
    expect(similarityScore(1.5)).toBe(50);
    expect(similarityScore(3)).toBeLessThan(25);
    expect(similarityScore(Infinity)).toBe(0);
  });
});

describe("follow-along helpers", () => {
  it("re-samples low frame rates onto a 30 fps grid and leaves 30 fps alone", () => {
    const slow = [0, 200, 400].map(t => ({ timeMs: t, features: { a: t / 100 } }));
    const out = resampleTimed(slow, 1000 / 30);
    expect(out.length).toBe(13);
    expect(out[6].features!.a).toBeCloseTo(2, 1);
    const fast = Array.from({ length: 10 }, (_, i) => ({ timeMs: i * 33, features: { a: i } }));
    expect(resampleTimed(fast, 1000 / 30)).toBe(fast);
  });

  it("summarises a session and keeps only repeating hints", () => {
    const rep = (i: number, similarity: number, hint: string | null, consistency: number | null): FollowRep =>
      ({ index: i, startMs: 0, endMs: 1, similarity, distance: 1, tempo: 1, hint, consistency });
    const s = summarize([rep(1, 80, "A", null), rep(2, 70, "A", 90), rep(3, 60, "B", 80)]);
    expect(s).toEqual({ reps: 3, averageSimilarity: 70, best: 80, consistency: 85, hints: ["A"] });
    expect(summarize([]).reps).toBe(0);
  });
});
