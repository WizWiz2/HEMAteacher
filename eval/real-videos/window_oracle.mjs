// window_oracle.mjs: DIAGNOSTIC. Upper bound of tighter segmentation: for every real clip, the minimum DTW distance per drill
// over all sub-windows (0.4-3.0 s) of the usable sample stream after calibration. If the own drill becomes nearest and within
// the accept distance, the gap is segmentation; if not, the templates themselves are off. Usage: node window_oracle.mjs <out.json>
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
const ROOT = process.env.APPROOT || '/workspace/hema/real/app/frontend', REAL = '/workspace/hema/real';
const RAWDIR = process.env.RAWDIR || REAL + '/rawframes', FMAP = process.env.FMAP || REAL + '/results/facing_map.json';
const v = await createServer({root: ROOT, configFile: false, logLevel: 'error', server: {middlewareMode: true, hmr: false}, optimizeDeps: {noDiscovery: true, include: []}});
try {
  const {LiveSampleProcessor} = await v.ssrLoadModule('/src/live/sampleProcessor.ts');
  const {CalibrationGate} = await v.ssrLoadModule('/src/live/calibrationGate.ts');
  const CM = await v.ssrLoadModule('/src/drill/continuousMotion.ts');
  const MR = await v.ssrLoadModule('/src/drill/motionRecognition.ts');
  const M = CM.recognitionModel(), fmap = JSON.parse(readFileSync(FMAP)), rows = [];
  const files = readdirSync(RAWDIR).filter(f => f.endsWith('.json')).sort();
  for (const f of files) {
    const c = JSON.parse(readFileSync(RAWDIR + '/' + f)), id = f.slice(0, -5).split('__')[1];
    const p = new LiveSampleProcessor(), cal = new CalibrationGate(); let ok = false; const S = [];
    for (const raw of c.frames) { const s = p.process(raw, fmap[f], 'full_body', 'side'); if (cal.push(s, 'full_body')) ok = true; if (ok && s.motionUsable && s.features) S.push({timeMs: s.timeMs, features: s.features}); }
    const best = {}; let bestOwnWin = null;
    for (let a = 0; a < S.length; a += 3) for (let b = a + 12; b <= S.length && S[b - 1].timeMs - S[a].timeMs <= 3000; b += 3) {
      const seq = MR.prepareSequence(S.slice(a, b), M.pathScales, M.points); if (!seq) continue;
      const r = MR.recognize(seq, M); if (!r) continue;
      for (const [d, x] of Object.entries(r.distances)) if (!(best[d] <= x)) { best[d] = x; if (d === c.drill) bestOwnWin = [S[a].timeMs, S[b - 1].timeMs]; }
    }
    const ranked = Object.entries(best).sort((x, y) => x[1] - y[1]);
    const row = {id, drill: c.drill, n: S.length, own: +(best[c.drill] ?? NaN).toFixed(3), nearest: ranked[0]?.[0], nearestDist: +(ranked[0]?.[1] ?? NaN).toFixed(3), ownRank: ranked.findIndex(x => x[0] === c.drill) + 1, ownWin: bestOwnWin, top3: ranked.slice(0, 3).map(([d, x]) => [d, +x.toFixed(2)])};
    rows.push(row); console.log(id.padEnd(24), c.drill.padEnd(22), 'own', row.own, 'rank', row.ownRank, 'nearest', row.nearest, row.nearestDist);
  }
  writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
  const n = rows.filter(r => r.n), within = rows.filter(r => r.own <= M.acceptDistance), first = rows.filter(r => r.ownRank === 1);
  console.log(`own<=accept ${within.length}/${rows.length}; own nearest ${first.length}/${rows.length}; both ${rows.filter(r => r.ownRank === 1 && r.own <= M.acceptDistance).length}/${rows.length}`);
} finally { await v.close(); }
