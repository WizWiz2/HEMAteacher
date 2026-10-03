// Honest evaluation of continuous-motion recognition on the pose fixture through the full streaming pipeline
// (protocols: see evaluateProtocols in src/drill/motionEvaluation.ts).
// Usage (repo root): node frontend/scripts/evaluate-motion-recognition.mjs [out.json]
import {createServer} from 'vite';import {writeFileSync} from 'node:fs';
const v=await createServer({root:'frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'});
try {
 const {evaluateProtocols,confusion}=await v.ssrLoadModule('/src/drill/motionEvaluation.ts');
 const {loadMotionFixture,loadDrills}=await import('../test-fixtures/loadFixture.mjs');
 const rows=evaluateProtocols(loadMotionFixture(),loadDrills());
 const out=process.argv[2]; if(out) writeFileSync(out,JSON.stringify(rows,null,1));
 for(const [p,filter] of [['lobo master+experienced',r=>r.protocol==='lobo'&&r.level!=='beginner'],['lobo beginner',r=>r.protocol==='lobo'&&r.level==='beginner'],
   ['split beginners (shipped model: both bodies M+E)',r=>r.protocol==='split'],['heldout (shipped model)',r=>r.protocol==='heldout']]){
  const rs=rows.filter(filter),c=confusion(rs),own=rs.filter(r=>r.source===r.selected);
  console.log(`\n== ${p}: own ${c.own}/${c.ownTotal} (with DrillPage retries ${own.filter(r=>r.completedWithRetry).length}), off-diagonal ${c.other}/${c.otherTotal}`);
  console.log(c.text);
  for(const r of own.filter(r=>!r.completed))console.log('  MISS',r.clip,r.message);
  for(const r of own.filter(r=>r.completed))console.log('  ok',r.clip,'sim',r.similarity,'tempo',r.tempo?.toFixed(2),r.feedback?.[0]?.slice(0,60)??'');
 }
}finally{await v.close();}
