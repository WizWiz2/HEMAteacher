import {describe, expect, it, vi} from "vitest";
import {listCameras, openCameraStream} from "./cameraStream";

const failure = (name: string) => new DOMException("Test camera failure", name);
function stream() {const stop = vi.fn(); return {getTracks: () => [{stop}], stop} as unknown as MediaStream & {stop: ReturnType<typeof vi.fn>};}
const device = (id: string) => ({kind: "videoinput", deviceId: id, label: id}) as MediaDeviceInfo;

describe("camera recovery", () => {
  it("recovers from NotReadableError by relaxing facing mode and resolution", async () => {
    const video = stream();
    const getUserMedia = vi.fn().mockRejectedValueOnce(failure("NotReadableError"))
      .mockRejectedValueOnce(failure("NotReadableError")).mockResolvedValueOnce(video);
    const pause = vi.fn().mockResolvedValue(undefined);
    const media = {getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([])};
    expect(await openCameraStream("user", "", media, () => true, pause)).toBe(video);
    expect(getUserMedia.mock.calls.map(([c]) => c.video)).toEqual([
      {facingMode: {exact: "user"}, width: {ideal: 640}, height: {ideal: 480}},
      {facingMode: {ideal: "user"}, width: {ideal: 640}, height: {ideal: 480}}, {},
    ]);
    expect(pause).toHaveBeenCalledTimes(2);
  });
  it("tries a second device when the browser's default device cannot open", async () => {
    const video = stream();
    const getUserMedia = vi.fn().mockRejectedValue(failure("NotReadableError"))
      .mockRejectedValueOnce(failure("OverconstrainedError"))
      .mockRejectedValueOnce(failure("NotReadableError"))
      .mockRejectedValueOnce(failure("NotReadableError"))
      .mockRejectedValueOnce(failure("NotReadableError"))
      .mockResolvedValueOnce(video);
    const media = {getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([device("virtual"), device("webcam")])};
    expect(await openCameraStream("user", "", media, () => true, async () => {})).toBe(video);
    expect(getUserMedia).toHaveBeenLastCalledWith({audio: false, video: {deviceId: {exact: "webcam"}}});
  });
  it("retains an explicitly selected device through constraint fallback", async () => {
    const video = stream();
    const media = {getUserMedia: vi.fn().mockRejectedValueOnce(failure("OverconstrainedError")).mockResolvedValue(video), enumerateDevices: vi.fn()};
    expect(await openCameraStream("user", "chosen", media)).toBe(video);
    expect(media.getUserMedia).toHaveBeenLastCalledWith({audio: false, video: {deviceId: {exact: "chosen"}}});
    expect(media.enumerateDevices).not.toHaveBeenCalled();
  });
  it("does not retry a permission denial", async () => {
    const denied = failure("NotAllowedError");
    const media = {getUserMedia: vi.fn().mockRejectedValue(denied), enumerateDevices: vi.fn()};
    await expect(openCameraStream("user", "", media)).rejects.toBe(denied);
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });
  it("stops a late stream after navigation instead of leaving the camera occupied", async () => {
    const video = stream(); let current = true;
    const media = {getUserMedia: vi.fn(async () => {current = false; return video;}), enumerateDevices: vi.fn()};
    await expect(openCameraStream("user", "", media, () => current)).rejects.toMatchObject({name: "AbortError"});
    expect(video.stop).toHaveBeenCalledTimes(1);
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });
  it("does not retry if navigation cancelled an unsuccessful request", async () => {
    let current = true;
    const media = {getUserMedia: vi.fn(async () => {current = false; throw failure("NotReadableError");}), enumerateDevices: vi.fn()};
    await expect(openCameraStream("user", "", media, () => current)).rejects.toMatchObject({name: "NotReadableError"});
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });
  it("does not discard the original device error if enumeration fails", async () => {
    const error = failure("NotReadableError");
    const media = {getUserMedia: vi.fn().mockRejectedValue(error), enumerateDevices: vi.fn().mockRejectedValue(failure("SecurityError"))};
    await expect(openCameraStream("user", "", media, () => true, async () => {})).rejects.toBe(error);
    expect(await listCameras(media)).toEqual([]);
  });
});
