// diag.mjs: DIAGNOSTIC ONLY (nothing here changes the app). Compares real public-video attempts with the synthetic reserved
// test clips through the same pipeline (VideoRegressionPage semantics) and the shipped recognition model.
//   node diag.mjs attempts <out.json>            per-attempt distances, per-channel DTW contributions, tempo, path, noise, scale
//   ACCEPT=<d> node diag.mjs sweep <out.json>     own / wrong-drill accepts at acceptDistance=d (real clips + synthetic test M/E)
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
const ROOT = '/workspace/hema/real/app/frontend', REAL = '/workspace/hema/real';
const [mode, out] = process.argv.slice(2);
const v = await createServer({root: ROOT, configFile: false, logLevel: 'error', server: {middlewareMode: true}, optimizeDeps: {noDiscovery: true, include: []}});
try {
  const {LiveSampleProcessor} = await v.ssrLoadModule('/src/live/sampleProcessor.ts');
  const {CalibrationGate} = await v.ssrLoadModule('/src/live/calibrationGate.ts');
  const {stepDrill, createDrillRuntime} = await v.ssrLoadModule('/src/drill/drillEngine.ts');
  const CM = await v.ssrLoadModule('/src/drill/continuousMotion.ts');
  const MR = await v.ssrLoadModule('/src/drill/motionRecognition.ts');
  const {personalizeDrill} = await v.ssrLoadModule('/src/drill/personalize.ts');
  const {adaptDrillForCameraView} = await v.ssrLoadModule('/src/drill/cameraView.ts');
  const MT = await v.ssrLoadModule('/src/drill/motionTraining.ts');
  const ME = await v.ssrLoadModule('/src/drill/motionEvaluation.ts');
  const {loadMotionFixture} = await import(ROOT + '/test-fixtures/loadFixture.mjs');
  const drills = JSON.parse(readFileSync(ROOT + '/public/content/drills.json'));
  const fx = loadMotionFixture();
  const shipped = CM.recognitionModel();
  if (process.env.ACCEPT) CM.setRecognitionModel({...shipped, acceptDistance: +process.env.ACCEPT, acceptByDrill: undefined});
  const M = CM.recognitionModel();
  // one attempt like VideoRegressionPage (stop at the first decided attempt)
  function attempt(frames, drillId, facing) {
    const base = drills.find(d => d.id === drillId), mode = base.trackingMode ?? 'full_body';
    const processor = new LiveSampleProcessor(), calibration = new CalibrationGate();
    let drill = base, runtime = createDrillRuntime(), cal = false;
    for (const raw of frames) {
      const s = processor.process(raw, facing, mode, 'side');
      const ready = calibration.push(s, mode);
      if (runtime.state === 'calibrating' && ready) { drill = adaptDrillForCameraView(personalizeDrill(base, calibration.profile) ?? base, 'side') ?? base; runtime = stepDrill(runtime, drill, {type: 'quality', ok: true}); cal = true; }
      if (runtime.state === 'failed' || runtime.state === 'completed') break;
      const cont = !!CM.motionPatternFor(drill.id);
      if (runtime.state === 'ready' || runtime.state === 'running')
        runtime = stepDrill(runtime, drill, {type: 'sample', timeMs: s.timeMs, features: cont ? s.features : s.smoothed, enoughSamples: cont ? s.motionUsable : s.enough, cameraView: 'side', mode: 'motion'});
    }
    return {state: runtime.state, outcome: runtime.motion?.outcome, message: runtime.motion?.message, cal, samples: runtime.motion?.samples ?? []};
  }
  const realClips = () => {
    const lines = readFileSync(REAL + '/manifest.csv', 'utf8').trim().split('\n'), H = lines[0].split(',');
    const man = Object.fromEntries(lines.slice(1).map(l => { const c = l.split(','); return [c[0], Object.fromEntries(H.map((h, i) => [h, c[i]]))]; }));
    const fmap = JSON.parse(readFileSync(REAL + '/results/facing_map.json'));
    return readdirSync(REAL + '/rawframes').filter(f => f.endsWith('.json')).sort().map(f => {
      const id = f.slice(0, -5).split('__')[1], c = JSON.parse(readFileSync(REAL + '/rawframes/' + f));
      return {set: 'real', id, drill: c.drill, angle: man[id]?.angle, source: man[id]?.video_id, facing: fmap[f], frames: c.frames};
    });
  };
  const synthClips = () => fx.clips.filter(c => ME.isTestClip(c) && MT.CONTINUOUS_DRILLS.includes(c.drill) && c.level !== 'beginner')
    .map(c => ({set: 'synthetic', id: c.id, drill: c.drill, angle: ME.azimuthOf(c), source: c.body, facing: 'right', frames: MT.rawFrames(c, fx.names)}));
  if (mode === 'sweep') {
    const res = {accept: M.acceptDistance, real: {}, synthetic: {}};
    for (const [name, clips] of [['real', realClips()], ['synthetic', synthClips()]]) {
      const r = {own: 0, ownN: 0, strikes: [0, 0], steps: [0, 0], wrong: 0, wrongN: 0};
      for (const c of clips) for (const d of MT.CONTINUOUS_DRILLS) {
        const a = attempt(c.frames, d, c.facing), ok = a.state === 'completed';
        if (d === c.drill) { r.ownN++; r.own += ok; const g = d.endsWith('hau') ? r.strikes : r.steps; g[0] += ok; g[1]++; } else { r.wrongN++; r.wrong += ok; }
      }
      res[name] = r;
    }
    writeFileSync(out, JSON.stringify(res)); console.log(JSON.stringify(res));
  } else {
    const W = M.weights, S = M.scales, CH = MR.CHANNELS;
    // DTW with backtracking (same cost as MR.dtwDistance) -> aligned pairs
    function align(a, b) {
      const n = a.length, band = M.band, cost = Array.from({length: n + 1}, () => new Float64Array(n + 1).fill(Infinity)), from = Array.from({length: n + 1}, () => new Int8Array(n + 1));
      const fd = (x, y) => { let s = 0, w = 0; for (let j = 0; j < x.length; j++) { const p = x[j], q = y[j]; if (p == null || q == null || !Number.isFinite(p) || !Number.isFinite(q)) continue; const d = (p - q) / S[j]; s += W[j] * d * d; w += W[j]; } return w > 0 ? Math.sqrt(s / w) : Infinity; };
      cost[0][0] = 0;
      for (let i = 1; i <= n; i++) for (let j = Math.max(1, i - band); j <= Math.min(n, i + band); j++) {
        let best = cost[i - 1][j - 1], f = 0; if (cost[i - 1][j] < best) { best = cost[i - 1][j]; f = 1; } if (cost[i][j - 1] < best) { best = cost[i][j - 1]; f = 2; }
        cost[i][j] = best + fd(a[i - 1], b[j - 1]); from[i][j] = f;
      }
      const pairs = []; let i = n, j = n; while (i > 0 && j > 0) { pairs.push([i - 1, j - 1]); const f = from[i][j]; if (f === 0) { i--; j--; } else if (f === 1) i--; else j--; }
      return pairs;
    }
    const rows = [];
    for (const c of [...realClips(), ...synthClips()]) {
      const a = attempt(c.frames, c.drill, c.facing), row = {set: c.set, id: c.id, drill: c.drill, angle: c.angle, source: c.source, state: a.state, outcome: a.outcome, message: a.message, cal: a.cal};
      // scale / visibility from raw landmarks
      const tor = [], hgt = [], vis = [];
      for (const f of c.frames) { const L = f.landmarks; if (!L?.left_shoulder || !L?.left_hip || !L?.right_shoulder || !L?.right_hip) continue;
        const sx = (L.left_shoulder.x + L.right_shoulder.x) / 2 * f.width, sy = (L.left_shoulder.y + L.right_shoulder.y) / 2 * f.height, hx = (L.left_hip.x + L.right_hip.x) / 2 * f.width, hy = (L.left_hip.y + L.right_hip.y) / 2 * f.height;
        tor.push(Math.hypot(sx - hx, sy - hy) / f.height); const ys = ['nose', 'left_ankle', 'right_ankle'].map(k => L[k]?.y).filter(Number.isFinite); if (ys.length === 3) hgt.push(Math.max(...ys) - Math.min(...ys));
        vis.push(Math.min(...['left_wrist', 'right_wrist', 'left_ankle', 'right_ankle', 'left_elbow', 'right_elbow'].map(k => L[k]?.visibility ?? 0))); }
      const med = x => x.length ? [...x].sort((p, q) => p - q)[Math.floor(x.length / 2)] : NaN;
      Object.assign(row, {torsoFrac: +med(tor).toFixed(3), heightFrac: +med(hgt).toFixed(3), minLimbVis: +med(vis).toFixed(2), fps: +(1000 * (c.frames.length - 1) / (c.frames.at(-1).timestampMs - c.frames[0].timestampMs)).toFixed(1), res: `${c.frames[0].width}x${c.frames[0].height}`});
      const smp = a.samples;
      if (smp.length > 3) {
        const seq = MR.prepareSequence(smp, M.pathScales, M.points), r = seq && MR.recognize(seq, M);
        if (r) {
          const own = M.templates.filter(t => t.drill === c.drill).map(t => ({t, d: MR.dtwDistance(seq, t.seq, M)})).sort((p, q) => p.d - q.d)[0];
          const share = CH.map(() => 0), absd = CH.map(() => [0, 0]);
          for (const [i, j] of align(seq, own.t.seq)) { let wsum = 0; const cs = CH.map((_, k) => { const p = seq[i][k], q = own.t.seq[j][k]; if (p == null || q == null || !Number.isFinite(p) || !Number.isFinite(q)) return 0; const d = (p - q) / S[k]; wsum += W[k]; absd[k][0] += Math.abs(d); absd[k][1]++; return W[k] * d * d; });
            cs.forEach((x, k) => { share[k] += wsum ? x / wsum : 0; }); }
          const tot = share.reduce((p, q) => p + q, 0);
          const raw = smp.map(s => MR.frameChannels(s.features)), rng = k => { const x = raw.map(r => r[k]).filter(Number.isFinite); return x.length ? Math.max(...x) - Math.min(...x) : NaN; };
          const jit = k => { const x = raw.map(r => r[k]); const e = []; for (let i = 1; i < x.length - 1; i++) if ([x[i - 1], x[i], x[i + 1]].every(Number.isFinite)) e.push(Math.abs(x[i] - (x[i - 1] + x[i + 1]) / 2)); return med(e); };
          const handPath = (() => { let s = 0; for (let i = 1; i < raw.length; i++) { const d = Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]); if (Number.isFinite(d)) s += d; } return s; })();
          // best own distance over prefixes of the attempt (does trailing motion after the movement inflate the distance?)
          let bestPrefix = Infinity, bestEnd = null;
          for (let e = Math.max(6, Math.floor(smp.length * .3)); e <= smp.length; e += 2) { const sq = MR.prepareSequence(smp.slice(0, e), M.pathScales, M.points); if (!sq) continue; const rr = MR.recognize(sq, M); const dd = rr?.distances[c.drill]; if (dd < bestPrefix) { bestPrefix = dd; bestEnd = e; } }
          Object.assign(row, {best: r.best, bestDist: +r.bestDistance.toFixed(3), own: +r.distances[c.drill].toFixed(3), nearestTemplate: `${own.t.body}/${own.t.level}`,
            share: Object.fromEntries(CH.map((n, k) => [n, +(share[k] / tot).toFixed(3)])), meanAbsZ: Object.fromEntries(CH.map((n, k) => [n, absd[k][1] ? +(absd[k][0] / absd[k][1]).toFixed(2) : null])),
            attemptMs: smp.at(-1).timeMs - smp[0].timeMs, activeMs: Math.round(MR.activeDurationMs(smp, M.pathScales)), tempo: +(MR.activeDurationMs(smp, M.pathScales) / M.typicalMs[c.drill]).toFixed(2),
            pathRatio: +(MR.sequencePath(seq, M.pathScales) / M.typicalPath[c.drill]).toFixed(2), handRangeX: +rng(0).toFixed(2), handRangeY: +rng(1).toFixed(2), rootRange: +rng(13).toFixed(2),
            ankleRange: +Math.max(rng(9), rng(10)).toFixed(2), startHOH: +med(raw.slice(0, 3).map(r => r[2]).filter(Number.isFinite)).toFixed(2), minHOH: +Math.min(...raw.map(r => r[2]).filter(Number.isFinite)).toFixed(2), maxHOH: +Math.max(...raw.map(r => r[2]).filter(Number.isFinite)).toFixed(2), startHandX: +med(raw.slice(0, 3).map(r => r[0]).filter(Number.isFinite)).toFixed(2), handPath: +handPath.toFixed(2), jitHand: +jit(0).toFixed(4), jitAnkle: +jit(9).toFixed(4), nSamples: smp.length,
            bestPrefixOwn: +bestPrefix.toFixed(3), bestPrefixFrac: bestEnd ? +(bestEnd / smp.length).toFixed(2) : null});
        }
      }
      rows.push(row);
    }
    writeFileSync(out, JSON.stringify(rows, null, 1)); console.log('rows', rows.length);
  }
} finally { await v.close(); }
