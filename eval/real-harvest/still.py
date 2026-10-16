# still.py <id> t0 t1 [x0 x1]: periods (>=1.2 s) where main person's hands are still (guard holds), full body visible
import json, sys, math
d = json.load(open(f'/workspace/hema/harvest/screen/{sys.argv[1]}.json')); R = d['rows']
a0, a1 = float(sys.argv[2]), float(sys.argv[3]); X0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0; X1 = float(sys.argv[5]) if len(sys.argv) > 5 else 1
def main(r):
    ps = [p for p in r['p'] if X0 <= p['hipx'] <= X1]; ps.sort(key=lambda p: -p['torso']); return ps[0] if ps else None
R = [r for r in R if a0 <= r['t'] <= a1]; P = [main(r) for r in R]; T = [r['t'] for r in R]
ok = lambda p: p and p['full'] > .5 and p['top'] > 0 and p['bot'] < .99
i = 0
while i < len(R):
    if not ok(P[i]): i += 1; continue
    j = i
    while j + 1 < len(R) and ok(P[j + 1]) and math.hypot(P[j + 1]['handx'] - P[i]['handx'], P[j + 1]['handup'] - P[i]['handup']) < .25: j += 1
    if T[j] - T[i] >= 1.2: print(f"{T[i]:7.1f}-{T[j]:7.1f} ({T[j]-T[i]:.1f}s) handup {P[i]['handup']} handx {P[i]['handx']} face {'R' if P[i]['face']>0 else 'L'}")
    i = j + 1
