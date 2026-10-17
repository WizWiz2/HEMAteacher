import type { Fixture } from "../src/drill/motionTraining";
import type { Drill } from "../src/drill/types";
export function loadMotionFixture(): Fixture;
export function loadDrills(): Drill[];
export function loadBladeDetections(): { version: number; source: string; clips: Record<string, number[][]> };
export function withBlade(fx: Fixture, minConfidence: number): Fixture;
