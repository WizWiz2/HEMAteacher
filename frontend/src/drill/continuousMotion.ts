import patternsData from './motionPatterns.json';
import modelData from './motionModel.json';
import type { DrillRuntime } from './types';
import { decide, type RecognitionModel, type TimedFeatures } from './motionRecognition';

interface Template { body: string; frames: number[][] }
interface Pattern { features: string[]; minMs: number; maxMs: number; templates: Template[] }
export interface MotionSample { timeMs: number; vector: number[]; features?: Record<string, number> }
export interface MotionAttempt {
  phase: 'position' | 'armed' | 'moving' | 'failed' | 'passed';
  message: string;
  baseline?: number[];
  last?: MotionSample;
  samples: MotionSample[];
  settledSince?: number;
  similarity?: number;
  stages?: number[];
  feedback?: string[];
  outcome?: 'recognized' | 'incomplete' | 'tracking_lost' | 'other_drill';
  /** Drill the movement was recognised as, when it was not the selected one. */
  lookedLike?: string;
  /** The last settle was not a recognisable whole movement: wait for more movement before re-checking. */
  awaitMove?: boolean;
  tempo?: number;
  /** Settle time at which the selected drill's whole movement was already observed (ambiguous, kept open): the tempo
   *  of a later acceptance is measured up to here, so the continuation (e.g. the return) does not count as slowness. */
  completeAt?: number;
  /** Burst detection: peak activity speed of the current burst, start of the current low-activity stretch, start of
   *  the current burst. */
  peak?: number;
  quietSince?: number;
  burstAt?: number;
}
const patterns: Record<string, Pattern> = patternsData;
export const motionPatternFor = (id: string) => patterns[id];
let model = modelData as unknown as RecognitionModel;
/** Swap the recognition model (template evaluation and tests). */
export function setRecognitionModel(next: RecognitionModel) { model = next; }
export function recognitionModel() { return model; }
export const DRILL_NAMES: Record<string, string> = {
  zornhau: 'Zornhau', scheitelhau: 'Scheitelhau', krumphau: 'Krumphau', zwerchhau: 'Zwerchhau', schielhau: 'Schielhau',
  advance: 'шаг вперёд', retreat: 'шаг назад', 'passing-step-forward': 'проходной шаг вперёд', 'passing-step-backward': 'проходной шаг назад',
};
/** Sanity bound for one attempt (time-invariant matching replaces the old 4 s limit). */
export const MAX_ATTEMPT_MS = 10000;
/** Largest tolerated gap between pose frames inside an attempt. */
export const MAX_GAP_MS = 400;
const PRE_ROLL_MS = 300;
const JUMP_HAND = .6, JUMP_FEET = .3;
const extentOf = (pattern: Pattern) => Math.min(...pattern.templates.map(t => Math.max(...t.frames.map(v => distance(v, t.frames[0])))));
const distance = (a: number[], b: number[]) => Math.sqrt(a.reduce((sum,x,i)=>sum+(x-b[i])**2,0)/a.length);

export function trajectoryError(samples: MotionSample[], reference: number[][]): number {
  // Time-resample first: frames duplicated by a slow camera cannot dominate DTW.
  const start=samples[0].timeMs, end=samples.at(-1)!.timeMs;
  if(end<=start)return Infinity;
  let index=0;
  const points=reference.map((_,i)=>{
    const t=start+(end-start)*i/(reference.length-1);
    while(index<samples.length-2 && samples[index+1].timeMs<t)index++;
    const a=samples[index],b=samples[Math.min(index+1,samples.length-1)];
    const ratio=b.timeMs===a.timeMs?0:(t-a.timeMs)/(b.timeMs-a.timeMs);
    return a.vector.map((v,j)=>v+(b.vector[j]-v)*ratio);
  });
  const n=reference.length;
  const costs=Array.from({length:n+1},()=>Array(n+1).fill(Infinity));costs[0][0]=0;
  for(let i=1;i<=n;i++)for(let j=Math.max(1,i-5);j<=Math.min(n,i+5);j++)
    costs[i][j]=distance(points[i-1],reference[j-1])+Math.min(costs[i-1][j],costs[i][j-1],costs[i-1][j-1]);
  return costs[n][n]/n;
}

