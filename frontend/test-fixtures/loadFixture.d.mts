import type { Fixture } from "../src/drill/motionTraining";
import type { Drill } from "../src/drill/types";
export function loadMotionFixture(): Fixture;
export function loadDrills(): Drill[];
export function loadFollowRecording(name: string): { timeMs: number; features: Record<string, number | null> | null }[];
