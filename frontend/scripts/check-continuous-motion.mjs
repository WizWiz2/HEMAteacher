import {createServer} from 'vite';import {readFileSync,writeFileSync} from 'node:fs';import {clips,samples} from './mock-motion.mjs';
const v=await createServer({root:'frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]}});
try {
 const {normalizePose,torsoPixels}=await v.ssrLoadModule('/src/live/normalize.ts');
 const {liveFeatures}=await v.ssrLoadModule('/src/live/features.ts');
 const {stepDrill,createDrillRuntime}=await v.ssrLoadModule('/src/drill/drillEngine.ts');
 const drills=JSON.parse(readFileSync('frontend/public/content/drills.json'));
 const rows=[];
 const baseline=[];
 const replay=(drill,frames,scenario,mode='motion')=>{
  let gapLeft=0, gapInjected=false;
  let r=stepDrill(createDrillRuntime(),drill,{type:'quality',ok:true});
  for(const frame of frames) {
   if(scenario==='gap' && r.state==='running' && !gapInjected) {gapLeft=12;gapInjected=true;}
   const f=gapLeft-->0?{...frame,features:null}:frame;
   r=stepDrill(r,drill,{type:'sample',...f,enoughSamples:f.features!==null,cameraView:'side',mode});
  }
  return r;
 };
 const all=clips('test-data/mock-videos');
 for(const clip of all) {
  const seq=samples(clip,normalizePose,torsoPixels,liveFeatures), drill=drills.find(d=>d.id===clip.drill_id);
  const end=clip.drill_id==='zornhau'?1.9:clip.drill_id.startsWith('passing')?2.39:2.02;
  const movement=seq.filter(s=>s.timeMs>=1000 && s.timeMs<=end*1000+500);
  const reversed=[...seq.filter(s=>s.timeMs<900),...movement.map((s,i)=>({...s,features:movement[movement.length-1-i].features,timeMs:1000+i*33.333}))];
  baseline.push({drill:clip.drill_id,level:clip.level,body:clip.body_type,frozenPassed:replay(drill,seq.map(s=>({...s,features:seq[0].features})),'frozen','poses').state==='completed'});
  const options={normal:seq,fast:seq.map(s=>({...s,timeMs:s.timeMs*.6})),fps10:seq.filter((_,i)=>i%3===0),slow:seq.map(s=>({...s,timeMs:s.timeMs*12})),frozen:seq.map(s=>({...s,features:seq[0].features})),reversed,
   truncated:seq.map(s=>({...s,features:s.timeMs>1550?seq.find(s=>s.timeMs>=1550).features:s.features})),
   gap:seq};
  for(const[scenario,frames] of Object.entries(options)) {
   const r=replay(drill,frames,scenario);rows.push({drill:clip.drill_id,body:clip.body_type,level:clip.level,scenario,passed:r.state==='completed',finishedAt:r.finishedAt,message:r.motion?.message,similarity:r.motion?.similarity});
  }
 }
 console.table(rows.filter(r=>r.scenario==='normal').map(({body,...r})=>r));
 const summary=Object.fromEntries([...new Set(rows.map(r=>r.scenario))].map(s=>[s,{passed:rows.filter(r=>r.scenario===s&&r.passed).length,total:rows.filter(r=>r.scenario===s).length}]));
 console.log(JSON.stringify(summary));
 if(process.argv.includes('--write'))writeFileSync('docs/continuous-motion-results.json',JSON.stringify({note:'Ground-truth landmark replay, not MediaPipe inference. Masters build templates; experienced/beginner are held out.',summary,baseline,rows},null,2)+'\n');
 if(rows.some(r=>['normal','fps10','fast'].includes(r.scenario)?(r.level!=='beginner' && !r.passed):r.passed))process.exitCode=1;
}finally{await v.close();}
