// personal.mjs: EXPERIMENT (offline, nothing shipped). Personal-template calibration on the seen real clips:
// per person, one calibration rep per drill is turned into a recognition template (same prepareSequence as the model) and
// appended to the shipped generic templates; every other rep of that person is tested (own drill + all 9 continuous drills).
// Folds rotate the calibration rep. Usage: node personal.mjs <out.json>
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
const ROOT = process.env.APPROOT || '/workspace/hema/real/app/frontend', REAL = '/workspace/hema/real';
const RAWDIR = process.env.RAWDIR || REAL + '/rawframes', FMAP = process.env.FMAP || REAL + '/results/facing_map.json';
const out = process.argv[2];
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
  const shipped = CM.recognitionModel();
  function attempt(frames, drillId, facing) {
    const base = drills.find(d => d.id === drillId), mode = base.trackingMode ?? 'full_body';
    const processor = new LiveSampleProcessor(), calibration = new CalibrationGate();
    let drill = base, runtime = createDrillRuntime();
    for (const raw of frames) {
      const s = processor.process(raw, facing, mode, 'side');
      const ready = calibration.push(s, mode);
      if (runtime.state === 'calibrating' && ready) { drill = adaptDrillForCameraView(personalizeDrill(base, calibration.profile) ?? base, 'side') ?? base; runtime = stepDrill(runtime, drill, {type: 'quality', ok: true}); }
      if (runtime.state === 'failed' || runtime.state === 'completed') break;
      const cont = !!CM.motionPatternFor(drill.id);
      if (runtime.state === 'ready' || runtime.state === 'running')
        runtime = stepDrill(runtime, drill, {type: 'sample', timeMs: s.timeMs, features: cont ? s.features : s.smoothed, enoughSamples: cont ? s.motionUsable : s.enough, cameraView: 'side', mode: 'motion'});
    }
    return {state: runtime.state, outcome: runtime.motion?.outcome, message: runtime.motion?.message, samples: runtime.motion?.samples ?? []};
  }
  const fmap = JSON.parse(readFileSync(FMAP));
  const clips = readdirSync(RAWDIR).filter(f => f.endsWith('.json')).sort().map(f => {
    const id = f.slice(0, -5).split('__')[1], c = JSON.parse(readFileSync(RAWDIR + '/' + f));
    return {id, person: process.env.PERSONMAP ? JSON.parse(readFileSync(process.env.PERSONMAP))[id] : id.split('_')[0], drill: c.drill, facing: fmap[f], frames: c.frames};
  }).filter(c => c.person);
  // calibration template per clip (generic model, own drill selected): the attempt the recogniser formed
  CM.setRecognitionModel(shipped);
  for (const c of clips) { const a = attempt(c.frames, c.drill, c.facing); const seq = a.samples.length > 3 ? MR.prepareSequence(a.samples, shipped.pathScales, shipped.points) : null;
    c.tpl = seq ? {drill: c.drill, body: 'personal:' + c.person, level: 'master', durationMs: a.samples.at(-1).timeMs - a.samples[0].timeMs, seq} : null; c.calState = a.state; }
  if (process.env.PAIRS) { for (const a of clips) for (const b of clips) if (a !== b && a.person === b.person && a.tpl && b.tpl && a.id < b.id)
      console.log('pair', a.id.padEnd(22), b.id.padEnd(22), MR.dtwDistance(a.tpl.seq, b.tpl.seq, shipped).toFixed(2), 'pathA', MR.sequencePath(a.tpl.seq, shipped.pathScales).toFixed(2), 'pathB', MR.sequencePath(b.tpl.seq, shipped.pathScales).toFixed(2)); process.exit(0); }
  const rows = [];
  for (const person of [...new Set(clips.map(c => c.person))]) {
    const mine = clips.filter(c => c.person === person), byDrill = {};
    for (const c of mine) (byDrill[c.drill] ??= []).push(c);
    const testable = Object.values(byDrill).some(v => v.length >= 2); if (!testable) continue;
    const folds = Math.max(...Object.values(byDrill).map(v => v.length));
    for (let f = 0; f < folds; f++) {
      // one calibration rep per drill this person has (rotating); single-rep drills calibrate only (never own-tested)
      const calib = Object.values(byDrill).map(v => v[f % v.length]);
      const tests = mine.filter(c => !calib.includes(c) && byDrill[c.drill].length >= 2);
      const personal = calib.map(c => c.tpl).filter(Boolean);
      for (const [variant, model] of [['generic', shipped], ['generic+personal', {...shipped, templates: [...shipped.templates, ...personal]}]]) {
        CM.setRecognitionModel(model);
        for (const t of tests) for (const d of MT.CONTINUOUS_DRILLS) {
          const a = attempt(t.frames, d, t.facing);
          rows.push({variant, person, fold: f, calib: calib.map(c => c.id), test: t.id, drill: t.drill, selected: d, own: d === t.drill, accepted: a.state === 'completed', state: a.state, message: a.message,
            hasPersonalForSelected: personal.some(p => p.drill === d)});
        }
      }
    }
  }
  CM.setRecognitionModel(shipped);
  writeFileSync(out, JSON.stringify(rows, null, 0));
  const S = (vr, f) => { const x = rows.filter(r => r.variant === vr && f(r)); return `${x.filter(r => r.accepted).length}/${x.length}`; };
  for (const vr of ['generic', 'generic+personal']) console.log(vr.padEnd(18), 'own', S(vr, r => r.own), ' strikes', S(vr, r => r.own && r.drill.endsWith('hau')), ' steps', S(vr, r => r.own && !r.drill.endsWith('hau')), ' wrong', S(vr, r => !r.own));
  for (const p of [...new Set(rows.map(r => r.person))]) console.log(' ', p.padEnd(12), ['generic', 'generic+personal'].map(vr => `${vr}: own ${S(vr, r => r.person === p && r.own)} wrong ${S(vr, r => r.person === p && !r.own)}`).join(' | '));
} finally { await v.close(); }
