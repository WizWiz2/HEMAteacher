import {describe,it,expect} from 'vitest';
import {createDrillRuntime,stepDrill} from './drillEngine';
import {motionPatternFor} from './continuousMotion';
import type {Drill} from './types';
const drill:Drill={id:'zornhau',name:'Zornhau',description:'',cameraView:'side',checkpoints:Array.from({length:4},(_,i)=>({id:`${i}`,title:'test',holdMs:5000}))};
const pattern=motionPatternFor(drill.id)!;
const feature=(v:number[])=>Object.fromEntries(pattern.features.map((name,i)=>[name,v[i]]));
const sample=(timeMs:number,vector:number[])=>({type:'sample' as const,timeMs,features:feature(vector),enoughSamples:true,cameraView:'side' as const});
const ready=()=>stepDrill(createDrillRuntime(),drill,{type:'quality',ok:true});
function armed(){let r=ready();for(let t=0;t<=300;t+=100)r=stepDrill(r,drill,sample(t,pattern.templates[0].frames[0]));return r;}
describe('continuous attempts',()=>{
 it('a frozen guard never consumes checkpoints',()=>{let r=ready();for(let t=0;t<60000;t+=100)r=stepDrill(r,drill,sample(t,pattern.templates[0].frames[0]));expect(r.state).toBe('ready');expect(r.checkpointIndex).toBe(0);expect(r.motion?.phase).toBe('armed');});
 it('finishes a whole trajectory without any checkpoint holds',()=>{let r=armed();for(let i=1;i<25;i++)r=stepDrill(r,drill,sample(400+i*30,pattern.templates[0].frames[i]));for(let i=0;i<8;i++)r=stepDrill(r,drill,sample(1200+i*33,pattern.templates[0].frames[24]));expect(r.state).toBe('completed');expect(r.finishedAt! - r.startedAt!).toBeLessThan(1500);});
 it('loss of tracking during a strike produces a retryable failure',()=>{let r=armed();r=stepDrill(r,drill,sample(400,pattern.templates[0].frames[14]));r=stepDrill(r,drill,{type:'sample',timeMs:800,features:null,enoughSamples:false});expect(r.state).toBe('failed');r=stepDrill(r,drill,{type:'retry'});expect(r.state).toBe('ready');expect(r.motion).toBeUndefined();});
 it('ignores repeated and backwards timestamps',()=>{let r=armed();r=stepDrill(r,drill,sample(500,pattern.templates[0].frames[8]));expect(stepDrill(r,drill,sample(500,pattern.templates[0].frames[24]))).toBe(r);expect(stepDrill(r,drill,sample(400,pattern.templates[0].frames[24]))).toBe(r);});
 it('does not use side-view patterns for the front camera',()=>{const r=stepDrill(ready(),drill,{...sample(0,pattern.templates[0].frames[0]),cameraView:'front'});expect(r.motion?.message).toContain('боком');expect(r.state).toBe('ready');});
 it('recognizes a movement from a different guard rather than requiring the master pose',()=>{
  const shifted=pattern.templates[0].frames.map(v=>v.map((x,i)=>x+(i<2?.2:0)));
  let r=ready();for(let t=0;t<=300;t+=100)r=stepDrill(r,drill,sample(t,shifted[0]));
  for(let i=1;i<25;i++)r=stepDrill(r,drill,sample(400+i*30,shifted[i]));
  for(let i=0;i<10;i++)r=stepDrill(r,drill,sample(1200+i*33,shifted[24]));
  expect(r.state).toBe('completed');expect(r.motion?.outcome).toBe('recognized');
 });
 it('keeps recognition separate from an observed technique correction',()=>{
  let r=armed();
  const leaning=(t:number,v:number[])=>({...sample(t,v),features:{...feature(v),torso_angle:15}});
  for(let i=1;i<25;i++)r=stepDrill(r,drill,leaning(400+i*30,pattern.templates[0].frames[i]));
  for(let i=0;i<10;i++)r=stepDrill(r,drill,leaning(1200+i*33,pattern.templates[0].frames[24]));
  expect(r.state).toBe('completed');expect(r.motion?.feedback?.[0]).toContain('корпус');
 });
});
