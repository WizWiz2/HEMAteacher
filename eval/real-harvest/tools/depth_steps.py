# depth_steps.py <id> [t0 t1]: frontal step candidates = episodes of body-height change (toward/away from camera) between still phases
import json, sys
R = json.load(open(f'/workspace/hema/harvest/screen/{sys.argv[1]}.json'))['rows']
T0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0; T1 = float(sys.argv[3]) if len(sys.argv) > 3 else 1e9
P = []
for r in R:
    ps = [p for p in r['p'] if p['full'] > .8 and p['bot'] < .995]
    P.append((r['t'], max(ps, key=lambda p: p['torso']) if len(ps) >= 1 and len(r['p']) == 1 else None))
H = [(t, p['bot'] - p['top'], p['hipx']) for t, p in P if p and T0 <= t <= T1]
# smooth
S = [(H[i][0], sum(h for _, h, _ in H[max(0, i - 2):i + 3]) / len(H[max(0, i - 2):i + 3]), H[i][2]) for i in range(len(H))]
i = 0; ev = []
while i < len(S) - 1:
    j = i
    while j + 1 < len(S) and S[j + 1][0] - S[j][0] < .5 and abs(S[j + 1][1] - S[j][1]) / S[i][1] > .004: j += 1
    if j > i:
        dh = (S[j][1] - S[i][1]) / S[i][1]
        if abs(dh) > .06 and S[j][0] - S[i][0] >= .4: ev.append((round(S[i][0], 1), round(S[j][0], 1), round(dh, 3), round(S[i][2], 2)))
    i = j + 1
for e in ev: print('%7.1f-%7.1f dh %+.3f hipx %.2f' % e)
