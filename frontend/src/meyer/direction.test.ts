import {describe, expect, it} from "vitest";
import type {RawPose} from "../live/landmarks";
import {SECTORS} from "./exercise";
import {HandDirectionDetector, classifyDirection, distinctDirection, type DirectionCalibration, type MotionVector} from "./direction";

function frame(t: number, x: number, y: number, visibility = 1, translation = 0): RawPose {
  const aspect = 1280 / 720;
  const point = (px: number, py: number) => ({x: px + translation, y: py, z: 0, visibility});
  return {timestampMs: t, width: 1280, height: 720, landmarks: {
    left_shoulder: point(.35, .35), right_shoulder: point(.65, .35),
    left_wrist: point(.485 + x * .3, .60 + y * .3 * aspect),
    right_wrist: point(.515 + x * .3, .60 + y * .3 * aspect),
  }};
}
function replay(dx: number, dy: number): MotionVector[] {
  const detector = new HandDirectionDetector(), found: MotionVector[] = [];
  for (let i = 0; i <= 18; i++) {
    const fraction = Math.min(1, i / 12);
    const event = detector.push(frame(i * 40, dx * fraction, dy * fraction));
    if (event) found.push(event);
  }
  return found;
}
describe("experimental personal wrist directions", () => {
  it("recognises four calibrated directions after whole movement, once each", () => {
    const vectors = [[.8,.65], [-.8,.65], [.8,-.65], [-.8,-.65]];
    const calibration: DirectionCalibration = {};
    vectors.forEach(([x,y], i) => {
      const events = replay(x,y);
      expect(events).toHaveLength(1);
      calibration[SECTORS[i]] = events[0];
      expect(events[0].dx).toBeCloseTo(x);
      expect(events[0].dy).toBeCloseTo(y);
    });
    SECTORS.forEach((sector, i) => expect(classifyDirection(calibration, replay(...vectors[i] as [number,number])[0])).toBe(sector));
    expect(distinctDirection(calibration, calibration["upper-left"]!)).toBe(false);
    expect(classifyDirection({}, calibration["upper-left"]!)).toBeNull();
    // A vertical, ambiguous movement must not be assigned to either diagonal.
    expect(classifyDirection(calibration, {dx: 0, dy: 1, onsetAt: 0, endAt: 500})).toBeNull();
  });
  it("does not accept jitter, whole-body translation, or tracking jumps", () => {
    const detector = new HandDirectionDetector();
    for (let i = 0; i < 100; i++) expect(detector.push(frame(i * 40, Math.sin(i) * .01, 0, 1, i * .001))).toBeNull();
    detector.reset();
    expect(detector.push(frame(0, 0, 0))).toBeNull();
    expect(detector.push(frame(40, 4, 4))).toBeNull();
    for (let i = 2; i < 10; i++) expect(detector.push(frame(i * 40, 4, 4))).toBeNull();
  });
  it("tracking loss and a long frame gap invalidate a partially seen movement", () => {
    for (const gap of [false, true]) {
      const detector = new HandDirectionDetector();
      for (let i = 0; i < 6; i++) detector.push(frame(i * 40, i * .08, i * .06));
      expect(detector.push(frame(gap ? 1200 : 240, .5, .4, gap ? 1 : .2))).toBeNull();
      for (let i = 0; i < 8; i++) expect(detector.push(frame(1300 + i * 40, .5, .4))).toBeNull();
    }
  });
  it("emits the completed swing when direction reverses, without requiring a pose hold", () => {
    const detector = new HandDirectionDetector();
    let event: MotionVector | null = null;
    for (let i = 0; i <= 12; i++) event = detector.push(frame(i * 40, i * .08, i * .06));
    expect(event).toBeNull();
    event = detector.push(frame(520, .88, .66));
    expect(event?.dx).toBeCloseTo(.96);
    expect(event?.dy).toBeCloseTo(.72);
  });
});
