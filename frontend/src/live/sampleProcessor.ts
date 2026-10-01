import { assessFraming } from './framing';
import { liveFeatures, poseUsable } from './features';
import { normalizePose, torsoPixels, TorsoScale, type Facing, type CameraView } from './normalize';
import { smoothFeatures, trimHistory, type TimedSample } from './smoothing';
import type { RawPose } from './landmarks';
import type { TrackingMode } from '../drill/types';

/** Stateful preprocessing shared by live camera, replay and batch video tests. */
export class LiveSampleProcessor {
  readonly scale = new TorsoScale();
  private history: TimedSample[] = [];
  process(raw: RawPose, facing: Facing, trackingMode: TrackingMode, cameraView: CameraView, smoothingMs = 100) {
    const size = this.scale.push(torsoPixels(raw));
    const normalized = size ? normalizePose(raw, facing, size, .42, cameraView) : null;
    const features = normalized ? liveFeatures(normalized.landmarks) : null;
    if (features && size && raw.landmarks.left_hip?.visibility >= .42 && raw.landmarks.right_hip?.visibility >= .42)
      features.root_x = (raw.landmarks.left_hip.x + raw.landmarks.right_hip.x) * .5 * raw.width / size * (facing === "right" ? 1 : -1);
    this.history = trimHistory([...this.history, {timeMs: raw.timestampMs, features}], raw.timestampMs);
    const smoothed = smoothFeatures(this.history, raw.timestampMs, smoothingMs, 3, trackingMode);
    const framing = assessFraming(raw, trackingMode);
    const motionFraming = assessFraming(raw, trackingMode, true);
    return {cameraView, timeMs: raw.timestampMs, raw, normalized, features, smoothed: smoothed.features,
      enough: smoothed.enough, usable: poseUsable(features, trackingMode) && framing.ready, motionUsable: poseUsable(features, trackingMode) && motionFraming.ready, framing, motionFraming, weapon: null};
  }
}
