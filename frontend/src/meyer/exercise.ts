export type Sector = "upper-left" | "upper-right" | "lower-left" | "lower-right";
export type MeyerMode = "learn" | "flow" | "memory" | "reaction";

// Screen coordinates: the opponent's left opening appears on the viewer's right.
// The four number rings of Meyer's 1570 four-openings diagram, read from outside in.
export const SERIES: readonly (readonly Sector[])[] = [
  ["upper-right", "lower-left", "lower-right", "upper-left"],
  ["lower-left", "upper-right", "upper-left", "lower-right"],
  ["lower-right", "upper-left", "upper-right", "lower-left"],
  ["upper-left", "lower-right", "lower-left", "upper-right"],
];
export const SECTORS: readonly Sector[] = ["upper-left", "upper-right", "lower-left", "lower-right"];
export const LABELS: Record<Sector, string> = {
  "upper-left": "Верхний левый", "upper-right": "Верхний правый",
  "lower-left": "Нижний левый", "lower-right": "Нижний правый",
};
export const ARROWS: Record<Sector, string> = {
  "upper-left": "↖", "upper-right": "↗", "lower-left": "↙", "lower-right": "↘",
};

export function makeSequence(mode: MeyerMode, series: number, rounds: number, random = Math.random): Sector[] {
  const base = mode === "flow" ? SERIES.flat() : SERIES[Math.max(0, Math.min(3, series))];
  if (mode !== "reaction") return Array.from({length: rounds}, () => base).flat();
  const result: Sector[] = [];
  for (let i = 0; i < rounds * 4; i++) {
    const pool = SECTORS.filter(s => s !== result[i - 1]);
    result.push(pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]);
  }
  return result;
}

export function showHints(mode: MeyerMode, index: number): {current: boolean; next: boolean; numbers: boolean} {
  if (mode === "memory") return {current: index < 8, next: index < 4, numbers: index < 4};
  return {current: true, next: mode !== "reaction", numbers: mode === "learn"};
}

export interface Attempt {matched: boolean; reactionMs?: number}
export interface Run {
  phase: "ready" | "countdown" | "running" | "paused" | "completed";
  sequence: Sector[];
  index: number;
  due: number;
  promptAt: number;
  remaining: number;
  attempts: Record<number, Attempt>;
}
export function emptyRun(): Run {
  return {phase: "ready", sequence: [], index: 0, due: 0, promptAt: 0, remaining: 0, attempts: {}};
}
export function beginRun(sequence: Sector[], now: number): Run {
  return {...emptyRun(), phase: "countdown", sequence, due: now + 5000};
}
export function advanceRun(run: Run, now: number, beat: number): Run {
  if (run.phase !== "running") return run;
  if (run.index + 1 >= run.sequence.length) return {...run, phase: "completed"};
  return {...run, index: run.index + 1, promptAt: now, due: now + beat};
}
export function tickRun(run: Run, now: number, beat: number, waitForMovement: boolean): Run {
  if (run.phase === "countdown" && now >= run.due) return {...run, phase: "running", promptAt: now, due: now + beat};
  if (run.phase === "running" && !waitForMovement && now >= run.due) return advanceRun(run, now, beat);
  return run;
}
export function pauseRun(run: Run, now: number): Run {
  return run.phase === "running" || run.phase === "countdown"
    ? {...run, phase: "paused", remaining: Math.max(0, run.due - now)} : run;
}
export function resumeRun(run: Run, now: number): Run {
  // Restart the current cue after a fresh countdown; movement during a pause cannot count.
  return run.phase === "paused" ? {...run, phase: "countdown", due: now + 3000} : run;
}
export function recordAttempt(run: Run, sector: Sector, onsetAt: number): Run {
  if (run.phase !== "running" || onsetAt < run.promptAt || run.attempts[run.index]?.matched) return run;
  const matched = sector === run.sequence[run.index];
  return {...run, attempts: {...run.attempts, [run.index]: {matched, reactionMs: matched ? onsetAt - run.promptAt : undefined}}};
}
