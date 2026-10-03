// Honest evaluation of continuous-motion recognition on the pose fixture through the full streaming pipeline.
// Protocols: (1) leave-one-body-out on main clips (templates from one body's master+experienced clips, test every
// clip of the other body), (2) held-out camera/body clips with the shipped model (all main master+experienced).
// Usage (repo root): node frontend/scripts/evaluate-motion-recognition.mjs [out.json]
import {createServer} from 'vite';import {readFileSync,writeFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
const v=await createServer({root:'frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'});
try {
 const {buildModel,CONTINUOUS_DRILLS,isTrainClip}=await v.ssrLoadModule('/src/drill/motionTraining.ts');
 const {setRecognitionModel}=await v.ssrLoadModule('/src/drill/continuousMotion.ts');
 const {streamClip}=await v.ssrLoadModule('/src/drill/motionEvaluation.ts');
 const fx=JSON.parse(gunzipSync(readFileSync('frontend/test-fixtures/motion-poses.json.gz')).toString());
 const drills=JSON.parse(readFileSync('frontend/public/content/drills.json','utf8'));
 const rows=[];
 const run=(protocol,model,tests)=>{setRecognitionModel(model);
  for(const c of tests) for(const d of CONTINUOUS_DRILLS){const r=streamClip(c,fx.names,drills.find(x=>x.id===d));
   rows.push({protocol,clip:c.id,source:c.drill,variant:c.variant,body:c.body,level:c.level,selected:d,completed:r.completed,similarity:r.similarity,tempo:r.tempo,message:r.message,lookedLike:r.lookedLike,feedback:r.feedback});}};
 const main=fx.clips.filter(c=>c.variant==='main'&&CONTINUOUS_DRILLS.includes(c.drill));
 for(const body of [...new Set(main.map(c=>c.body))]){
  const train=fx.clips.filter(c=>isTrainClip(c)&&c.body!==body);
  run('lobo',buildModel(train,fx.names),main.filter(c=>c.body===body));
 }
 run('heldout',buildModel(fx.clips.filter(isTrainClip),fx.names),fx.clips.filter(c=>c.variant.startsWith('heldout')));
 const out=process.argv[2]; if(out) writeFileSync(out,JSON.stringify(rows,null,1));
 for(const [p,filter] of [['lobo master+experienced',r=>r.protocol==='lobo'&&r.level!=='beginner'],['lobo beginner',r=>r.protocol==='lobo'&&r.level==='beginner'],['heldout',r=>r.protocol==='heldout']]){
  const rs=rows.filter(filter),own=rs.filter(r=>r.source===r.selected),other=rs.filter(r=>r.source!==r.selected);
  console.log(`\n== ${p}: own ${own.filter(r=>r.completed).length}/${own.length}, off-diagonal ${other.filter(r=>r.completed).length}/${other.length}`);
  console.log('source\\selected '+CONTINUOUS_DRILLS.map(d=>d.slice(0,6)).join(' '));
  for(const s of CONTINUOUS_DRILLS){const line=CONTINUOUS_DRILLS.map(d=>{const x=rs.filter(r=>r.source===s&&r.selected===d);return x.length?`${x.filter(r=>r.completed).length}/${x.length}`.padStart(6):'     -';});if(rs.some(r=>r.source===s))console.log(s.padEnd(22)+line.join(' '));}
  for(const r of own.filter(r=>!r.completed))console.log('  MISS',r.clip,r.message);
  for(const r of own.filter(r=>r.completed))console.log('  ok',r.clip,'sim',r.similarity,'tempo',r.tempo?.toFixed(2));
 }
}finally{await v.close();}
