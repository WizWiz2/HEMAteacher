import patternsData from './motionPatterns.json';
import type { DrillRuntime } from './types';

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
  outcome?: 'recognized' | 'incomplete' | 'tracking_lost';
}
const patterns: Record<string, Pattern> = patternsData;
export const motionPatternFor = (id: string) => patterns[id];
function segmentDistance(p: number[], a: number[], b: number[]) {
  const d=b.map((v,i)=>v-a[i]);
  const length=d.reduce((sum,v)=>sum+v*v,0);
  const t=length?Math.max(0,Math.min(1,p.reduce((sum,v,i)=>sum+(v-a[i])*d[i],0)/length)):0;
  return distance(p,a.map((v,i)=>v+t*d[i]));
}
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
    if(attempt.phase==='moving' && attempt.last && timeMs-attempt.last.timeMs>250)return fail('Камера потеряла движение. Повтори попытку');
    return {...runtime,validSince:null,motion:attempt.phase==='moving'?{...attempt,message:'Покажи камере руки и стопы'}:{phase:'position',samples:[],message:'Покажи камере руки и стопы'}};
  }
  if(attempt.last && timeMs-attempt.last.timeMs>250) {
    if(attempt.phase==='moving')return fail('Слишком большой разрыв кадров. Повтори попытку');
    attempt={phase:'position',message:'Прими исходную позицию',samples:[]};
  }
  const sample={timeMs,vector,features:features ?? undefined};
  if(attempt.phase==='position') {
    const nearStart=!id.endsWith('hau') || vector[1] > .55;
    const stable=!attempt.last || distance(vector,attempt.last.vector)<.035;
    const since=nearStart&&stable?(runtime.validSince??timeMs):null;
    const armed=since!==null && timeMs-since>=200;
    return {...runtime,validSince:since,match:null,motion:{phase:armed?'armed':'position',message:armed?'Готов. Выполни движение целиком':'Прими исходную позицию',baseline:vector,last:sample,samples:[]}};
  }
  if(attempt.phase==='armed') {
    if(distance(vector,attempt.baseline!)<.045)return {...runtime,motion:{...attempt,last:sample}};
    const extent=Math.max(...pattern.templates.flatMap(t=>t.frames.map(v=>distance(v,t.frames[0]))));
    if(distance(vector,attempt.last!.vector)>extent*(id.endsWith('hau')?.45:.7) && timeMs-attempt.last!.timeMs<180)return fail('Поза резко перескочила. Повтори движение перед камерой');
    attempt={...attempt,phase:'moving',message:'Двигайся без остановок',samples:[{timeMs:attempt.last!.timeMs,vector:attempt.baseline!},sample],last:sample,stages:pattern.templates.map(t=>{const extent=Math.max(...t.frames.map(v=>distance(v,t.frames[0])));let stage=0;while(stage<3 && segmentDistance(t.frames[[6,13,24][stage]].map((x,i)=>x-t.frames[0][i]+attempt.baseline![i]),attempt.baseline!,vector)<extent*(id.endsWith('hau')?.4:.32))stage++;return stage;})};
    return {...runtime,state:'running',startedAt:attempt.samples[0].timeMs,validSince:null,checkpointIndex:1,motion:attempt};
  }
  const startedAt=runtime.startedAt!;
  const templates=pattern.templates.map(t=>({...t,frames:t.frames.map(v=>v.map((x,i)=>x-t.frames[0][i]+attempt.baseline![i]))}));
  if(timeMs-startedAt>4000)return fail('Слишком долго: выполни одно непрерывное движение');
  const samples=[...attempt.samples,sample].slice(-240);
  // Estimate settling over a camera-time window: single-frame wrist jitter
  // must not keep an otherwise finished strike running indefinitely.
  const anchor=samples.find(s=>s.timeMs>=timeMs-200) ?? attempt.last!;
  const speed=distance(vector,anchor.vector)/Math.max(1,timeMs-anchor.timeMs)*1000;
  // Accept the whole path, not the last pose. Excursion prevents a frozen pose
  // or an almost stationary wobble from matching a step that ends where it began.
  const stages=(attempt.stages ?? pattern.templates.map(()=>0)).map((stage,i)=>{
    if(stage>=3)return stage;
    const frames=templates[i].frames;
    const extent=Math.max(...frames.map(v=>distance(v,frames[0])));
    while(stage<3 && segmentDistance(frames[[6,13,24][stage]],attempt.last!.vector,vector)<extent*(id.endsWith('hau')?.4:.32))stage++;
    return stage;
  });
  const candidates=templates.map((t,i)=>{
    const extent=Math.max(...t.frames.map(v=>distance(v,t.frames[0])));
    const excursion=Math.max(...samples.map(s=>distance(s.vector,attempt.baseline!)));
    return {t,extent,excursion,stage:stages[i],end:distance(vector,t.frames.at(-1)!)};
  });
  const movingFrames=samples.filter((s,i)=>i>0 && distance(s.vector,samples[i-1].vector)>.015).length;
  const crossed=!id.startsWith('passing') || (attempt.baseline![0]-attempt.baseline![1])*(vector[0]-vector[1])<0 && Math.abs(vector[0]-vector[1])>.2;
  const canFinish=crossed && movingFrames>=4 && candidates.some(c=>c.stage===3 && c.end<Math.max(.08,c.extent*(id.endsWith('hau')?.4:.3)) && c.excursion>Math.max(.08,c.extent*.6));
  const settledSince=canFinish&&speed<.65?(attempt.settledSince??timeMs):undefined;
  const finish=settledSince!==undefined && timeMs-settledSince>=200 && timeMs-startedAt>=pattern.minMs;
  if(finish) {
    const error=Math.min(...candidates.filter(c=>c.stage===3&&c.end<Math.max(.08,c.extent*(id.endsWith('hau')?.4:.3))&&c.excursion>Math.max(.08,c.extent*.6)).map(c=>trajectoryError(samples,c.t.frames)/c.extent));
    if(error>.55)return fail('Движение не удалось уверенно распознать. Повтори цельную попытку');
    const feedback = motionFeedback(id, samples, pattern);
    return {...runtime,state:'completed',checkpointIndex:count-1,finishedAt:timeMs,validSince:null,match:null,
      motion:{...attempt,phase:'passed',samples,last:sample,similarity:Math.round(Math.max(0,1-error)*100),message:'Движение распознано',outcome:'recognized',feedback}};
  }
  const progress=Math.min(...candidates.map(c=>c.end));
  return {...runtime,checkpointIndex:Math.max(runtime.checkpointIndex,progress<.25?count-1:Math.min(2,count-1)),motion:{...attempt,samples,last:sample,settledSince,stages,message:'Двигайся без остановок'}};
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
