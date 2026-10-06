// nn.mjs: representation diagnostic. Each real rep (/tmp/realtpl.json) vs synthetic templates (+ other persons' real reps):
// 1-NN drill and rank of own drill. Strike scoring as in decide (feet weight STRIKE_FEET for strike reps).
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync} from 'node:fs';
const v = await createServer({root: '/workspace/hema-gap/frontend', configFile: false, logLevel: 'error', server: {middlewareMode: true, hmr: false}, optimizeDeps: {noDiscovery: true, include: []}});
try {
  const MR = await v.ssrLoadModule('/src/drill/motionRecognition.ts');
  const m = JSON.parse(readFileSync('/workspace/hema-gap/frontend/src/drill/motionModel.json'));
  const real = JSON.parse(readFileSync('/tmp/realtpl.json'));
  const fw = MR.STRIKE_SCORING.feet, mS = {...m, weights: m.weights.map((w, j) => [9, 10, 11, 12, 13].includes(j) ? w * fw : w)};
  let a = 0, b = 0, n = 0; const lines = [];
  for (const r of real) {
    const mm = r.drill.endsWith('hau') ? mS : m;
    const best = pool => { const d = {}; for (const t of pool) { const x = MR.dtwDistance(r.seq, t.seq, mm); if (!(t.drill in d) || x < d[t.drill]) d[t.drill] = x; } return Object.entries(d).sort((p, q) => p[1] - q[1]); };
    const s = best(m.templates), sr = best([...m.templates, ...real.filter(t => t.body !== r.body)]);
    n++; if (s[0][0] === r.drill) a++; if (sr[0][0] === r.drill) b++;
    lines.push(`${r.body.slice(5).padEnd(8)} ${r.drill.slice(0, 8).padEnd(9)} syn1NN ${s[0][0].slice(0, 8).padEnd(9)}${s[0][1].toFixed(2)} own ${s.find(x => x[0] === r.drill)[1].toFixed(2)} rank ${s.findIndex(x => x[0] === r.drill) + 1} | +real 1NN ${sr[0][0].slice(0, 8).padEnd(9)} rank ${sr.findIndex(x => x[0] === r.drill) + 1}`);
  }
  if (process.env.V) console.log(lines.join('\n'));
  console.log(`1NN own-drill: synthetic only ${a}/${n}, synthetic+other-person real ${b}/${n}  accept ${m.acceptDistance}`);
} finally { await v.close(); }
