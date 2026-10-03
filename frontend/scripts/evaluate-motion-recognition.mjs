// Honest evaluation of continuous-motion recognition on the pose fixture through the full streaming pipeline
// (protocols: see evaluateProtocols in src/drill/motionEvaluation.ts; split: docs/bodies-angles-split.md).
// Usage (repo root): node frontend/scripts/evaluate-motion-recognition.mjs [out.json] [protocols, e.g. lobo,before,test]
import {createServer} from 'vite';import {writeFileSync} from 'node:fs';
const v=await createServer({root:'frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'});
try {
 const {evaluateProtocols,confusion}=await v.ssrLoadModule('/src/drill/motionEvaluation.ts');
 const {loadMotionFixture,loadDrills}=await import('../test-fixtures/loadFixture.mjs');
 const rows=evaluateProtocols(loadMotionFixture(),loadDrills(),process.argv[3]?.split(','));
 const out=process.argv[2]; if(out) writeFileSync(out,JSON.stringify(rows,null,1));
 const ME=r=>r.level!=='beginner',BEG=r=>r.level==='beginner';
 const line=(name,rs)=>{const c=confusion(rs);return `${name.padEnd(46)} own ${String(c.own+'/'+c.ownTotal).padStart(8)} ${(100*c.own/Math.max(1,c.ownTotal)).toFixed(0).padStart(3)}%   wrong-drill ${String(c.other+'/'+c.otherTotal).padStart(9)} ${(100*c.other/Math.max(1,c.otherTotal)).toFixed(1).padStart(5)}%`;};
 for(const p of ['lobo','before','test']){
  const rs=rows.filter(r=>r.protocol===p); if(!rs.length)continue;
  console.log(`\n== ${p}`);
  console.log(line('all master/experienced',rs.filter(ME)));console.log(line('all beginner',rs.filter(BEG)));
  for(const b of [...new Set(rs.map(r=>r.body))])console.log(line(`  body ${b} M/E`,rs.filter(r=>r.body===b&&ME(r))),'\n'+line(`  body ${b} B`,rs.filter(r=>r.body===b&&BEG(r))));
  const bins=[[-90,-10,'rear (<-10°)'],[-10,10,'profile (±10°)'],[10,30,'front 10–30°'],[30,90,'front 30–45°']];
  for(const [lo,hi,n] of bins){const x=rs.filter(r=>r.azimuth>=lo&&r.azimuth<hi);if(x.length)console.log(line(`  azimuth ${n} M/E`,x.filter(ME)),'\n'+line(`  azimuth ${n} B`,x.filter(BEG)));}
  console.log(confusion(rs.filter(ME)).text);
 }
}finally{await v.close();}
