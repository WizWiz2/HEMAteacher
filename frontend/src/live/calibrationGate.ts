import { BodyProfileCalibrator, profileCoverage, type BodyProfile } from './anatomy';
import type { TrackingMode } from '../drill/types';
import type { LiveSample } from './useLivePose';

export class CalibrationGate {
  private calibrator = new BodyProfileCalibrator();
  private since: number | null = null;
  refined = false;
  profile: BodyProfile | null = null;
  reset() { this.calibrator.reset(); this.since = null; this.refined = false; this.profile = null; }
  push(sample: LiveSample, mode: TrackingMode, previous: BodyProfile | null = null) {
    if (sample.normalized && sample.framing.ready && !this.refined) {
      this.calibrator.push(sample.normalized, sample.cameraView);
      if (this.calibrator.ready(mode, 6)) {
        // Do not blend a newly measured side-view profile with old depth-inflated lengths.
        this.profile = this.calibrator.build(sample.cameraView === "side" ? null : previous);
        this.refined = profileCoverage(this.profile, mode) >= .8;
      }
    }
    if (sample.usable && this.refined) this.since ??= sample.timeMs;
    else this.since = null;
    return this.since !== null && sample.timeMs - this.since >= 450;
  }
}
