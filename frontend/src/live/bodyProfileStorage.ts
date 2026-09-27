import type { BodyProfile } from "./anatomy";

const KEY = "hema-trainer.body-profile.v1";

export function loadBodyProfile(): BodyProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BodyProfile;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBodyProfile(profile: BodyProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Calibration still works for this session if storage is unavailable.
  }
}

export function clearBodyProfile(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore storage errors.
  }
}
