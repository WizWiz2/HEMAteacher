// lopo.mjs: Phase 3 EXPERIMENT. Real-derived templates from the SEEN clips (never fresh), leave-one-person-out.
// Reps are cut from each source clip by activity bursts (hand path for strikes, feet path for steps) and turned into
// templates with the model's own prepareSequence. Each seen person is replayed (own + 9 drills) against the synthetic
// model + real templates of the OTHER persons. Env: APPROOT, MODE=lopo|none|dump, SRC=clean|all, ADDOUT=<templates.json>
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
const ROOT = process.env.APPROOT || '/workspace/hema-gap/frontend', REAL = '/workspace/hema/real';
const RAWDIR = process.env.RAWDIR || REAL + '/rawframes', FMAP = process.env.FMAP || REAL + '/results/facing_map.json';
const MODE = process.env.MODE || 'lopo', SRC = process.env.SRC || 'clean', out = process.argv[2];
const PAD = +(process.env.PAD || 250), THR = +(process.env.THR || 0.3), REPMIN = +(process.env.REPMIN || 0.5);
const man = Object.fromEntries(readFileSync(REAL + '/manifest.csv', 'utf8').trim().split('\n').slice(1).map(l => {
  const c = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(x => x.replace(/,$/, '').replace(/^"|"$/g, '')); return [c[0], {drill: c[1], weapon: c[14], clean: c[16]}]; }));
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
  const base = CM.recognitionModel();
  const DR = MT.CONTINUOUS_DRILLS.filter(d => d !== 'guards-basic');
  function attempt(frames, drillId, facing) {
    const b = drills.find(d => d.id === drillId), mode = b.trackingMode ?? 'full_body';
    const processor = new LiveSampleProcessor(), calibration = new CalibrationGate();
    let drill = b, runtime = createDrillRuntime(), started = false, judged = 0;
    for (const raw of frames) {
      const s = processor.process(raw, facing, mode, 'side'); const ready = calibration.push(s, mode);
      if (runtime.state === 'calibrating' && ready) { drill = adaptDrillForCameraView(personalizeDrill(b, calibration.profile) ?? b, 'side') ?? b; runtime = stepDrill(runtime, drill, {type: 'quality', ok: true}); }
      if (runtime.state === 'failed' || runtime.state === 'completed') break;
      const cont = !!CM.motionPatternFor(drill.id);
      if (runtime.state === 'ready' || runtime.state === 'running')
        { const prev = runtime; runtime = stepDrill(runtime, drill, {type: 'sample', timeMs: s.timeMs, features: cont ? s.features : s.smoothed, enoughSamples: cont ? s.motionUsable : s.enough, cameraView: 'side', mode: 'motion'});
          if (runtime.state === 'running') started = true; if (prev.state === 'running' && runtime.state === 'ready') judged++; }
    }
    const msg = runtime.motion?.message ?? '';
    const funnel = runtime.state === 'completed' ? 'accepted' : runtime.motion?.outcome === 'other_drill' ? 'other'
      : runtime.motion?.outcome === 'tracking_lost' ? 'tracking' : !started && runtime.state !== 'failed' ? 'no_start'
      : runtime.state === 'failed' ? 'short' : msg.includes('Продолжай') ? 'short' : 'no_decision';
    return {state: runtime.state, message: msg, funnel};
  }
  function allSamples(frames, facing) {
    const processor = new LiveSampleProcessor(), out = [];
    for (const raw of frames) { const s = processor.process(raw, facing, 'full_body', 'side'); if (s.motionUsable) out.push({timeMs: s.timeMs, features: s.features}); }
    return out;
  }
  // activity bursts: smoothed per-frame speed over the hand (strike) or feet (step) path channels
  function reps(samples, strike) {
    const js = strike ? [0, 1] : [9, 10, 13], ps = base.pathScales;
    const rows = samples.map(s => MR.frameChannels(s.features));
    const sm = rows.map((_, i) => js.map(j => { const w = rows.slice(Math.max(0, i - 2), i + 3).map(r => r[j]).filter(Number.isFinite); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : NaN; }));
    const sp = sm.map((r, i) => { if (!i) return 0; let s = 0, n = 0; r.forEach((x, k) => { const d = (x - sm[i - 1][k]) / ps[js[k]]; if (Number.isFinite(d)) { s += d * d; n++; } });
      const dt = (samples[i].timeMs - samples[i - 1].timeMs) / 1000; return n && dt > 0 ? Math.sqrt(s / n) / dt : 0; });
    const sps = sp.map((_, i) => { const w = sp.slice(Math.max(0, i - 3), i + 4); return w.reduce((a, b) => a + b, 0) / w.length; });
    const mx = Math.max(...sps); if (!(mx > 0)) return [];
    const regs = []; let cur = null;
    sps.forEach((x, i) => { if (x >= THR * mx) { if (cur && samples[i].timeMs - samples[cur.e].timeMs < 250) cur.e = i; else { cur = {s: i, e: i}; regs.push(cur); } } });
    return regs.map(r => ({...r, peak: Math.max(...sps.slice(r.s, r.e + 1))})).filter(r => r.peak >= REPMIN * mx && samples[r.e].timeMs - samples[r.s].timeMs >= 200)
      .map(r => { const t0 = samples[r.s].timeMs - PAD, t1 = samples[r.e].timeMs + PAD; return {t0, t1, atStart: r.s < 6, win: samples.filter(s => s.timeMs >= t0 && s.timeMs <= t1)}; });
  }
  const fmap = JSON.parse(readFileSync(FMAP));
  const clips = readdirSync(RAWDIR).filter(f => f.endsWith('.json')).sort().map(f => {
    const id = f.slice(0, -5).split('__')[1], c = JSON.parse(readFileSync(RAWDIR + '/' + f));
    const idle = !man[id];
    return {id, person: idle ? id.split('_')[1] : id.split('_')[0], drill: idle ? 'idle' : c.drill, facing: fmap[f] ?? 'right', frames: c.frames, m: man[id] ?? {drill: 'idle', weapon: 'none', clean: 'no'}};
  });
  const tpls = [];
  for (const c of clips) {
    if (c.person === 'stritschar' || c.m.weapon !== 'longsword' || (SRC === 'clean' && c.m.clean !== 'yes')) continue;
    const strike = c.drill.endsWith('hau'); let win = reps(allSamples(c.frames, c.facing), strike);
    for (const [k, r] of win.entries()) {
      let w = r.win; if (strike && MR.HAND_TRIM?.on) w = MR.strikeWindow(w, base.pathScales);
      const seq = w.length > 5 ? MR.prepareSequence(w, base.pathScales, base.points) : null;
      if (!seq) continue;
      // quality gates: not cut at the clip start, plausible path length, and closer to its drill's synthetic templates
      // forward than played backwards (rejects the recovery back to the guard)
      const T = w.at(-1).timeMs, rev = MR.prepareSequence([...w].reverse().map(s => ({...s, timeMs: T - s.timeMs})), base.pathScales, base.points);
      const own = base.templates.filter(t => t.drill === c.drill), dmin = q => Math.min(...own.map(t => MR.dtwDistance(q, t.seq, base)));
      const path = MR.sequencePath(seq, base.pathScales), tp = base.typicalPath[c.drill];
      const fwd = dmin(seq), bwd = rev ? dmin(rev) : Infinity;
      const why = r.atStart ? 'start' : path < 0.5 * tp ? 'short' : path > 3 * tp ? 'long' : fwd >= bwd ? 'reversed' : '';
      if (MODE === 'dump') console.log(c.id.padEnd(24), k, (r.t0 / 1000).toFixed(2), (r.t1 / 1000).toFixed(2), 'path/tp', (path / tp).toFixed(2), 'fwd', fwd.toFixed(2), 'bwd', bwd.toFixed(2), why || 'KEEP');
      if (why) continue;
      tpls.push({drill: c.drill, body: 'real:' + c.person, level: 'master', durationMs: w.at(-1).timeMs - w[0].timeMs, seq, src: c.id, rep: k, t0: r.t0, t1: r.t1});
    }
  }
  console.log('real templates', tpls.length, Object.entries(tpls.reduce((a, t) => (a[t.drill] = (a[t.drill] || 0) + 1, a), {})).map(x => x.join(':')).join(' '));
    if (process.env.ADDOUT) writeFileSync(process.env.ADDOUT, JSON.stringify(tpls.map(({src, rep, t0, t1, ...t}) => t)));
  if (MODE === 'dump') process.exit(0);
  const rows = [];
  for (const person of [...new Set(clips.map(c => c.person))]) {
    const extra = MODE === 'lopo' ? tpls.filter(t => t.body !== 'real:' + person).map(({src, rep, t0, t1, ...t}) => t) : [];
    const keep = process.env.REALONLY ? base.templates.filter(t => !t.drill.endsWith('hau')) : base.templates;
    CM.setRecognitionModel({...base, templates: [...keep, ...extra]});
    for (const c of clips.filter(x => x.person === person)) for (const d of DR) {
      const a = attempt(c.frames, d, c.facing);
      rows.push({clip: c.id, person, drill: c.drill, clean: c.m.clean === 'yes', selected: d, own: d === c.drill, accepted: a.state === 'completed', state: a.state, message: a.message, funnel: a.funnel});
    }
  }
  CM.setRecognitionModel(base);
  if (out) writeFileSync(out, JSON.stringify(rows));
  const CORE = new Set((process.env.CORE || 'zornhau,zwerchhau,schielhau,passing-step-forward,advance').split(','));
  const S = (f) => { const x = rows.filter(f); return `${x.filter(r => r.accepted).length}/${x.length}`; };
  for (const [nm, ok] of [['all', r => true], ['clean', r => r.clean]]) {
    console.log(`${nm}: own ${S(r => ok(r) && r.own)} (strikes ${S(r => ok(r) && r.own && r.drill.endsWith('hau'))}, steps ${S(r => ok(r) && r.own && !r.drill.endsWith('hau'))}) | wrong ${S(r => ok(r) && !r.own)} | CORE own ${S(r => ok(r) && r.own && CORE.has(r.drill))} wrong-into-core ${S(r => ok(r) && !r.own && CORE.has(r.selected))} core-clip-wrong ${S(r => ok(r) && !r.own && CORE.has(r.drill))}`);
  }
  const FN = ['no_start', 'no_decision', 'short', 'tracking', 'other', 'accepted'];
  for (const [nm, ok] of [['all', r => true], ['clean', r => r.clean], ['core-clean', r => r.clean && CORE.has(r.drill)]]) {
    const o = rows.filter(r => r.own && ok(r)); console.log(`funnel ${nm} (${o.length}):`, FN.map(f => `${f} ${o.filter(r => r.funnel === f).length}`).join(' | ')); }
  console.log('accepted own:', rows.filter(r => r.own && r.accepted).map(r => r.clip).join(' '));
  console.log('wrong:', rows.filter(r => !r.own && r.accepted).map(r => r.clip + '->' + r.selected).join(' '));
} finally { await v.close(); }
