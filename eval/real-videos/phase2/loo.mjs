// loo.mjs <fixture.gz>: build model (no writes) and print top leave-one-out same-drill distances + accept (run from hema-gap root)
import {createServer} from '/workspace/hema-gap/frontend/node_modules/vite/dist/node/index.js';import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
const v=await createServer({root:'frontend',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'});
try{const T=await v.ssrLoadModule('/src/drill/motionTraining.ts');const MR=await v.ssrLoadModule('/src/drill/motionRecognition.ts');
const fx=JSON.parse(gunzipSync(readFileSync(process.argv[2])).toString());const train=fx.clips.filter(T.isTrainClip);const m=T.buildModel(train,fx.names);
const loo=m.templates.map((t,i)=>({d:t.drill,b:t.body,l:t.level,x:Math.min(...m.templates.filter((u,k)=>k!==i&&u.drill===t.drill).map(u=>MR.dtwDistance(t.seq,u.seq,m)))}));
loo.sort((a,b)=>b.x-a.x);console.log('accept',m.acceptDistance,'templates',m.templates.length);for(const r of loo.slice(0,15))console.log(r.x.toFixed(3),r.d,r.b,r.l);
console.log('scales',JSON.stringify(m.scales));}finally{await v.close();}
