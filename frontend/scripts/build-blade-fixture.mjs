// Builds test-fixtures/motion-blade.json.gz: the experimental blade detector + temporal track (src/live/bladeDetector.ts,
// scanBlade + BladeTrack with defaults; only accepted frames are stored) run
// on every fixture clip's video, with the MediaPipe hands/torso/body landmarks of the pose fixture as its inputs (as in
// the app). Frames are downscaled to <= 640 px wide and converted to grey with ffmpeg. Needs the rendered videos:
// main clips under test-data/mock-videos, bodies/angles clips under <baRoot>/<split>/<drill>/<name>.mp4 and held-out
// clips under <heldoutRoot>/<variant>/<drill>/<body>_<level>.mp4 (docs/blade-tracking.md).
// Usage (repo root): node frontend/scripts/build-blade-fixture.mjs <baRoot> <heldoutRoot>
import {createServer} from 'vite';import {writeFileSync,existsSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {gzipSync} from 'node:zlib';
const [baRoot,heldoutRoot,only]=process.argv.slice(2);
const v=await createServer({root:'frontend',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'});
try {
 const D=await v.ssrLoadModule('/src/live/bladeDetector.ts');
 const {loadMotionFixture}=await import('../test-fixtures/loadFixture.mjs');
 const fx=loadMotionFixture(),N=fx.names,I=Object.fromEntries(N.map((n,i)=>[n,i]));
 const opt={...D.BLADE_DETECTOR_DEFAULTS,minContrast:0};
 const pathOf=c=>{const id=c.id;
  if(id.startsWith('ba:')){const [sp,dr,nm]=id.slice(3).split('/');return `${baRoot}/${sp}/${dr}/${nm}.mp4`;}
  if(id.startsWith('main/')){const [,dr,nm]=id.split('/');return `test-data/mock-videos/${dr}/${nm}.mp4`;}
  const [,dr,rest]=id.split('/');const vr=c.variant.split(':')[1];return `${heldoutRoot}/${vr}/${dr}/${rest.slice(vr.length+1)}.mp4`;};
 const clips={},cost={ms:0,n:0};
 for(const c of fx.clips.filter(c=>!only||c.drill.endsWith('hau'))){
  const p=pathOf(c);if(!existsSync(p)){console.log('no video (skipped):',p);continue;}
  const W=Math.min(640,c.width),H=Math.round(c.height*W/c.width/2)*2;
  const buf=spawnSync('ffmpeg',['-v','error','-i',p,'-vf',`scale=${W}:${H}`,'-f','rawvideo','-pix_fmt','gray','-'],{maxBuffer:1<<30}).stdout;
  const fsz=W*H,nf=Math.floor(buf.length/fsz),tors=[],track=new D.BladeTrack();let ms=0;
  clips[c.id]=c.t.map((t,i)=>{const q=c.p[i];if(!q.length)return [];
   const lm={};for(const k of N)lm[k]={x:q[I[k]*3]/1e4,y:q[I[k]*3+1]/1e4,visibility:q[I[k]*3+2]/100};
   const tp=Math.hypot((lm.left_shoulder.x+lm.right_shoulder.x-lm.left_hip.x-lm.right_hip.x)/2*W,(lm.left_shoulder.y+lm.right_shoulder.y-lm.left_hip.y-lm.right_hip.y)/2*H);
   tors.push(tp);if(tors.length>30)tors.shift();const st=[...tors].sort((a,b)=>a-b)[(tors.length-1)>>1];
   const fi=Math.min(nf-1,Math.round(t*30/1000));
   const t0=performance.now();
   const scan=D.scanBlade({data:buf.subarray(fi*fsz,(fi+1)*fsz),width:W,height:H},[(lm.left_wrist.x+lm.right_wrist.x)/2,(lm.left_wrist.y+lm.right_wrist.y)/2],st,opt,D.bodyPoints(lm),D.shoulderCentre(lm));
   const d=track.update(scan,t);cost.ms+=performance.now()-t0;cost.n++;
   return d?[...d.guard,...d.tip].map(x=>Math.round(x*1e4)).concat([Math.round(d.contrast*100)]):[];});
 }
 const out={version:1,source:'frontend/src/live/bladeDetector.ts (scanBlade + BladeTrack, defaults; accepted frames only) on the fixture clip videos (<=640 px grey), MediaPipe hands/torso from motion-poses.json.gz; per frame [guard x, guard y, tip x, tip y]*1e4 + confidence*100, [] = no pose',clips:Object.fromEntries(Object.entries(clips).sort())};
 writeFileSync('frontend/test-fixtures/motion-blade.json.gz',gzipSync(JSON.stringify(out),{level:9}));
 console.log(Object.keys(clips).length,'clips -> frontend/test-fixtures/motion-blade.json.gz',(cost.ms/cost.n).toFixed(2),'ms/frame (scan+track, node)');
}finally{await v.close();}
