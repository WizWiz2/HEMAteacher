import {createServer} from 'vite';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
const input=process.argv[2];if(!input)throw new Error('Usage: node frontend/scripts/check-inferred-motion.mjs <raw-pose-dir> [output.json]');
const v=await createServer({root:'frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]}});
try {
 const {LiveSampleProcessor}=await v.ssrLoadModule('/src/live/sampleProcessor.ts');
 const {personalizeDrill}=await v.ssrLoadModule('/src/drill/personalize.ts');
 const {adaptDrillForCameraView}=await v.ssrLoadModule('/src/drill/cameraView.ts');
 const {CalibrationGate}=await v.ssrLoadModule('/src/live/calibrationGate.ts');
 const {stepDrill,createDrillRuntime}=await v.ssrLoadModule('/src/drill/drillEngine.ts');
 const drills=JSON.parse(readFileSync('frontend/public/content/drills.json'));
 const rows=[];
 for(const filename of readdirSync(input).filter(f=>f.endsWith('.json'))) {
  const clip=JSON.parse(readFileSync(`${input}/${filename}`));
  for(const fps of [30,15,10]) for(const scenario of ["normal","frozen","gap","slow","truncated","reversed"]) {
   const processor=new LiveSampleProcessor(),calibration=new CalibrationGate();
   let runtime=createDrillRuntime(),usable=0,detected=0,total=0,gap=0,injected=false;
   const base=drills.find(d=>d.id===clip.drill);
   let drill=base;
   for(const [i,original] of clip.frames.entries()) {
    if(i%(30/fps))continue;
    if(scenario==='gap' && runtime.state==='running' && !injected){gap=Math.ceil(fps*.45);injected=true;}
    let observed=original;
    if(scenario==='truncated' && original.timestampMs>1550)observed=clip.frames.find(f=>f.timestampMs>=1550);
    if(scenario==='reversed' && original.timestampMs>=1000) {
     const reversedTime=Math.max(1000,4000-original.timestampMs);
     observed=clip.frames.reduce((a,b)=>Math.abs(a.timestampMs-reversedTime)<Math.abs(b.timestampMs-reversedTime)?a:b);
    }
    const raw={...original,timestampMs:original.timestampMs*(scenario==='slow'?12:1),landmarks:scenario==='frozen'?clip.frames[0].landmarks:gap-->0?{}:observed.landmarks};
    const sample=processor.process(raw,'right',drill.trackingMode??'full_body','side');
    total++;if(sample.motionUsable)usable++;if(Object.keys(raw.landmarks).length)detected++;
    if(runtime.state==='calibrating' && calibration.push(sample,drill.trackingMode??'full_body')) {
     drill=adaptDrillForCameraView(personalizeDrill(base,calibration.profile),'side');
     runtime=stepDrill(runtime,drill,{type:'quality',ok:true});
    }
    runtime=stepDrill(runtime,drill,{type:'sample',timeMs:sample.timeMs,features:sample.features,enoughSamples:sample.motionUsable,cameraView:'side'});
   }
   rows.push({file:clip.file,level:clip.level,body:clip.body,drill:clip.drill,backend:clip.backend,inferenceMs:clip.inferenceMs,fps,scenario,total,usable,detected,calibrated:calibration.refined,state:runtime.state,startedAt:runtime.startedAt,finishedAt:runtime.finishedAt,message:runtime.motion?.message,feedback:runtime.motion?.feedback,similarity:runtime.motion?.similarity});
  }
 }
 console.table(rows.filter(r=>r.fps===30&&r.scenario==='normal').map(({file,backend,body,...r})=>r));
 const missed=rows.filter(r=>r.scenario==='normal' && r.state!=='completed');
 if(missed.length){console.error('Unrecognized positive clips:',missed);process.exitCode=1;}
 const falsePositives=rows.filter(r=>r.scenario!=='normal' && r.state==='completed');
 if(falsePositives.length){console.error('Negative clips recognized:',falsePositives);process.exitCode=1;}
 if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify({note:'Decoded MP4 → Python CPU MediaPipe lite → shared browser preprocessing/calibration/drill engine. Python task runtime differs from browser WASM. Lower fps here subsamples inferred frames, not rerun inference.',rows},null,2)+'\n');
}finally{await v.close();}
