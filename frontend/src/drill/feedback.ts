import type { CheckpointMatch } from "./types";

const CUES: Record<string, { high: string; low: string }> = {
  foot_distance: { high: "СВЕДИ СТОПЫ", low: "РАЗВЕДИ СТОПЫ" },
  pelvis_height: { high: "ОПУСТИ ТАЗ", low: "ПРИПОДНИМИ ТАЗ" },
  torso_angle: { high: "КОРПУС ЧУТЬ НАЗАД", low: "КОРПУС ЧУТЬ ВПЕРЁД" },
  left_ankle_x: { high: "ЛЕВАЯ СТОПА БЛИЖЕ", low: "ЛЕВАЯ СТОПА ДАЛЬШЕ" },
  right_ankle_x: { high: "ПРАВАЯ СТОПА БЛИЖЕ", low: "ПРАВАЯ СТОПА ДАЛЬШЕ" },
  left_knee_angle: { high: "СОГНИ ЛЕВОЕ КОЛЕНО", low: "РАЗОГНИ ЛЕВОЕ КОЛЕНО" },
  right_knee_angle: { high: "СОГНИ ПРАВОЕ КОЛЕНО", low: "РАЗОГНИ ПРАВОЕ КОЛЕНО" },
  knee_over_foot_left: { high: "ЛЕВОЕ КОЛЕНО НАЗАД", low: "ЛЕВОЕ КОЛЕНО ВПЕРЁД" },
  knee_over_foot_right: { high: "ПРАВОЕ КОЛЕНО НАЗАД", low: "ПРАВОЕ КОЛЕНО ВПЕРЁД" },
  hand_center_x: { high: "РУКИ ЧУТЬ НАЗАД", low: "РУКИ ДАЛЬШЕ ВПЕРЁД" },
  hand_center_y: { high: "ОПУСТИ РУКИ", low: "ПОДНИМИ РУКИ ВЫШЕ" },
  hand_distance: { high: "СВЕДИ КИСТИ", low: "РАЗВЕДИ КИСТИ" },
  left_elbow_angle: { high: "СОГНИ ЛЕВЫЙ ЛОКОТЬ", low: "РАЗОГНИ ЛЕВЫЙ ЛОКОТЬ" },
  right_elbow_angle: { high: "СОГНИ ПРАВЫЙ ЛОКОТЬ", low: "РАЗОГНИ ПРАВЫЙ ЛОКОТЬ" },
};

export interface LiveCue { name: string; ok: boolean; text: string; gap: number; }

export function liveCues(match: CheckpointMatch | null, limit = 3): LiveCue[] {
  if (!match) return [];
  const rows = Object.entries(match.features).map(([name, feature]) => ({
    name,
    ok: feature.passed,
    gap: normalizedGap(feature.delta, feature.closeness),
    text: feature.passed ? passLabel(name) : failLabel(name, feature.delta),
  }));
  const fails = rows.filter((row) => !row.ok).sort((a, b) => b.gap - a.gap);
  const passes = rows.filter((row) => row.ok);
  return [...fails, ...passes].slice(0, limit);
}

export function primaryCue(match: CheckpointMatch | null): LiveCue | null {
  return liveCues(match, 1)[0] ?? null;
}

function normalizedGap(delta: number | undefined, closeness: number | undefined) {
  if (typeof closeness === "number") return 1 - closeness;
  return Math.abs(delta ?? 0);
}

function passLabel(name: string): string {
  const labels: Record<string, string> = {
    foot_distance: "СТОПЫ · ХОРОШО", pelvis_height: "ТАЗ · ХОРОШО", torso_angle: "КОРПУС · ХОРОШО",
    left_ankle_x: "ЛЕВАЯ СТОПА · ХОРОШО", right_ankle_x: "ПРАВАЯ СТОПА · ХОРОШО",
    left_knee_angle: "ЛЕВОЕ КОЛЕНО · ХОРОШО", right_knee_angle: "ПРАВОЕ КОЛЕНО · ХОРОШО",
    hand_center_x: "РУКИ · ХОРОШО", hand_center_y: "ВЫСОТА РУК · ХОРОШО", hand_distance: "КИСТИ · ХОРОШО",
    left_elbow_angle: "ЛЕВЫЙ ЛОКОТЬ · ХОРОШО", right_elbow_angle: "ПРАВЫЙ ЛОКОТЬ · ХОРОШО",
  };
  return labels[name] ?? "ПОЗА · ХОРОШО";
}

function failLabel(name: string, delta: number | undefined): string {
  const cue = CUES[name];
  if (!cue || delta == null || !Number.isFinite(delta)) return "ПОПРАВЬ ПОЗУ";
  return delta > 0 ? cue.high : cue.low;
}
