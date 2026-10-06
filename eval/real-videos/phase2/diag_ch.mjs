// diag_ch.mjs <checkoutRoot> <raw.json> <drill> <facing>: own-drill attempt -> per-channel cost vs nearest template of each drill
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';import {readFileSync} from 'node:fs';
const [root, file, drillId, facing='right'] = process.argv.slice(2); const fe = root + '/frontend';
const v = await createServer({root: fe, configFile: false, logLevel: 'error', server: {middlewareMode: true, hmr: false}, optimizeDeps: {noDiscovery: true, include: []}});
try {
  const {LiveSampleProcessor} = await v.ssrLoadModule('/src/live/sampleProcessor.ts'); const {CalibrationGate} = await v.ssrLoadModule('/src/live/calibrationGate.ts');
  const {stepDrill, createDrillRuntime} = await v.ssrLoadModule('/src/drill/drillEngine.ts'); const CM = await v.ssrLoadModule('/src/drill/continuousMotion.ts');
  const MR = await v.ssrLoadModule('/src/drill/motionRecognition.ts'); const M = JSON.parse(readFileSync(fe + '/src/drill/motionModel.json'));
  const drills = JSON.parse(readFileSync(fe + '/public/content/drills.json')); const drill = drills.find(d => d.id === drillId);
  const P = new LiveSampleProcessor(), C = new CalibrationGate(); let rt = createDrillRuntime(); let samples = [];
  for (const raw of JSON.parse(readFileSync(file)).frames) { const s = P.process(raw, facing, 'full_body', 'side'); const ready = C.push(s, 'full_body');
    if (rt.state === 'calibrating' && ready) rt = stepDrill(rt, drill, {type: 'quality', ok: true});
    if (rt.state === 'ready' || rt.state === 'running') rt = stepDrill(rt, drill, {type: 'sample', timeMs: s.timeMs, features: s.features, enoughSamples: s.motionUsable, cameraView: 'side', mode: 'motion'});
    if (rt.motion?.samples?.length) samples = rt.motion.samples; if (rt.state === 'failed' || rt.state === 'completed') break; }
  const seq = MR.prepareSequence(samples, M.pathScales, M.points); console.log('state', rt.state, 'samples', samples.length, 'dur', samples.length ? samples.at(-1).timeMs - samples[0].timeMs : 0, 'hand_share end', seq?.at(-1)[17]?.toFixed?.(2));
  const best = {}; for (const t of M.templates) { const d = MR.dtwDistance(seq, t.seq, M); if (!(t.drill in best) || d < best[t.drill].d) best[t.drill] = {d, t}; }
  const ch = (a, b) => M.channels.map((c, j) => { let s = 0, n = 0; for (let p = 0; p < a.length; p++) { const x = a[p][j], y = b[p][j]; if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue; s += M.weights[j] * ((x - y) / M.scales[j]) ** 2; n++; } return n ? s / n : 0; });
  for (const [d, {d: dist, t}] of Object.entries(best).sort((a, b) => a[1].d - b[1].d).slice(0, 4)) { const c = ch(seq, t.seq); const top = M.channels.map((n, j) => [n, c[j]]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(d.padEnd(22), dist.toFixed(2), t.body, t.level, 'tpl hand_share end', t.seq.at(-1)[17], '| top cost', top.map(([n, x]) => n + ':' + x.toFixed(1)).join(' ')); }
} finally { await v.close(); }
