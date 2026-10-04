// Programmatic mutations on the pose fixture with the shipped model, every main continuous-drill clip tested as its own
// drill. Negatives: reversed movement, frozen pose, 12x slowdown (beyond the 10 s bound). 4x slowdown should still be
// recognised (time-invariant matching) with a slow note. Usage (repo root): node frontend/scripts/check-motion-mutations.mjs
import {createServer} from 'vite';
const v=await createServer({root:'frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'});
try {
 const {streamClip,mutate}=await v.ssrLoadModule('/src/drill/motionEvaluation.ts');
 const {CONTINUOUS_DRILLS}=await v.ssrLoadModule('/src/drill/motionTraining.ts');
 const {loadMotionFixture,loadDrills}=await import('../test-fixtures/loadFixture.mjs');
 const fx=loadMotionFixture(),drills=loadDrills();
 const clips=fx.clips.filter(c=>c.variant==='main'&&CONTINUOUS_DRILLS.includes(c.drill));
 for(const kind of ['reversed','frozen','slow4x','slow12x']){
  const res=clips.map(c=>({c,r:streamClip(mutate(c,kind),fx.names,drills.find(d=>d.id===c.drill))}));
  console.log(`${kind}: accepted as own drill ${res.filter(x=>x.r.completed).length}/${res.length}`);
  for(const x of res.filter(x=>x.r.completed))console.log('  ',x.c.id,'sim',x.r.similarity,'tempo',x.r.tempo?.toFixed(2));
 }
}finally{await v.close();}