/** Attempt detection. "settle" (original): arm on a stable start pose (strikes: hands above .55 torso), decide after a
 *  200 ms pause. "burst": arm on any tracked pose; an attempt starts when the drill's activity speed (hands for strikes,
 *  feet/root for steps; torso lengths per second, i.e. body-scale normalised) exceeds onHand/onFeet, and ends when it
 *  stays below max(off*, offRel x the burst's peak) for holdMs, or after maxBurstMs. Too small a burst (excursion,
 *  moving frames, minMs) is dropped without failing; an attempt judged incomplete waits up to mergeWaitMs for the next
 *  burst and is re-judged; any other undecided attempt is dropped and detection re-arms.
 *  Phase 5 default: settle (with the real-shape strike templates it beats burst on synthetic and seen real clips). */
export const DETECT = { mode: 'settle' as 'settle' | 'burst', onHand: .35, onFeet: .25, offHand: .15, offFeet: .1, offRel: .15,
  holdMs: 200, maxBurstMs: 3000, speedWindowMs: 100, armMs: 200, mergeWaitMs: 1000, keepMs: 600, mergeUnknown: false, mergeMaxMs: 4000, otherFails: true };
const finiteN = (x: number | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
const activityOf = (id: string, f?: Record<string, number>) =>
  id.endsWith('hau') ? [f?.action_hand_x, f?.action_hand_y] : [f?.left_ankle_x, f?.right_ankle_x, f?.root_x];
function activitySpeed(id: string, history: MotionSample[], now: MotionSample): number {
  let ref: MotionSample | undefined;
  for (let i = history.length - 1; i >= 0; i--) if (now.timeMs - history[i].timeMs >= DETECT.speedWindowMs) { ref = history[i]; break; }
  if (!ref) return 0;
  const a = activityOf(id, now.features), b = activityOf(id, ref.features);
  if (!a.every(finiteN) || !b.every(finiteN)) return 0;
  const d = id.endsWith('hau') ? Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!) : Math.max(...a.map((x, i) => Math.abs(x! - b[i]!)));
  return d / ((now.timeMs - ref.timeMs) / 1000);
}
function rearm(runtime: DrillRuntime, sample: MotionSample, history: MotionSample[]): DrillRuntime {
  return {...runtime, state: 'ready', checkpointIndex: 0, startedAt: undefined, validSince: null, match: null,
    motion: {phase: 'armed', message: 'Готов. Выполни движение целиком', baseline: sample.vector, last: sample,
      samples: history.filter(s => s.timeMs >= sample.timeMs - DETECT.keepMs)}};
}
function stepBurst(runtime: DrillRuntime, attempt: MotionAttempt, id: string, pattern: Pattern, sample: MotionSample, count: number): DrillRuntime {
  const timeMs = sample.timeMs, strike = id.endsWith('hau');
  if (attempt.phase === 'position') {
    const since = runtime.validSince ?? timeMs, history = [...attempt.samples, sample].filter(s => s.timeMs >= timeMs - DETECT.keepMs);
    if (timeMs - since < DETECT.armMs) return {...runtime, validSince: since, match: null, motion: {phase: 'position', message: 'Прими исходную позицию', baseline: sample.vector, last: sample, samples: history}};
    return rearm({...runtime, validSince: since}, sample, history);
  }
  if (attempt.phase === 'armed') {
    const history = [...attempt.samples, sample].filter(s => s.timeMs >= timeMs - DETECT.keepMs);
    const speed = activitySpeed(id, attempt.samples, sample);
    if (speed < (strike ? DETECT.onHand : DETECT.onFeet))
      return {...runtime, motion: {...attempt, baseline: speed < .5 * (strike ? DETECT.onHand : DETECT.onFeet) ? sample.vector : attempt.baseline, last: sample, samples: history}};
    if (distance(sample.vector, attempt.last!.vector) > (strike ? JUMP_HAND : JUMP_FEET) && timeMs - attempt.last!.timeMs < 180) return rearm(runtime, sample, [sample]);
    const preRoll = history.filter(s => s.timeMs >= timeMs - PRE_ROLL_MS);
    return {...runtime, state: 'running', startedAt: preRoll[0].timeMs, validSince: null, checkpointIndex: 1,
      motion: {...attempt, phase: 'moving', message: 'Двигайся без остановок', samples: preRoll, last: sample, peak: speed, quietSince: undefined, burstAt: timeMs, awaitMove: false}};
  }
  const startedAt = runtime.startedAt!;
  const samples = [...attempt.samples, sample].slice(-600);
  const speed = activitySpeed(id, attempt.samples, sample);
  const on = strike ? DETECT.onHand : DETECT.onFeet, off = strike ? DETECT.offHand : DETECT.offFeet;
  if (attempt.awaitMove) {
    // judged incomplete: wait for the next burst (same attempt), else drop it and re-arm
    if (speed >= on) return {...runtime, motion: {...attempt, samples, last: sample, awaitMove: false, peak: speed, quietSince: undefined, burstAt: timeMs, message: 'Двигайся без остановок'}};
    if (timeMs - (attempt.quietSince ?? timeMs) > DETECT.mergeWaitMs) return rearm(runtime, sample, samples);
    return {...runtime, motion: {...attempt, samples, last: sample}};
  }
  if (timeMs - startedAt > MAX_ATTEMPT_MS) return rearm(runtime, sample, samples);
  const peak = Math.max(attempt.peak ?? 0, speed);
  const quiet = speed < Math.max(off, DETECT.offRel * peak);
  const quietSince = quiet ? (attempt.quietSince ?? timeMs) : undefined;
  const ended = (quietSince !== undefined && timeMs - quietSince >= DETECT.holdMs) || timeMs - (attempt.burstAt ?? startedAt) >= DETECT.maxBurstMs;
  const extent = extentOf(pattern);
  const excursion = Math.max(...samples.map(s => distance(s.vector, attempt.baseline!)));
  const progressIndex = Math.max(runtime.checkpointIndex, excursion > extent * .6 ? Math.min(2, count - 1) : 1);
  if (!ended) return {...runtime, checkpointIndex: progressIndex, motion: {...attempt, samples, last: sample, peak, quietSince, message: 'Двигайся без остановок'}};
  const movingFrames = samples.filter((s, i) => i > 0 && distance(s.vector, samples[i - 1].vector) > .015).length;
  const crossed = !id.startsWith('passing') || (attempt.baseline![0] - attempt.baseline![1]) * (sample.vector[0] - sample.vector[1]) < 0 && Math.abs(sample.vector[0] - sample.vector[1]) > .2;
  const big = movingFrames >= 4 && excursion > Math.max(.08, extent * .45) && timeMs - startedAt >= pattern.minMs;
  if (!big) return rearm(runtime, sample, samples);
  const decision = crossed ? decide(id, samples as TimedFeatures[], model) : {kind: 'unknown' as const, incomplete: 'stance' as const};
  if (decision.kind === 'accepted') {
    const feedback = motionFeedback(id, samples, pattern);
    if (decision.slow) feedback.unshift(`Движение распознано, но выполнено слишком медленно (примерно в ${decision.tempo.toFixed(1)} раза дольше образцов). Попробуй выполнить его слитно, без пауз.`);
    return {...runtime, state: 'completed', checkpointIndex: count - 1, finishedAt: timeMs, validSince: null, match: null,
      motion: {...attempt, phase: 'passed', samples, last: sample, similarity: decision.similarity, tempo: decision.tempo, message: 'Движение распознано', outcome: 'recognized', feedback: feedback.slice(0, 2)}};
  }
  if (decision.kind === 'other' && !DETECT.otherFails) return rearm(runtime, sample, samples);
  if (decision.kind === 'other')
    return {...runtime, state: 'failed', finishedAt: timeMs, match: null, validSince: null,
      motion: {...attempt, phase: 'failed', samples, last: sample, lookedLike: decision.drill, outcome: 'other_drill',
        message: `Похоже на ${DRILL_NAMES[decision.drill] ?? decision.drill}, а не ${DRILL_NAMES[id] ?? id}. Повтори выбранное движение`}};
  if (decision.incomplete || (decision.kind === 'unknown' && decision.complete) || (DETECT.mergeUnknown && !decision.ignored && timeMs - startedAt < DETECT.mergeMaxMs))
    return {...runtime, checkpointIndex: progressIndex, motion: {...attempt, samples, last: sample, peak, quietSince: timeMs, awaitMove: true, message: 'Продолжай движение до конца'}};
  return rearm(runtime, sample, samples);
}

