// trace.mjs: per seen clip (own drill), every attempt decision: window, trimmed hand share, nearest drills (strike scoring as in decide).
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync, readdirSync} from 'node:fs';
const ROOT = process.env.APPROOT || '/workspace/hema-gap/frontend', REAL = '/workspace/hema/real';
const RAWDIR = process.env.RAWDIR || REAL + '/rawframes', FMAP = process.env.FMAP || REAL + '/results/facing_map.json';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : /hau/;
const v = await createServer({root: ROOT, configFile: false, logLevel: 'error', server: {middlewareMode: true, hmr: false}, optimizeDeps: {noDiscovery: true, include: []}});
try {
  const {LiveSampleProcessor} = await v.ssrLoadModule('/src/live/sampleProcessor.ts');
  const {CalibrationGate} = await v.ssrLoadModule('/src/live/calibrationGate.ts');
  const {stepDrill, createDrillRuntime} = await v.ssrLoadModule('/src/drill/drillEngine.ts');
  const CM = await v.ssrLoadModule('/src/drill/continuousMotion.ts');
  const MR = await v.ssrLoadModule('/src/drill/motionRecognition.ts');
  const {personalizeDrill} = await v.ssrLoadModule('/src/drill/personalize.ts');
  const {adaptDrillForCameraView} = await v.ssrLoadModule('/src/drill/cameraView.ts');
  const drills = JSON.parse(readFileSync(ROOT + '/public/content/drills.json'));
  const m = CM.recognitionModel(); const fmap = JSON.parse(readFileSync(FMAP));
  const feetW = {...m, weights: m.weights.map((w, j) => [9, 10, 11, 12, 13].includes(j) ? w * MR.STRIKE_SCORING.feet : w)};
  for (const f of readdirSync(RAWDIR).filter(f => f.endsWith('.json') && ONLY.test(f)).sort()) {
    const c = JSON.parse(readFileSync(RAWDIR + '/' + f)), facing = fmap[f], id = c.drill;
    const b = drills.find(d => d.id === id); let drill = b, rt = createDrillRuntime();
    const P = new LiveSampleProcessor(), cal = new CalibrationGate(); const log = []; let armedAt = null, n = 0, usable = 0;
    for (const raw of c.frames) {
      const s = P.process(raw, facing, 'full_body', 'side'); n++; if (s.motionUsable) usable++;
      if (rt.state === 'calibrating' && cal.push(s, 'full_body')) { drill = adaptDrillForCameraView(personalizeDrill(b, cal.profile) ?? b, 'side') ?? b; rt = stepDrill(rt, drill, {type: 'quality', ok: true}); log.push(`cal@${(s.timeMs/1000).toFixed(1)}`); continue; }
      if (rt.state === 'failed' || rt.state === 'completed') break;
      if (rt.state !== 'ready' && rt.state !== 'running') { cal.push(s, 'full_body'); continue; }
      const prev = rt; rt = stepDrill(rt, drill, {type: 'sample', timeMs: s.timeMs, features: s.features, enoughSamples: s.motionUsable, cameraView: 'side', mode: 'motion'});
      if (rt.motion?.phase === 'armed' && prev.motion?.phase !== 'armed') log.push(`armed@${(s.timeMs/1000).toFixed(1)}`);
      const judged = rt.state === 'failed' || rt.state === 'completed' || (prev.motion?.settledSince !== undefined && rt.motion?.settledSince === undefined && rt.motion?.message === 'Продолжай движение до конца') || (rt.state === 'ready' && prev.state === 'running');
      if (judged && rt.motion?.samples?.length > 3) {
        const smp = rt.motion.samples, w = id.endsWith('hau') && MR.HAND_TRIM.on ? MR.strikeWindow(smp, m.pathScales) : smp;
        const seq = MR.prepareSequence(w, m.pathScales, m.points), r = seq && MR.recognize(seq, id.endsWith('hau') ? feetW : m);
        const top = r ? Object.entries(r.distances).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([d, x]) => `${d.slice(0, 6)}:${x.toFixed(2)}`).join(' ') : '-';
        log.push(`[${(smp[0].timeMs/1000).toFixed(1)}-${(smp.at(-1).timeMs/1000).toFixed(1)} trim ${(w[0].timeMs/1000).toFixed(1)}-${(w.at(-1).timeMs/1000).toFixed(1)} hs ${MR.handShareOf(w, m.pathScales).toFixed(2)} own ${r?.distances[id]?.toFixed(2)} | ${top} -> ${rt.state}]`);
      }
    }
    console.log(f.split('__')[1].slice(0, -5).padEnd(22), `usable ${usable}/${n}`, rt.state, (rt.motion?.message ?? '').slice(0, 30), '\n   ', log.join(' '));
  }
} finally { await v.close(); }
