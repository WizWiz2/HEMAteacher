// measure.mjs: real (SEEN clips only, stritschar excluded, never fresh) vs synthetic strike shape in MediaPipe feature
// space (hip-relative torso units, x forward, y up). Rep = hand-speed burst with net forward hand displacement.
// Usage: node measure.mjs [fixture.json.gz] > out.json  (summary on stderr)
import {createServer} from '/workspace/hema/eval/head/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync, readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const ROOT = '/workspace/hema-gap/frontend', REAL = '/workspace/hema/real';
const FX = process.argv[2] || ROOT + '/test-fixtures/motion-poses.json.gz';
const STR = ['zornhau', 'zwerchhau', 'schielhau', 'scheitelhau', 'krumphau'];
const v = await createServer({root: ROOT, configFile: false, logLevel: 'error', server: {middlewareMode: true, hmr: false}, optimizeDeps: {noDiscovery: true, include: []}});
try {
  const {LiveSampleProcessor} = await v.ssrLoadModule('/src/live/sampleProcessor.ts');
  const MT = await v.ssrLoadModule('/src/drill/motionTraining.ts');
  const fin = Number.isFinite, med = a => { a = a.filter(fin).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
  const smooth = (s, k) => s.map((_, i) => med(s.slice(Math.max(0, i - 2), i + 3).map(x => x.features?.[k])));
  function reps(S) {
    if (S.length < 15) return [];
    const hx = smooth(S, 'action_hand_x'), hy = smooth(S, 'action_hand_y');
    const sp = S.map((s, i) => { if (!i) return 0; const dt = (s.timeMs - S[i - 1].timeMs) / 1000; const d = Math.hypot(hx[i] - hx[i - 1], hy[i] - hy[i - 1]); return fin(d) && dt > 0 ? d / dt : 0; });
    const sps = sp.map((_, i) => { const w = sp.slice(Math.max(0, i - 3), i + 4); return w.reduce((a, b) => a + b, 0) / w.length; });
    const mx = Math.max(...sps); if (!(mx > 0)) return [];
    const regs = []; let cur = null;
    sps.forEach((x, i) => { if (x >= 0.25 * mx) { if (cur && S[i].timeMs - S[cur.e].timeMs < 200) cur.e = i; else { cur = {s: i, e: i}; regs.push(cur); } } });
    const at = (t0, t1, k) => med(S.filter(s => s.timeMs >= t0 && s.timeMs <= t1).map(s => s.features?.[k]));
    const fa = (t0, t1) => { const ex = at(t0, t1, 'right_elbow_x'), ey = at(t0, t1, 'right_elbow_y'), wx = at(t0, t1, 'right_wrist_x'), wy = at(t0, t1, 'right_wrist_y'); return Math.atan2(wy - ey, wx - ex) * 180 / Math.PI; };
    const pose = (t0, t1) => { const x = at(t0, t1, 'action_hand_x'), y = at(t0, t1, 'action_hand_y'), n = at(t0, t1, 'nose_y'), sh = (at(t0, t1, 'left_shoulder_y') + at(t0, t1, 'right_shoulder_y')) / 2;
      return {hand_x: x, hand_y: y, over_head: y - n, over_shoulder: y - sh, forearm_deg: fa(t0, t1), root_x: at(t0, t1, 'root_x'), feet: at(t0, t1, 'foot_distance'), lank: at(t0, t1, 'left_ankle_x'), rank: at(t0, t1, 'right_ankle_x')}; };
    const out = [];
    for (const r of regs) {
      const peak = Math.max(...sps.slice(r.s, r.e + 1)); if (peak < 0.4 * mx || r.s < 3) continue;
      const a = S[r.s].timeMs, b = S[r.e].timeMs; if (b - a < 150) continue;
      const st = pose(a - 250, a), en = pose(b, b + 250);
      if (!(en.hand_x - st.hand_x > 0.05)) continue;          // strike = forward extension (recoveries go back)
      const win = S.filter(s => s.timeMs >= a && s.timeMs <= b);
      const maxY = Math.max(...win.map(s => s.features?.action_hand_y).filter(fin));
      // step coupling: feet travel (root and the ankles) during [a-300, b+300] and its timing vs the hand burst
      const ro = S.filter(s => s.timeMs >= a - 300 && s.timeMs <= b + 300);
      const rx = ro.map(s => s.features?.root_x).filter(fin);
      const ankMove = Math.max(Math.abs(en.lank - st.lank) || 0, Math.abs(en.rank - st.rank) || 0);
      out.push({t0: a, t1: b, dur: b - a, peakSpeed: peak, start: st, end: en, dx: en.hand_x - st.hand_x, dy: en.hand_y - st.hand_y,
        dir_deg: Math.atan2(en.hand_y - st.hand_y, en.hand_x - st.hand_x) * 180 / Math.PI, rise: maxY - st.hand_y,
        root_travel: rx.length ? Math.max(...rx) - Math.min(...rx) : NaN, ankle_move: ankMove, stepped: ankMove > 0.35});
    }
    return out;
  }
  const res = {real: [], syn: []};
  // REAL (seen)
  const man = Object.fromEntries(readFileSync(REAL + '/manifest.csv', 'utf8').trim().split('\n').slice(1).map(l => { const c = l.split(','); return [c[0], c]; }));
  const fmap = JSON.parse(readFileSync(REAL + '/results/facing_map.json'));
  if (!process.env.RAWSYN) for (const f of readdirSync(REAL + '/rawframes').filter(f => f.endsWith('.json')).sort()) {
    const id = f.slice(0, -5).split('__')[1], drill = f.split('__')[0];
    if (!STR.includes(drill) || id.startsWith('stritschar')) continue;
    const c = JSON.parse(readFileSync(REAL + '/rawframes/' + f)), P = new LiveSampleProcessor(), S = [];
    for (const raw of c.frames) { const s = P.process(raw, fmap[f] ?? 'right', 'full_body', 'side'); if (s.motionUsable) S.push({timeMs: s.timeMs, features: s.features}); }
    for (const r of reps(S)) res.real.push({drill, clip: id, person: id.split('_')[0], ...r});
  }
  // PILOT mode: RAWSYN=dir[,dir] = raw MediaPipe dumps of new renders (<drill>__<split>__<name>.json); compared to TARGETS
  if (process.env.RAWSYN) {
    const T = JSON.parse(readFileSync(process.env.TARGETS || '/workspace/hema/real/p5/real_shape_targets.json')).drills;
    const get = (r, k) => k.includes('.') ? r[k.split('.')[0]][k.split('.')[1] === 'forearm_deg' ? 'forearm_deg' : k.split('.')[1]] : k === 'dur_ms' ? r.dur : r[k];
    const rows = [];
    for (const dir of process.env.RAWSYN.split(',')) for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
      const drill = f.split('__')[0]; if (!T[drill]?.targets) continue;
      const c = JSON.parse(readFileSync(dir + '/' + f)), P = new LiveSampleProcessor(), S = [];
      for (const raw of c.frames) { const s = P.process(raw, 'right', 'full_body', 'side'); if (s.motionUsable) S.push({timeMs: s.timeMs, features: s.features}); }
      const rs = reps(S); if (!rs.length) { console.error(f, 'NO REP'); continue; }
      const r = rs.reduce((p, q) => (q.dx > p.dx ? q : p)); let ok = 0, n = 0; const cells = [];
      for (const [k, t] of Object.entries(T[drill].targets)) {
        const v = get(r, k), tol = t.tol_relative ? t.target * t.tol : t.tol, pass = fin(v) && Math.abs(v - t.target) <= tol; n++; ok += pass;
        cells.push(`${k}=${fin(v) ? v.toFixed(2) : 'nan'}${pass ? '' : '!'}(${t.target}±${+tol.toFixed(2)}, old ${t.old_syn_median})`);
      }
      console.error(`${f.replace('.json', '')}  ${ok}/${n} in tolerance  [${r.t0}-${r.t1} ms]\n   ` + cells.join('\n   '));
      rows.push({file: f, drill, ok, n, ...r});
    }
    console.log(JSON.stringify(rows)); process.exit(0);
  }
  // SYNTHETIC (fixture, M/E and beginner, all variants)
  const fx = JSON.parse(gunzipSync(readFileSync(FX)));
  for (const c of fx.clips.filter(c => STR.includes(c.drill))) {
    const S = MT.clipFeatures(c, fx.names).filter(s => s.features);
    const rs = reps(S); if (!rs.length) continue;
    const best = rs.reduce((p, q) => (q.dx > p.dx ? q : p));          // one rep per synthetic clip: the main extension
    res.syn.push({drill: c.drill, clip: c.id, level: c.level, style: /_lowtag/.test(c.id) ? 'lowtag' : /_slow/.test(c.id) ? 'slow' : 'base', ...best});
  }
  console.log(JSON.stringify(res));
  const keys = [['start.hand_x', r => r.start.hand_x], ['start.hand_y', r => r.start.hand_y], ['start.over_head', r => r.start.over_head], ['start.over_shoulder', r => r.start.over_shoulder], ['start.forearm', r => r.start.forearm_deg],
    ['end.hand_x', r => r.end.hand_x], ['end.hand_y', r => r.end.hand_y], ['end.over_head', r => r.end.over_head], ['end.forearm', r => r.end.forearm_deg], ['dx', r => r.dx], ['dy', r => r.dy], ['dir_deg', r => r.dir_deg], ['rise', r => r.rise],
    ['dur_ms', r => r.dur], ['peak_speed', r => r.peakSpeed], ['stepped%', r => 100 * r.stepped], ['root_travel', r => r.root_travel]];
  const f2 = x => (fin(x) ? x.toFixed(2) : 'nan').padStart(7);
  for (const d of STR) {
    const R = res.real.filter(r => r.drill === d), Sb = res.syn.filter(r => r.drill === d && r.style === 'base' && r.level !== 'beginner'), Sl = res.syn.filter(r => r.drill === d && r.style === 'lowtag');
    if (!R.length) continue;
    console.error(`\n${d}: real n=${R.length} (${[...new Set(R.map(r => r.person))].join(',')})  syn base M/E n=${Sb.length}  syn lowtag n=${Sl.length}`);
    for (const [k, g] of keys) console.error(k.padEnd(20), 'real', f2(med(R.map(g))), ' syn', f2(med(Sb.map(g))), ' lowtag', f2(med(Sl.map(g))));
  }
} finally { await v.close(); }
