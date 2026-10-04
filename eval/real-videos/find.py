# find.py <id> : candidate windows from screen/<id>.json -> prints and writes screen/<id>.cand.json
import json, sys, math
d = json.load(open(f'/workspace/hema/real/screen/{sys.argv[1]}.json')); R = d['rows']
X0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0; X1 = float(sys.argv[3]) if len(sys.argv) > 3 else 1
def main(r):
    ps = [p for p in r['p'] if X0 <= p['hipx'] <= X1]
    ps.sort(key=lambda p: -p['torso']); return ps[0] if ps else None
T = [r['t'] for r in R]; P = [main(r) for r in R]; N = [len(r['p']) for r in R]
cuts = [r['t'] for r in R if r['cut'] > 18]
def ok(p): return bool(p) and p['full'] > .5 and p['bot'] < .99 and p['top'] > 0
cands = []; last = -99
for i in range(8, len(R) - 10):
    p = P[i]
    if not ok(p): continue
    # hand motion in next 1.0 s vs stillness in previous 0.7 s
    def hm(a, b):
        if not (P[a] and P[b]): return 0
        return math.hypot(P[b]['handx'] - P[a]['handx'], P[b]['handup'] - P[a]['handup'])
    still = max(hm(j, j + 1) for j in range(i - 7, i)) if all(P[j] for j in range(i - 7, i + 1)) else 9
    move = max((hm(i, j) for j in range(i + 1, min(i + 11, len(R)))), default=0)
    hip = max((abs(P[j]['hipx'] - p['hipx']) / p['torso'] if P[j] else 0) for j in range(i + 1, min(i + 13, len(R))))
    if still < .25 and (move > 1.2 or hip > .5) and T[i] - last > 3:
        w0, w1 = round(T[i] - 1.5, 1), round(T[i] + 4.5, 1)
        if any(w0 < c < w1 for c in cuts): continue
        idx = [j for j in range(len(R)) if w0 <= T[j] <= w1]
        full = sum(ok(P[j]) for j in idx) / max(1, len(idx))
        if full < .8: continue
        cands.append(dict(t=T[i], w0=w0, w1=w1, move=round(move, 2), hip=round(hip, 2), full=round(full, 2),
                          people=max(N[j] for j in idx), face='R' if p['face'] > 0 else 'L', h=round(p['bot'] - p['top'], 2)))
        last = T[i]
for c in cands: print(c)
json.dump(cands, open(f'/workspace/hema/real/screen/{sys.argv[1]}.cand.json', 'w'))