export function stepContinuous(runtime: DrillRuntime, id: string, timeMs: number,
  features: Record<string,number> | null, enough: boolean, count: number): DrillRuntime {
  const pattern=patterns[id];
  let attempt=runtime.motion ?? {phase:'position' as const,message:'Прими исходную позицию',samples:[]};
  if(attempt.phase==='failed' || attempt.phase==='passed')return runtime;
  const fail=(message:string):DrillRuntime=>({...runtime,state:'failed',finishedAt:timeMs,match:null,validSince:null,
    motion:{...attempt,phase:'failed',message,outcome:message.includes('Камера') || message.includes('кадров') || message.includes('перескочила') ? 'tracking_lost' : 'incomplete'}});
  if(attempt.last && timeMs<=attempt.last.timeMs)return runtime;
  const vector=pattern.features.map(name=>features?.[name] ?? NaN);
  if(!enough || !vector.every(Number.isFinite)) {
    if(attempt.phase==='moving' && attempt.last && timeMs-attempt.last.timeMs>MAX_GAP_MS)return fail('Камера потеряла движение. Повтори попытку');
    return {...runtime,validSince:null,motion:attempt.phase==='moving'?{...attempt,message:'Покажи камере руки и стопы'}:{phase:'position',samples:[],message:'Покажи камере руки и стопы'}};
  }
  if(attempt.last && timeMs-attempt.last.timeMs>MAX_GAP_MS) {
    if(attempt.phase==='moving')return fail('Слишком большой разрыв кадров. Повтори попытку');
    attempt={phase:'position',message:'Прими исходную позицию',samples:[]};
  }
  const sample={timeMs,vector,features:features ?? undefined};
  if(DETECT.mode==='burst')return stepBurst(runtime,attempt,id,pattern,sample,count);
  if(attempt.phase==='position') {
    const nearStart=!id.endsWith('hau') || vector[1] > .55;
    const stable=!attempt.last || distance(vector,attempt.last.vector)<.035;
    const since=nearStart&&stable?(runtime.validSince??timeMs):null;
    const armed=since!==null && timeMs-since>=200;
    return {...runtime,validSince:since,match:null,motion:{phase:armed?'armed':'position',message:armed?'Готов. Выполни движение целиком':'Прими исходную позицию',baseline:vector,last:sample,samples:[]}};
  }
  if(attempt.phase==='armed') {
    // keep a short pre-roll: onset is detected only after the pose has left the baseline, but the movement's start
    // (windup, weight shift) belongs to the attempt for recognition.
    const preRoll=[...attempt.samples.filter(s=>s.timeMs>=timeMs-PRE_ROLL_MS),attempt.last!].filter((s,i,a)=>a.indexOf(s)===i);
    if(distance(vector,attempt.baseline!)<.045)return {...runtime,motion:{...attempt,last:sample,samples:preRoll}};
    // A landmark teleport (e.g. a left/right ankle swap) at onset, not a fast but real movement: bounded in torso
    // lengths per frame rather than by the template extent (a quick step moves the feet ~0.15 torso per frame).
    if(distance(vector,attempt.last!.vector)>(id.endsWith('hau')?JUMP_HAND:JUMP_FEET) && timeMs-attempt.last!.timeMs<180)return fail('Поза резко перескочила. Повтори движение перед камерой');
    attempt={...attempt,phase:'moving',message:'Двигайся без остановок',samples:[...preRoll,sample],last:sample};
    return {...runtime,state:'running',startedAt:attempt.samples[0].timeMs,validSince:null,checkpointIndex:1,motion:attempt};
  }
  const startedAt=runtime.startedAt!;
  if(timeMs-startedAt>MAX_ATTEMPT_MS)return fail('Слишком долго: попытка длиннее 10 секунд. Выполни одно движение целиком');
  const samples=[...attempt.samples,sample].slice(-600);
  // Estimate settling over a camera-time window: single-frame wrist jitter
  // must not keep an otherwise finished movement running indefinitely.
  const anchor=samples.find(s=>s.timeMs>=timeMs-200) ?? attempt.last!;
  const speed=distance(vector,anchor.vector)/Math.max(1,timeMs-anchor.timeMs)*1000;
  const extent=extentOf(pattern);
  // Excursion prevents a frozen pose or an almost stationary wobble from being judged at all.
  const excursion=Math.max(...samples.map(s=>distance(s.vector,attempt.baseline!)));
  const movingFrames=samples.filter((s,i)=>i>0 && distance(s.vector,samples[i-1].vector)>.015).length;
  const crossed=!id.startsWith('passing') || (attempt.baseline![0]-attempt.baseline![1])*(vector[0]-vector[1])<0 && Math.abs(vector[0]-vector[1])>.2;
  const awaitMove=attempt.awaitMove===true && speed<1;
  const canFinish=!awaitMove && crossed && movingFrames>=4 && excursion>Math.max(.08,extent*.45);
  const settledSince=canFinish&&speed<.65?(attempt.settledSince??timeMs):undefined;
  const progressIndex=Math.max(runtime.checkpointIndex,excursion>extent*.6?Math.min(2,count-1):1);
  if(settledSince!==undefined && timeMs-settledSince>=200 && timeMs-startedAt>=pattern.minMs) {
    // Time-invariant, discriminative decision over the whole attempt (all drills compete).
    const segment=samples as TimedFeatures[];
    const decision=decide(id,segment,model,attempt.completeAt!==undefined?segment.filter(s=>s.timeMs<=attempt.completeAt!):segment);
    if(decision.kind==='accepted') {
      const feedback=motionFeedback(id,samples,pattern);
      if(decision.slow) feedback.unshift(`Движение распознано, но выполнено слишком медленно (примерно в ${decision.tempo.toFixed(1)} раза дольше образцов). Попробуй выполнить его слитно, без пауз.`);
      return {...runtime,state:'completed',checkpointIndex:count-1,finishedAt:timeMs,validSince:null,match:null,
        motion:{...attempt,phase:'passed',samples,last:sample,similarity:decision.similarity,tempo:decision.tempo,message:'Движение распознано',outcome:'recognized',feedback:feedback.slice(0,2)}};
    }
    if(decision.kind==='other') {
      return {...runtime,state:'failed',finishedAt:timeMs,match:null,validSince:null,
        motion:{...attempt,phase:'failed',samples,last:sample,lookedLike:decision.drill,outcome:'other_drill',
          message:`Похоже на ${DRILL_NAMES[decision.drill] ?? decision.drill}, а не ${DRILL_NAMES[id] ?? id}. Повтори выбранное движение`}};
    }
    // Not an attempt at the selected strike (footwork only): start over from the current pose instead of failing.
    if(decision.kind==='unknown' && decision.ignored)return {...runtime,state:'ready',checkpointIndex:0,startedAt:undefined,validSince:null,match:null,
      motion:{phase:'position',message:'Прими исходную позицию',baseline:vector,last:sample,samples:[]}};
    if(distance(vector,attempt.baseline!)<extent*.3)return fail('Движение не удалось уверенно распознать. Повтори цельную попытку');
    // Not a recognisable whole movement yet (e.g. a pause mid-movement): keep the attempt open.
    const completeAt=attempt.completeAt ?? (decision.complete ? timeMs : undefined);
    // A step that has not yet come back into stance is re-checked at the next settle without requiring a new movement
    // burst; a strike stopped short or an ambiguous movement waits for more movement.
    return {...runtime,checkpointIndex:progressIndex,motion:{...attempt,samples,last:sample,settledSince:undefined,awaitMove:decision.incomplete!=='stance',completeAt,message:'Продолжай движение до конца'}};
  }
  return {...runtime,checkpointIndex:progressIndex,motion:{...attempt,samples,last:sample,settledSince,awaitMove,message:awaitMove?'Продолжай движение до конца':'Двигайся без остановок'}};
}

