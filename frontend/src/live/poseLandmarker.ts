import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { LANDMARK_NAMES, type RawPose, type Vec3 } from "./landmarks";

export interface LivePoseDetector {
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
  onPose(callback: (frame: RawPose) => void): void;
}

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

export class MediaPipeLivePose implements LivePoseDetector {
  private landmarker: PoseLandmarker | null = null;
  private callback: ((frame: RawPose) => void) | null = null;
  private raf = 0;
  private videoCallback = 0;
  private running = false;
  private lastVideoTime = -1;
  private lastTimestamp = -1;
  private video: FrameVideo | null = null;

  onPose(callback: (frame: RawPose) => void): void {
    this.callback = callback;
  }

  async start(video: HTMLVideoElement): Promise<void> {
    if (!this.landmarker) {
      const vision = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      }).catch(async () =>
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        }),
      );
    }
    this.running = true;
    this.lastVideoTime = -1;
    this.video = video as FrameVideo;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.video?.cancelVideoFrameCallback && this.videoCallback) {
      this.video.cancelVideoFrameCallback(this.videoCallback);
    }
    this.landmarker?.close();
    this.landmarker = null;
    this.video = null;
  }

  private schedule(): void {
    if (!this.running || !this.video) return;
    if (this.video.requestVideoFrameCallback) {
      this.videoCallback = this.video.requestVideoFrameCallback(() => this.tick());
    } else {
      this.raf = requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (!this.running || !this.video) return;
    const frame = this.read(this.video);
    if (frame) this.callback?.(frame);
    this.schedule();
  }

  private read(video: HTMLVideoElement): RawPose | null {
    if (!this.landmarker || video.readyState < 2) return null;
    if (video.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = video.currentTime;
    let timestamp = Math.round(performance.now());
    if (timestamp <= this.lastTimestamp) timestamp = this.lastTimestamp + 1;
    this.lastTimestamp = timestamp;
    const result = this.landmarker.detectForVideo(video, timestamp);
    const pose = result.landmarks?.[0];
    if (!pose || pose.length === 0) return null;
    const landmarks: RawPose["landmarks"] = {};
    pose.forEach((landmark, index) => {
      const name = LANDMARK_NAMES[index];
      if (!name) return;
      const visibility = landmark.visibility ?? 0;
      const point: Vec3 = { x: landmark.x, y: landmark.y, z: landmark.z, visibility };
      landmarks[name] = point;
    });
    return {
      timestampMs: timestamp,
      width: video.videoWidth || 1,
      height: video.videoHeight || 1,
      landmarks,
    };
  }
}
