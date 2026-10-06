# step_find.py <id> [x0 x1]: step candidates from screen/<id>.json (hip displacement episodes), guess type by ankle-order flip
import json, sys
d = json.load(open(f'/workspace/hema/fresh/screen/{sys.argv[1]}.json')); R = d['rows']
X0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0; X1 = float(sys.argv[3]) if len(sys.argv) > 3 else 1
def main(r):
    ps = [p for p in r['p'] if X0 <= p['hipx'] <= X1]; ps.sort(key=lambda p: -p['torso']); return ps[0] if ps else None
P = [main(r) for r in R]; T = [r['t'] for r in R]; cuts = [r['t'] for r in R if r['cut'] > 18]
ok = lambda p: bool(p) and p['full'] > .5 and p['bot'] < .99 and p['top'] > 0
i = 6; last = -99
while i < len(R) - 20:
    win = P[i - 6:i + 1]
    if not all(ok(p) for p in win): i += 1; continue
    still = max(abs(p['hipx'] - P[i]['hipx']) / P[i]['torso'] for p in win)
    if still > .08: i += 1; continue
    j = i + 1
    while j < min(i + 25, len(R)) and ok(P[j]) and abs(P[j]['hipx'] - P[i]['hipx']) / P[i]['torso'] < .35: j += 1
    if j >= min(i + 25, len(R)) or not ok(P[j]): i += 1; continue
    k = j
    while k < min(j + 20, len(R) - 3) and ok(P[k]) and ok(P[k + 3]) and abs(P[k + 3]['hipx'] - P[k]['hipx']) / P[i]['torso'] > .05: k += 1
    k = min(k + 3, len(R) - 1)
    if not ok(P[k]): i += 1; continue
    dx = (P[k]['hipx'] - P[i]['hipx']) / P[i]['torso']; face = 1 if P[i]['face'] > 0 else -1
    flip = (P[i]['ank'] > 0) != (P[k]['ank'] > 0) and abs(P[i]['ank']) > .15 and abs(P[k]['ank']) > .15
    w0, w1 = T[i] - 1.0, T[k] + 1.5
    if T[i] - last > 2 and not any(w0 < c < w1 for c in cuts):
        print(dict(t0=round(w0, 1), t1=round(w1, 1), dx=round(dx, 2), dirn='fwd' if dx * face > 0 else 'back', flip=flip, face='R' if face > 0 else 'L',
                   ank=(P[i]['ank'], P[k]['ank']), h=round(P[i]['bot'] - P[i]['top'], 2)))
        last = T[i]
    i = k + 1
