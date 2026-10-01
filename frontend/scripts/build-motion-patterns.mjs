import {createServer} from 'vite';import {writeFileSync,readFileSync} from 'node:fs';import {clips,samples} from './mock-motion.mjs';
const v=await createServer({root:'frontend',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]}});
try {
 const {normalizePose,torsoPixels}=await v.ssrLoadModule('/src/live/normalize.ts');
 const {liveFeatures}=await v.ssrLoadModule('/src/live/features.ts');
 const result={};
 for(const c of clips('test-data/mock-videos').filter(c=>c.level==='master')) {
  const end=c.drill_id==='zornhau'?1.9:c.drill_id.startsWith('passing')?2.39:2.02;
  const start=c.drill_id==='zornhau'?1.2:1.35;
  const features=c.drill_id==='zornhau'?['hand_center_x','hand_center_y','left_ankle_x','right_ankle_x']:['left_ankle_x','right_ankle_x','left_ankle_y','right_ankle_y'];
  const seq=samples(c,normalizePose,torsoPixels,liveFeatures);
  const frames=Array.from({length:25},(_,i)=>{
   const t=(start+(end-start)*i/24)*1000;
   const s=seq.reduce((a,b)=>Math.abs(a.timeMs-t)<Math.abs(b.timeMs-t)?a:b);
   return features.map(n=>Number(s.features[n].toFixed(5)));
  });
  result[c.drill_id]??={features,maxMs:c.drill_id==='zornhau'?1800:2400,minMs:180,templates:[]};
  result[c.drill_id].templates.push({body:c.body_type,frames});
 }
 const file='frontend/src/drill/motionPatterns.json',text=JSON.stringify(result,null,2)+'\n';
 if(process.argv.includes('--check')) {if(readFileSync(file,'utf8')!==text)throw new Error('Motion patterns are stale');}
 else writeFileSync(file,text);
}finally{await v.close();}