/** Observable differences, separate from recognition; no claims about blade/edge. */
function motionFeedback(id: string, samples: MotionSample[], pattern: Pattern): string[] {
  const notes: string[] = [];
  const ranges=(frames:number[][])=>pattern.features.map((_,i)=>Math.max(...frames.map(v=>v[i]))-Math.min(...frames.map(v=>v[i])));
  const measured=ranges(samples.map(s=>s.vector));
  const expected=pattern.templates.map(t=>ranges(t.frames));
  const torso=samples.map(s=>s.features?.torso_angle).filter((v):v is number=>v!==undefined && Number.isFinite(v));
  const finishTorso=torso.slice(-8).sort((a,b)=>a-b);
  if(torso.length>=samples.length*.8 && finishTorso.length>=4 && finishTorso[Math.floor(finishTorso.length/2)]>9)
    notes.push('К концу движения корпус заметно наклонён вперёд. Попробуй завершить следующую попытку с более вертикальным корпусом.');
  if(id.endsWith('hau')) {
    const reach=samples.at(-1)!.vector[0]-samples[0].vector[0];
    const target=Math.min(...pattern.templates.map(t=>t.frames.at(-1)![0]-t.frames[0][0]));
    if(reach<target*.7) notes.push('Видимая кисть продвинулась вперёд меньше, чем в образцах. В следующей попытке попробуй довести вынос рук.');
    if(Math.max(measured[2],measured[3])<Math.min(...expected.map(v=>Math.max(v[2],v[3])))*.7)
      notes.push('Перемещение стоп во время удара небольшое относительно образцов. Проверь, что выполняешь шаг вместе с ударом.');
    if(id==='zornhau' && measured[1]<Math.min(...expected.map(v=>v[1]))*.65) notes.push('Вертикальное движение видимой кисти небольшое. Повтори удар с более отчётливым движением сверху вниз.');
  } else {
    if(Math.max(measured[0],measured[1])<Math.min(...expected.map(v=>Math.max(v[0],v[1])))*.7)
      notes.push('Перемещение стоп меньше, чем в образцах. Попробуй сделать шаг более отчётливо, сохраняя равновесие.');
  }
  if(!notes.length) notes.push('В проверяемых параметрах заметного отклонения не найдено. Остальные детали техники по этому результату не оценены.');
  return notes.slice(0,2);
}
