import { poseUsable, type FeatureMap } from "./features";

export interface TimedSample {
  timeMs: number;
  features: FeatureMap | null;
}

export interface SmoothedSample {
  features: FeatureMap | null;
  enough: boolean;
}

/** Медиана за окно. Один выброс не сдвигает устойчивую позу. */
export function smoothFeatures(history: TimedSample[], nowMs: number, windowMs = 300, minimumSamples = 4): SmoothedSample {
  const recent = history.filter((sample) => nowMs - sample.timeMs <= windowMs && nowMs >= sample.timeMs);
  const usable = recent.filter((sample) => poseUsable(sample.features));
  if (usable.length < minimumSamples) return { features: null, enough: false };
  const keys = new Set<string>();
  for (const sample of usable) {
    for (const key of Object.keys(sample.features ?? {})) keys.add(key);
  }
  const features: FeatureMap = {};
  for (const key of keys) {
    const values = usable
      .map((sample) => sample.features?.[key as keyof FeatureMap])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .sort((a, b) => a - b);
    if (values.length < minimumSamples) continue;
    features[key as keyof FeatureMap] = values[Math.floor((values.length - 1) / 2)];
  }
  return { features, enough: poseUsable(features) };
}

export function trimHistory(history: TimedSample[], nowMs: number, keepMs = 1000): TimedSample[] {
  return history.filter((sample) => nowMs - sample.timeMs <= keepMs);
}
