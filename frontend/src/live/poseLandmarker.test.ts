import {afterEach, describe, expect, it, vi} from "vitest";
const mocks = vi.hoisted(() => ({create: vi.fn(), resolveFiles: vi.fn()}));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: {forVisionTasks: mocks.resolveFiles},
  PoseLandmarker: {createFromOptions: mocks.create},
}));
import {MediaPipeLivePose} from "./poseLandmarker";

afterEach(() => {vi.unstubAllGlobals(); vi.clearAllMocks();});
describe("pose detector lifecycle", () => {
  it("closes a detector that finishes initialising after the camera was stopped", async () => {
    let complete!: (value: unknown) => void;
    const close = vi.fn(), raf = vi.fn();
    mocks.resolveFiles.mockResolvedValue({});
    mocks.create.mockImplementation(() => new Promise(resolve => {complete = resolve;}));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("requestAnimationFrame", raf);
    const detector = new MediaPipeLivePose();
    const starting = detector.start({} as HTMLVideoElement);
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalled());
    detector.stop();
    complete({close});
    await starting;
    expect(close).toHaveBeenCalledTimes(1);
    expect(raf).not.toHaveBeenCalled();
  });
});
