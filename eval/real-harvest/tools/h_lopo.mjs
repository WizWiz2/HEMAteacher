// h_lopo.mjs: real-harvest templates + evaluation (eval only; injects templates via CM.setRecognitionModel).
// Usage: CLIPS=clips.json CFG=syn|mix|real SETS=harvest,seen,heldout[,fresh] [VIEWOVR=side] node h_lopo.mjs out.json
// Templates: bursts (hand path strikes / feet path steps) of harvest clips that are NOT held out; chained reps split at speed minima.
// harvest set = leave-one-person-out; seen/heldout/fresh = all harvest templates except the same person.
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync, writeFileSync} from 'node:fs';
const ROOT = process.env.APPROOT || '/workspace/hema-front/frontend';
const CFG = process.env.CFG || 'mix', SETS = (process.env.SETS || 'harvest,seen,heldout').split(','), out = process.argv[2];
const PAD = +(process.env.PAD || 250), THR = +(process.env.THR || 0.3), REPMIN = +(process.env.REPMIN || 0.5), SPLIT = +(process.env.SPLIT || 1200);
const TPLSRC = (process.env.TPLSRC || 'harvest').split(',');
const clipsAll = JSON.parse(readFileSync(process.env.CLIPS || '/workspace/hema/harvest/clips.json'));
const v = await createServer({root: ROOT, configFile: false, logLevel: 'error', server: {middlewareMode: true, hmr: false}, optimizeDeps: {noDiscovery: true, include: []}});
try {
  const {LiveSampleProcessor} = await v.ssrLoadModule('/src/live/sampleProcessor.ts');
  const {CalibrationGate} = await v.ssrLoadModule('/src/live/calibrationGate.ts');
  const {stepDrill, createDrillRuntime} = await v.ssrLoadModule('/src/drill/drillEngine.ts');
  const CM = await v.ssrLoadModule('/src/drill/continuousMotion.ts');
  const MR = await v.ssrLoadModule('/src/drill/motionRecognition.ts');
  const {personalizeDrill} = await v.ssrLoadModule('/src/drill/personalize.ts');
  const {adaptDrillForCameraView} = await v.ssrLoadModule('/src/drill/cameraView.ts');
  const MT = await v.ssrLoadModule('/src/drill/motionTraining.ts');
  const drills = JSON.parse(readFileSync(ROOT + '/public/content/drills.json'));
  const MV = process.env.VIEWOVR === 'front' ? 'front' : 'side';  // model slot evaluated (front: per-view model on fix/front-view)
  const base = CM.recognitionModel(MV);
  const DR = MT.CONTINUOUS_DRILLS;
  const viewOf = c => process.env.VIEWOVR || c.view;
  function attempt(frames, drillId, facing, view) {
    const b = drills.find(d => d.id === drillId), mode = b.trackingMode ?? 'full_body';
    const processor = new LiveSampleProcessor(), calibration = new CalibrationGate();
    let drill = b, runtime = createDrillRuntime(), started = false;
    for (const raw of frames) {
      const s = processor.process(raw, facing, mode, view); const ready = calibration.push(s, mode);
      if (runtime.state === 'calibrating' && ready) { drill = adaptDrillForCameraView(personalizeDrill(b, calibration.profile) ?? b, view) ?? b; runtime = stepDrill(runtime, drill, {type: 'quality', ok: true}); }
      if (runtime.state === 'failed' || runtime.state === 'completed') break;
      const cont = !!CM.motionPatternFor(drill.id);
      if (runtime.state === 'ready' || runtime.state === 'running') {
        runtime = stepDrill(runtime, drill, {type: 'sample', timeMs: s.timeMs, features: cont ? s.features : s.smoothed, enoughSamples: cont ? s.motionUsable : s.enough, cameraView: view, mode: 'motion'});
        if (runtime.state === 'running') started = true; }
    }
    const msg = runtime.motion?.message ?? '';
    const funnel = runtime.state === 'completed' ? 'accepted' : runtime.motion?.outcome === 'other_drill' ? 'other'
      : runtime.motion?.outcome === 'tracking_lost' ? 'tracking' : !started && runtime.state !== 'failed' ? 'no_start'
      : runtime.state === 'failed' ? 'short' : msg.includes('Продолжай') ? 'short' : 'no_decision';
    return {state: runtime.state, funnel};
  }
  function allSamples(frames, facing, view) {
    const processor = new LiveSampleProcessor(), o = [];
    for (const raw of frames) { const s = processor.process(raw, facing, 'full_body', view); if (s.motionUsable) o.push({timeMs: s.timeMs, features: s.features}); }
    return o;
  }
  function reps(samples, strike) {
    const js = strike ? [0, 1] : [9, 10, 13], ps = base.pathScales;
    const rows = samples.map(s => MR.frameChannels(s.features));
    const sm = rows.map((_, i) => js.map(j => { const w = rows.slice(Math.max(0, i - 2), i + 3).map(r => r[j]).filter(Number.isFinite); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : NaN; }));
    const sp = sm.map((r, i) => { if (!i) return 0; let s = 0, n = 0; r.forEach((x, k) => { const d = (x - sm[i - 1][k]) / ps[js[k]]; if (Number.isFinite(d)) { s += d * d; n++; } });
      const dt = (samples[i].timeMs - samples[i - 1].timeMs) / 1000; return n && dt > 0 ? Math.sqrt(s / n) / dt : 0; });
    const sps = sp.map((_, i) => { const w = sp.slice(Math.max(0, i - 3), i + 4); return w.reduce((a, b) => a + b, 0) / w.length; });
    const mx = Math.max(...sps); if (!(mx > 0)) return [];
    let regs = []; let cur = null;
    sps.forEach((x, i) => { if (x >= THR * mx) { if (cur && samples[i].timeMs - samples[cur.e].timeMs < 250) cur.e = i; else { cur = {s: i, e: i}; regs.push(cur); } } });
    // split long (chained) regions at local speed minima
    const split = [];
    for (const r of regs) {
      if (samples[r.e].timeMs - samples[r.s].timeMs <= SPLIT) { split.push(r); continue; }
      let s0 = r.s;
      for (let i = r.s + 3; i < r.e - 3; i++) {
        const loc = sps.slice(i - 3, i + 4), lmax = Math.max(...sps.slice(s0, Math.min(r.e, i + 8)));
        if (sps[i] === Math.min(...loc) && sps[i] < 0.6 * lmax && samples[i].timeMs - samples[s0].timeMs >= 250) { split.push({s: s0, e: i, ch: true}); s0 = i; }
      }
      split.push({s: s0, e: r.e, ch: true});
    }
    return split.map(r => ({...r, peak: Math.max(...sps.slice(r.s, r.e + 1))})).filter(r => r.peak >= REPMIN * mx && samples[r.e].timeMs - samples[r.s].timeMs >= 200)
      .map(r => { const pad = r.ch ? 80 : PAD, t0 = samples[r.s].timeMs - pad, t1 = samples[r.e].timeMs + pad; return {t0, t1, atStart: r.s < 6, win: samples.filter(s => s.timeMs >= t0 && s.timeMs <= t1)}; });
  }
  const clips = clipsAll.map(c => ({...c, frames: JSON.parse(readFileSync(c.raw)).frames}));
  const tpls = [], tlog = [];
  for (const c of clips.filter(c => TPLSRC.includes(c.set) && !c.heldout && c.weapon.startsWith('longsword') && c.clean && DR.includes(c.drill))) {
    const strike = c.drill.endsWith("hau"), view = viewOf(c);
    for (const [k, r] of reps(allSamples(c.frames, c.facing, view), strike).entries()) {
      let w = r.win; if (strike && MR.HAND_TRIM?.on) w = MR.strikeWindow(w, base.pathScales);
      const seq = w.length > 5 ? MR.prepareSequence(w, base.pathScales, base.points) : null;
      if (!seq) continue;
      const T = w.at(-1).timeMs, rev = MR.prepareSequence([...w].reverse().map(s => ({...s, timeMs: T - s.timeMs})), base.pathScales, base.points);
      const own = base.templates.filter(t => t.drill === c.drill), dmin = q => Math.min(...own.map(t => MR.dtwDistance(q, t.seq, base)));
      const path = MR.sequencePath(seq, base.pathScales), tp = base.typicalPath[c.drill];
      const fwd = dmin(seq), bwd = rev ? dmin(rev) : Infinity;
      const why = r.atStart ? 'start' : path < 0.4 * tp ? 'short' : path > 3 * tp ? 'long' : (!c.chained && fwd >= bwd) ? 'reversed' : '';
      tlog.push([c.id, k, (r.t0 / 1000).toFixed(2), (r.t1 / 1000).toFixed(2), (path / tp).toFixed(2), why || 'KEEP'].join(' '));
      if (why) continue;
      tpls.push({drill: c.drill, body: 'real:' + c.person, level: 'master', durationMs: w.at(-1).timeMs - w[0].timeMs, seq, src: c.id});
    }
  }
  const tcount = Object.entries(tpls.reduce((a, t) => (a[t.drill] = (a[t.drill] || 0) + 1, a), {})).map(x => x.join(':')).join(' ');
  console.log(`CFG ${CFG} real templates ${tpls.length} (${tcount}) persons ${new Set(tpls.map(t => t.body)).size}`);
  if (process.env.TLOG) writeFileSync(process.env.TLOG, tlog.join('\n') + '\n');
  if (process.env.ADDOUT) writeFileSync(process.env.ADDOUT, JSON.stringify(tpls));
  const realDrills = new Set(tpls.map(t => t.drill));
  function modelFor(person) {
    if (CFG === 'syn') return base;
    // built: APPROOT's shipped model already contains real:train templates (build_real_fixture.py); drop the evaluated person's
    if (CFG === 'built') { const sl = 'real:' + person.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
      return {...base, templates: base.templates.filter(t => t.body !== sl)}; }
    const extra = tpls.filter(t => t.body !== 'real:' + person).map(({src, ...t}) => t);
    const keep = CFG === 'real' ? base.templates.filter(t => !realDrills.has(t.drill)) : base.templates;
    return {...base, templates: [...keep, ...extra]};
  }
  const rows = [];
  for (const set of SETS) {
    const ev = clips.filter(c => c.set === (set === 'heldout' ? 'harvest' : set) && DR.includes(c.drill) && (set === 'heldout' ? c.heldout : set === 'harvest' ? !c.heldout : true));
    for (const person of [...new Set(ev.map(c => c.person))]) {
      CM.setRecognitionModel(modelFor(person), MV);
      for (const c of ev.filter(x => x.person === person)) for (const d of DR) {
        const a = attempt(c.frames, d, c.facing, viewOf(c));
        rows.push({set, clip: c.id, person, drill: c.drill, view: c.view, evview: viewOf(c), clean: c.clean, weapon: c.weapon, selected: d, own: d === c.drill, accepted: a.state === 'completed', funnel: a.funnel});
      }
    }
  }
  CM.setRecognitionModel(base, MV);
  if (out) writeFileSync(out, JSON.stringify({cfg: CFG, templates: tcount, rows}));
  const CORE = new Set((process.env.CORE || 'zornhau,zwerchhau,schielhau,passing-step-forward,advance').split(','));
  const S = f => { const x = rows.filter(f); return `${x.filter(r => r.accepted).length}/${x.length}`; };
  for (const set of SETS) for (const [nm, ok] of [['all', r => true], ['front', r => r.view === 'front'], ['side', r => r.view === 'side']]) {
    const base_ = r => r.set === set && ok(r); if (!rows.some(base_)) continue;
    console.log(`${set.padEnd(8)} ${nm.padEnd(5)} own ${S(r => base_(r) && r.own)} | core own ${S(r => base_(r) && r.own && CORE.has(r.drill))} | wrong ${S(r => base_(r) && !r.own)}`);
  }
  const FN = ['no_start', 'no_decision', 'short', 'tracking', 'other', 'accepted'];
  for (const set of SETS) { const o = rows.filter(r => r.set === set && r.own); console.log(`funnel ${set} (${o.length}):`, FN.map(f => `${f} ${o.filter(r => r.funnel === f).length}`).join(' | ')); }
  console.log('accepted own:', rows.filter(r => r.own && r.accepted).map(r => r.set + ':' + r.clip).join(' '));
  console.log('wrong:', rows.filter(r => !r.own && r.accepted).map(r => r.set + ':' + r.clip + '->' + r.selected).join(' '));
} finally { await v.close(); }
