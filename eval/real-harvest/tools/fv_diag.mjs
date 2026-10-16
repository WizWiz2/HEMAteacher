// fv_diag.mjs: front-mode pipeline diagnosis on real clips (harvest + seen; never fresh).
// Per clip x mode (side | front | front with MediaPipe z zeroed): ankle_x jitter (median |frame-to-frame delta|, torso units),
// fraction of frame pairs stable enough to arm (pattern-vector RMS delta < .035), longest stable run (ms; arming needs 200),
// and whole-clip path length on the recognition path channels relative to the side-mode path.
// Usage: APPROOT=... CLIPS=clips.json node fv_diag.mjs [out.json]
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync, writeFileSync} from 'node:fs';
const ROOT = process.env.APPROOT || '/workspace/hema-fv/frontend';
const clips = JSON.parse(readFileSync(process.env.CLIPS || '/workspace/hema/harvest/clips.json')).filter(c => c.set !== 'fresh' && (process.env.ALL || c.view === 'front'));
const v = await createServer({root: ROOT, configFile: false, logLevel: 'error', server: {middlewareMode: true, hmr: false}, optimizeDeps: {noDiscovery: true, include: []}});
try {
  const {LiveSampleProcessor} = await v.ssrLoadModule('/src/live/sampleProcessor.ts');
  const CM = await v.ssrLoadModule('/src/drill/continuousMotion.ts'), MR = await v.ssrLoadModule('/src/drill/motionRecognition.ts');
  const base = CM.recognitionModel();
  const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  const rows = [];
  for (const c of clips) {
    const frames = JSON.parse(readFileSync(c.raw)).frames;
    const pat = CM.motionPatternFor(c.drill); if (!pat) continue;
    const res = {};
    for (const mode of ['side', 'front', 'front_noz']) {
      const view = mode === 'side' ? 'side' : 'front', p = new LiveSampleProcessor(), S = [];
      for (const f of frames) {
        const raw = mode === 'front_noz' ? {...f, landmarks: Object.fromEntries(Object.entries(f.landmarks).map(([k, l]) => [k, {...l, z: 0}]))} : f;
        const s = p.process(raw, c.facing, 'full_body', view);
        if (s.motionUsable) S.push({timeMs: s.timeMs, features: s.features, vec: pat.features.map(n => s.features?.[n] ?? NaN)});
      }
      const jit = S.slice(1).map((s, i) => Math.abs(s.features.left_ankle_x - S[i].features.left_ankle_x)), rj = S.slice(1).map((s, i) => Math.abs(s.features.root_x - S[i].features.root_x));
      const d = S.slice(1).map((s, i) => Math.sqrt(s.vec.reduce((a, x, k) => a + (x - S[i].vec[k]) ** 2, 0) / s.vec.length));
      let run = 0, best = 0; d.forEach((x, i) => { if (x < .035 && S[i + 1].timeMs - S[i].timeMs < 400) { run += S[i + 1].timeMs - S[i].timeMs; best = Math.max(best, run); } else run = 0; });
      const seq = S.length > 5 ? MR.prepareSequence(S, base.pathScales, base.points) : null;
      res[mode] = {n: S.length, jitter: +med(jit).toFixed(3), rootj: +med(rj).toFixed(3), stable: +(d.filter(x => x < .035).length / Math.max(1, d.length)).toFixed(2), run: best,
        path: seq ? +MR.sequencePath(seq, base.pathScales).toFixed(2) : NaN};
    }
    rows.push({clip: c.id, set: c.set, drill: c.drill, view: c.view, ...res});
    const r = res, f = (m) => `${String(r[m].jitter).padStart(6)} ${String(r[m].stable).padStart(5)} ${String(r[m].run).padStart(5)} ${String(r[m].path).padStart(6)}`;
    console.log(`${c.id.padEnd(26)} ${c.drill.padEnd(22)} side ${f('side')} | front ${f('front')} | front_noz ${f('front_noz')}`);
  }
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(rows));
} finally { await v.close(); }
