import {describe,it,expect} from 'vitest';
import {createDrillRuntime,stepDrill} from './drillEngine';
import {motionPatternFor} from './continuousMotion';
import type {Drill} from './types';
import {loadMotionFixture,loadDrills} from '../../test-fixtures/loadFixture.mjs';
import {streamClip} from './motionEvaluation';
import {clipFeatures} from './motionTraining';
const drill:Drill={id:'zornhau',name:'Zornhau',description:'',cameraView:'side',checkpoints:Array.from({length:4},(_,i)=>({id:`${i}`,title:'test',holdMs:5000}))};
const pattern=motionPatternFor(drill.id)!;
const feature=(v:number[])=>Object.fromEntries(pattern.features.map((name,i)=>[name,v[i]]));
const sample=(timeMs:number,vector:number[])=>({type:'sample' as const,timeMs,features:feature(vector),enoughSamples:true,cameraView:'side' as const});
const ready=()=>stepDrill(createDrillRuntime(),drill,{type:'quality',ok:true});
function armed(){let r=ready();for(let t=0;t<=300;t+=100)r=stepDrill(r,drill,sample(t,pattern.templates[0].frames[0]));return r;}
describe('continuous attempts',()=>{
 it('settles a completed strike despite alternating camera wrist jitter',()=>{
  let r=armed();
  for(let i=1;i<25;i++)r=stepDrill(r,drill,sample(400+i*30,pattern.templates[0].frames[i]));
  for(let i=0;i<20;i++){
   const vector=[...pattern.templates[0].frames[24]];
   vector[0]+=(i%2 ? 1 : -1)*.045;
   r=stepDrill(r,drill,sample(1200+i*33,vector));
  }
  expect(r.state).toBe('completed');
 });
 it('a frozen guard never consumes checkpoints',()=>{let r=ready();for(let t=0;t<60000;t+=100)r=stepDrill(r,drill,sample(t,pattern.templates[0].frames[0]));expect(r.state).toBe('ready');expect(r.checkpointIndex).toBe(0);expect(r.motion?.phase).toBe('armed');});
 it('finishes a whole trajectory without any checkpoint holds',()=>{let r=armed();for(let i=1;i<25;i++)r=stepDrill(r,drill,sample(400+i*30,pattern.templates[0].frames[i]));for(let i=0;i<8;i++)r=stepDrill(r,drill,sample(1200+i*33,pattern.templates[0].frames[24]));expect(r.state).toBe('completed');expect(r.finishedAt! - r.startedAt!).toBeLessThan(1500);});
 it('loss of tracking during a strike produces a retryable failure',()=>{let r=armed();r=stepDrill(r,drill,sample(400,pattern.templates[0].frames[14]));r=stepDrill(r,drill,{type:'sample',timeMs:900,features:null,enoughSamples:false});expect(r.state).toBe('failed');r=stepDrill(r,drill,{type:'retry'});expect(r.state).toBe('ready');expect(r.motion).toBeUndefined();});
 it('ignores repeated and backwards timestamps',()=>{let r=armed();r=stepDrill(r,drill,sample(500,pattern.templates[0].frames[8]));expect(stepDrill(r,drill,sample(500,pattern.templates[0].frames[24]))).toBe(r);expect(stepDrill(r,drill,sample(400,pattern.templates[0].frames[24]))).toBe(r);});
 it('does not use side-view patterns for the front camera',()=>{const r=stepDrill(ready(),drill,{...sample(0,pattern.templates[0].frames[0]),cameraView:'front'});expect(r.motion?.message).toContain('боком');expect(r.state).toBe('ready');});
 it('recognizes a recorded strike and names the drill it resembles instead',()=>{
  const fx=loadMotionFixture(),drills=loadDrills(),clip=fx.clips.find(c=>c.id==='main/zornhau/tall_slim_male_master')!;
  const own=streamClip(clip,fx.names,drills.find(d=>d.id==='zornhau')!);
  expect(own.completed).toBe(true);expect(own.similarity!).toBeGreaterThan(60);
  const other=streamClip(clip,fx.names,drills.find(d=>d.id==='krumphau')!);
  expect(other.completed).toBe(false);expect(other.lookedLike).toBe('zornhau');
  expect(other.message).toBe('Похоже на Zornhau, а не Krumphau. Повтори выбранное движение');
 });
 it('recognizes a slow beginner with lower similarity and a слишком медленно note instead of rejecting',()=>{
  const fx=loadMotionFixture(),drill=loadDrills().find(d=>d.id==='scheitelhau')!;
  const master=streamClip(fx.clips.find(c=>c.id==='main/scheitelhau/tall_slim_male_master')!,fx.names,drill);
  const beginner=streamClip(fx.clips.find(c=>c.id==='main/scheitelhau/tall_slim_male_beginner')!,fx.names,drill);
  expect(beginner.completed).toBe(true);expect(beginner.tempo!).toBeGreaterThan(1.6);
  expect(beginner.feedback?.[0]).toContain('слишком медленно');
  expect(beginner.similarity!).toBeLessThan(master.similarity!-20);
 });
 it('keeps recognition separate from an observed technique correction',()=>{
  const fx=loadMotionFixture(),clip=fx.clips.find(c=>c.id==='main/zornhau/tall_slim_male_master')!;
  let r=ready();
  for(const s of clipFeatures(clip,fx.names)){
   r=stepDrill(r,drill,{type:'sample',timeMs:s.timeMs,features:s.features?{...s.features,torso_angle:15}:null,enoughSamples:!!s.features,cameraView:'side'});
   if(r.state==='completed')break;
  }
  expect(r.state).toBe('completed');expect(r.motion?.feedback?.join(' ')).toContain('корпус');
 });
});
