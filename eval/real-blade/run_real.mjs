// Hybrid blade detector (as shipped in PR #20) on the real YouTube clips (read-only inputs under /workspace/hema/real).
import {createServer} from '/workspace/HEMAteacher-push/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const v=await createServer({root:'/workspace/HEMAteacher-push/frontend',configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'});
try{
 const D=await v.ssrLoadModule('/src/live/bladeDetector.ts'),BT=await v.ssrLoadModule('/src/live/bladeTracking.ts'),BN=await v.ssrLoadModule('/src/live/bladeNet.ts');
 const net=new BN.BladeNet(JSON.parse(readFileSync(process.env.WEIGHTS,'utf8')));
 const RD='/workspace/hema/real/rawframes',out={};let cost=0,n=0;
 for(const f of readdirSync(RD).filter(f=>f.endsWith('.json')).sort()){
  const r=JSON.parse(readFileSync(`${RD}/${f}`,'utf8'));
  const pr=spawnSync('ffprobe',['-v','error','-select_streams','v','-show_entries','stream=width,height,r_frame_rate','-of','csv=p=0',r.path]).stdout.toString().trim().split(',');
  const [vw,vh]=[+pr[0],+pr[1]],[a,b]=pr[2].split('/').map(Number),fps=a/b;
  const W=Math.min(640,vw),H=Math.round(vh*W/vw/2)*2;
  const buf=spawnSync('ffmpeg',['-v','error','-i',r.path,'-vf',`scale=${W}:${H}`,'-f','rawvideo','-pix_fmt','gray','-'],{maxBuffer:1<<30}).stdout;
  const fsz=W*H,nf=Math.floor(buf.length/fsz),tors=[],track=new D.BladeTrack({...D.BLADE_TRACK_DEFAULTS});
  const rows=r.frames.map(fr=>{const lm=fr.landmarks;if(!lm.left_wrist||!lm.left_hip)return null;
   const tp=Math.hypot((lm.left_shoulder.x+lm.right_shoulder.x-lm.left_hip.x-lm.right_hip.x)/2*W,(lm.left_shoulder.y+lm.right_shoulder.y-lm.left_hip.y-lm.right_hip.y)/2*H);
   tors.push(tp);if(tors.length>30)tors.shift();const st=[...tors].sort((a,b)=>a-b)[(tors.length-1)>>1];
   const fi=Math.min(nf-1,Math.round(fr.timestampMs*fps/1000)),hands=[(lm.left_wrist.x+lm.right_wrist.x)/2,(lm.left_wrist.y+lm.right_wrist.y)/2];
   const t0=performance.now();const d=BT.hybridDetect(track,net,{data:buf.subarray(fi*fsz,(fi+1)*fsz),width:W,height:H},hands,st,lm,fr.timestampMs);cost+=performance.now()-t0;n++;
   return {fi,hands,st,d:d?{g:d.guard,t:d.tip,src:d.contrast>0?'track':'net'}:null};});
  out[f.replace('.json','')]={path:r.path,drill:r.drill,W,H,fps,rows};
  const p=rows.filter(Boolean),dt=p.filter(x=>x.d);
  console.log(f,`pose ${p.length}/${rows.length} blade ${dt.length} (track ${dt.filter(x=>x.d.src==='track').length}, net ${dt.filter(x=>x.d.src==='net').length})`);
 }
 writeFileSync(process.env.OUT,JSON.stringify(out));console.log(`${(cost/n).toFixed(2)} ms/frame`);
}finally{await v.close();}
