// CI gate for continuous-movement recognition on recorded MediaPipe poses (pose fixture), run through the same streaming
// pipeline as the app (LiveSampleProcessor -> CalibrationGate -> stepDrill) with the shipped model. Replaces the
// ground-truth-skeleton replay of check-continuous-motion.mjs, whose Blender landmarks are outside the MediaPipe template
// domain since the discriminative recognizer (docs/motion-recognition.md). Every main continuous-drill clip is tested as
// its own drill under each scenario: normal, fast (0.6x time), fps10 and slow4x must be recognised; reversed, frozen,
// slow12x (beyond the 10 s bound), truncated (stops half-way) and gap (500 ms tracking dropout) must not be.
// Known gaps are allowed explicitly (measured counts, see docs/motion-recognition.md "Limitations"); any additional
// unexpected outcome fails the job, so regressions are caught.
// Usage (repo root): node frontend/scripts/check-motion-scenarios.mjs
import {createServer} from 'vite';
const v=await createServer({root:'frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'});
try {
 const {streamClip,mutate}=await v.ssrLoadModule('/src/drill/motionEvaluation.ts');
 const {CONTINUOUS_DRILLS}=await v.ssrLoadModule('/src/drill/motionTraining.ts');
 const {loadMotionFixture,loadDrills}=await import('../test-fixtures/loadFixture.mjs');
 const fx=loadMotionFixture(),drills=loadDrills();
 const clips=fx.clips.filter(c=>c.variant==='main'&&CONTINUOUS_DRILLS.includes(c.drill));
 const expectAccept={normal:true,fast:true,fps10:true,slow4x:true,reversed:false,frozen:false,slow12x:false,truncated:false,gap:false};
 // Allowed unexpected outcomes per scenario (measured with the shipped model):
 //  fast/fps10: a few footwork clips at 0.6x time or 10 fps are not accepted (onset/settle segmentation);
 //  slow4x: slow beginners at 4x exceed the 10 s attempt bound (by design);
 //  truncated: footwork can be accepted at a mid-step pause (known limitation, 19/24); strikes must never be (the
 //  completion check rejects strikes that cover less than 65% of the drill's typical path).
 const ALLOWED={fast:2,fps10:3,slow4x:4,truncated:19,truncatedStrikes:0};
 const isStrike=x=>x.c.drill.endsWith('hau');
 const summary={};let bad=0;
 for(const [kind,accept] of Object.entries(expectAccept)){
  const res=clips.map(c=>({c,r:streamClip(kind==='normal'?c:mutate(c,kind),fx.names,drills.find(d=>d.id===c.drill))}));
  const wrong=res.filter(x=>x.r.completed!==accept);
  const groups=kind==='truncated'?[['truncated',wrong.filter(x=>!isStrike(x))],['truncatedStrikes',wrong.filter(isStrike)]]:[[kind,wrong]];
  for(const [key,w] of groups) if(w.length>(ALLOWED[key]??0)){bad+=w.length-(ALLOWED[key]??0);console.log(`FAIL ${key}: ${w.length} unexpected (allowed ${ALLOWED[key]??0})`);}
  summary[kind]={expected:accept?'accept':'reject',accepted:res.filter(x=>x.r.completed).length,total:res.length};
  console.log(`${kind.padEnd(9)} expected ${accept?'accept':'reject'}: accepted ${summary[kind].accepted}/${res.length}`);
  for(const x of wrong)console.log('   UNEXPECTED',x.c.id,'->',x.r.completed?'accepted':'not accepted',x.r.message??'',x.r.similarity??'');
 }
 console.log(JSON.stringify(summary));
 if(bad)process.exitCode=1;
}finally{await v.close();}
