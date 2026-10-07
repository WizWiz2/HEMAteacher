import {readFileSync} from 'node:fs';
const m = JSON.parse(readFileSync('/workspace/hema-gap/frontend/src/drill/motionModel.json'));
const real = JSON.parse(readFileSync('/tmp/realtpl.json'));
const rng = (s, j) => { const v = s.map(r => r[j]).filter(x => x !== null && Number.isFinite(x)); return v.length ? Math.max(...v) - Math.min(...v) : NaN; };
const st = (s, j, k) => { const v = s.map(r => r[j]).filter(x => x !== null && Number.isFinite(x)); return v.length ? (k === 's' ? v[0] : v.at(-1)) : NaN; };
const med = v => { v = v.filter(Number.isFinite).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : NaN; };
const CH = [0, 1, 2, 3, 4, 5, 17]; const f = x => (Number.isFinite(x) ? x.toFixed(2) : ' nan').padStart(6);
console.log('ranges (ch ' + CH.join(',') + ')  | start hand_x,hand_y,hoh | end hand_x,hand_y,hoh');
for (const d of ['zornhau', 'zwerchhau', 'schielhau', 'scheitelhau', 'advance', 'retreat', 'passing-step-forward']) {
  const ts = m.templates.filter(t => t.drill === d);
  for (const style of ['syn', 'real']) {
    const S = style === 'syn' ? ts.map(t => t.seq) : real.filter(t => t.drill === d).map(t => t.seq); if (!S.length) continue;
    console.log(d.slice(0, 10).padEnd(11), style.padEnd(5), String(S.length).padStart(3), CH.map(j => f(med(S.map(s => rng(s, j))))).join(''), ' |', [0, 1, 2].map(j => f(med(S.map(s => st(s, j, 's'))))).join(''), ' |', [0, 1, 2].map(j => f(med(S.map(s => st(s, j, 'e'))))).join(''));
  }
}
console.log('scales', CH.map(j => f(m.scales[j])).join(''), 'weights', CH.map(j => m.weights[j]).join(','));
