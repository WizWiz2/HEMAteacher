// Builds the motion recognition model (src/drill/motionModel.json) and the trigger/feedback patterns
// (src/drill/motionPatterns.json) reproducibly from the pose fixture (test-fixtures/motion-poses.json.gz).
// Training split for the shipped model (isTrainClip): master + experienced levels of the main mock clips and the
// bodies/angles train clips (docs/bodies-angles-split.md: 5 train bodies, random camera). Beginners, the held-out and
// reserved test bodies/angles, and guards-basic are never used.
// Also builds the experimental blade-channel model (src/drill/motionModelBlade.json, docs/blade-tracking.md) from the
// same training clips plus the blade detections of test-fixtures/motion-blade.json.gz (used only when the flag is on).
// Usage (from the repo root): node frontend/scripts/build-motion-patterns.mjs [--check]
import {createServer} from 'vite';import {writeFileSync,readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
const v=await createServer({root:'frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'});
try {
 const {buildModel,clipFeatures,CONTINUOUS_DRILLS,isTrainClip}=await v.ssrLoadModule('/src/drill/motionTraining.ts');
 const fixture=JSON.parse(gunzipSync(readFileSync('frontend/test-fixtures/motion-poses.json.gz')).toString());
 const train=fixture.clips.filter(isTrainClip);
 const model=buildModel(train,fixture.names);
 // Trigger patterns (armed-state detection, extent and coaching feedback): 25 frames over the labelled movement of the
 // training master clips, in MediaPipe features (not ground truth).
 const patterns={};
 for(const c of train.filter(c=>c.level==='master' && CONTINUOUS_DRILLS.includes(c.drill))) {
  const strike=c.drill.endsWith('hau');
  const features=strike?['action_hand_x','action_hand_y','left_ankle_x','right_ankle_x']:['left_ankle_x','right_ankle_x','left_ankle_y','right_ankle_y','root_x'];
  const seq=clipFeatures(c,fixture.names).filter(s=>s.features);
  const [start,end]=c.move;
  const frames=Array.from({length:25},(_,i)=>{
   const t=start+(end-start)*i/24;
   const s=seq.reduce((a,b)=>Math.abs(a.timeMs-t)<Math.abs(b.timeMs-t)?a:b);
   return features.map(n=>Number(s.features[n].toFixed(5)));
  });
  patterns[c.drill]??={features,maxMs:10000,minMs:180,templates:[]};
  patterns[c.drill].templates.push({body:c.body,frames});
 }
 const {BLADE}=await v.ssrLoadModule('/src/drill/motionRecognition.ts');
 const {BLADE_MIN_CONFIDENCE}=await v.ssrLoadModule('/src/live/bladeTracking.ts');
 const {withBlade}=await import('../test-fixtures/loadFixture.mjs');
 BLADE.enabled=true;
 const bladeModel=buildModel(withBlade(fixture,BLADE_MIN_CONFIDENCE).clips.filter(isTrainClip),fixture.names);
 BLADE.enabled=false;
 const outputs=[['frontend/src/drill/motionPatterns.json',JSON.stringify(patterns,null,2)+'\n'],['frontend/src/drill/motionModel.json',JSON.stringify(model)+'\n'],
  ['frontend/src/drill/motionModelBlade.json',JSON.stringify(bladeModel)+'\n']];
 for(const [file,text] of outputs) {
  if(process.argv.includes('--check')) {if(readFileSync(file,'utf8')!==text)throw new Error(`${file} is stale: rerun build-motion-patterns.mjs`);}
  else writeFileSync(file,text);
 }
 console.log(`model: ${model.templates.length} templates from ${train.length} training clips, acceptDistance ${model.acceptDistance}`);
}finally{await v.close();}
