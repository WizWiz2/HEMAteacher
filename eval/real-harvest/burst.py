# burst.py <id> [x0 x1] [thr]: hand-speed bursts of the main (largest) person within hip-x range -> candidate rep windows
import json, sys, math
d = json.load(open(f'/workspace/hema/harvest/screen/{sys.argv[1]}.json')); R = d['rows']
X0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0; X1 = float(sys.argv[3]) if len(sys.argv) > 3 else 1
THR = float(sys.argv[4]) if len(sys.argv) > 4 else 2.5
def main(r):
    ps = [p for p in r['p'] if X0 <= p['hipx'] <= X1]; ps.sort(key=lambda p: -p['torso']); return ps[0] if ps else None
P = [main(r) for r in R]; T = [r['t'] for r in R]; cuts = [r['t'] for r in R if r['cut'] > 18]
dt = T[1] - T[0] if len(T) > 1 else .1
sp = [0.0] * len(R)
for i in range(1, len(R)):
    a, b = P[i - 1], P[i]
    if a and b: sp[i] = math.hypot(b['handx'] - a['handx'], b['handup'] - a['handup']) / dt
# smooth
sm = [sum(sp[max(0, i - 2):i + 3]) / len(sp[max(0, i - 2):i + 3]) for i in range(len(sp))]
segs = []; i = 0
while i < len(R):
    if sm[i] > THR:
        j = i
        while j < len(R) and sm[j] > THR * .5: j += 1
        a = i
        while a > 0 and sm[a - 1] > THR * .5: a -= 1
        segs.append((a, j)); i = j
    else: i += 1
for a, b in segs:
    idx = range(max(0, a - 5), min(len(R), b + 5))
    okf = sum(1 for k in idx if P[k] and P[k]['full'] > .5 and P[k]['top'] > 0 and P[k]['bot'] < .99) / len(idx)
    n = max(len(R[k]['p']) for k in idx); c = any(T[a] - .5 < x < T[b - 1] + .5 for x in cuts)
    pk = max(sm[a:b]); hx = [P[k]['hipx'] for k in idx if P[k]]
    print(f"{T[a]:7.1f}-{T[b-1]:7.1f}  peak {pk:5.1f}  full {okf:.2f}  ppl {n}  cut {int(c)}  hipx {min(hx) if hx else 0:.2f}-{max(hx) if hx else 0:.2f}  "
          f"hand_up {P[a]['handup'] if P[a] else '-'}->{P[b-1]['handup'] if P[b-1] else '-'}  face {'R' if P[a] and P[a]['face']>0 else 'L'}")
