// Offline replay of saved browser-MediaPipe raw frames through a checkout's own modules, mirroring that
// checkout's VideoRegressionPage.runVideoRegression loop (personalised only if that version personalises).
// Usage: node replay.mjs <checkoutRoot> <out.json> <drillId>=<raw.json> ...
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync, writeFileSync} from 'node:fs';
const [root, out, ...items] = process.argv.slice(2);
const fe = root + '/frontend';
const page = readFileSync(fe + '/src/pages/VideoRegressionPage.tsx', 'utf8');
const personalises = !!process.env.DRILLPAGE || page.includes('personalizeDrill(');
const v = await createServer({root: fe, configFile: false, logLevel: 'error', server: {middlewareMode: true}, optimizeDeps: {noDiscovery: true, include: []}});
const rows = []; const FACING = process.env.FACING ? JSON.parse(readFileSync(process.env.FACING)) : {};
try {
  const {LiveSampleProcessor} = await v.ssrLoadModule('/src/live/sampleProcessor.ts');
  const {CalibrationGate} = await v.ssrLoadModule('/src/live/calibrationGate.ts');
  const {stepDrill, createDrillRuntime} = await v.ssrLoadModule('/src/drill/drillEngine.ts');
  const {motionPatternFor} = await v.ssrLoadModule('/src/drill/continuousMotion.ts');
  const drillPage = !!process.env.DRILLPAGE;
  const personalize = personalises ? (await v.ssrLoadModule('/src/drill/personalize.ts')).personalizeDrill : null;
  const adapt = personalises ? (await v.ssrLoadModule('/src/drill/cameraView.ts')).adaptDrillForCameraView : null;
  const drills = JSON.parse(readFileSync(fe + '/public/content/drills.json'));
  for (const it of items) {
    const i = it.indexOf('='), drillId = it.slice(0, i), file = it.slice(i + 1);
    const clip = JSON.parse(readFileSync(file)); const facing = FACING[file.split('/').pop()] ?? 'right';
    const base = drills.find(d => d.id === drillId); let drill = base;
    const processor = new LiveSampleProcessor(), calibration = new CalibrationGate();
    let runtime = createDrillRuntime(); const events = []; let prev = null; let calAt = null; const failures = [];
    for (const [idx, raw] of clip.frames.entries()) {
      const sample = processor.process(raw, facing, drill.trackingMode ?? 'full_body', 'side');
      const ready = calibration.push(sample, drill.trackingMode ?? 'full_body');
      if (runtime.state === 'calibrating' && ready) {
        if (personalises) drill = adapt(personalize(base, calibration.profile), 'side');
        runtime = stepDrill(runtime, drill, {type: 'quality', ok: true}); calAt = idx;
      }
      const cont = !!motionPatternFor(drill.id);
      if (drillPage && runtime.state === 'failed') { failures.push({frame: idx, msg: runtime.motion?.message}); runtime = stepDrill(runtime, drill, {type: 'retry'}); }
      if (!drillPage || runtime.state === 'ready' || runtime.state === 'running')
        runtime = stepDrill(runtime, drill, {type: 'sample', timeMs: sample.timeMs,
          features: drillPage && !cont ? sample.smoothed : sample.features,
          enoughSamples: drillPage && !cont ? sample.enough : sample.motionUsable, cameraView: 'side', mode: 'motion'});
      const key = `${runtime.state}|${runtime.checkpointIndex}|${runtime.motion?.phase ?? ''}`;
      if (key !== prev) { events.push({frame: idx, state: runtime.state, cp: runtime.checkpointIndex, phase: runtime.motion?.phase, msg: runtime.motion?.message}); prev = key; }
    }
    const m = runtime.motion;
    rows.push({drillId, file, facing, sourceDrill: clip.drill, state: runtime.state, checkpointIndex: runtime.checkpointIndex, nCheckpoints: base.checkpoints.length,
      startedAt: runtime.startedAt, finishedAt: runtime.finishedAt, calibratedAtFrame: calAt, calibrated: calibration.refined,
      similarity: m?.similarity, outcome: m?.outcome, message: m?.message, feedback: m?.feedback, failures, events});
  }
} finally { await v.close(); }
writeFileSync(out, JSON.stringify(rows, null, 1));
for (const r of rows) console.log(r.drillId, r.file.split('/').pop(), r.state, `cp=${r.checkpointIndex}/${r.nCheckpoints}`, `cal@${r.calibratedAtFrame}`, `t=${r.startedAt}-${r.finishedAt}`, `sim=${r.similarity}`, r.message ?? '', JSON.stringify(r.feedback ?? []));
