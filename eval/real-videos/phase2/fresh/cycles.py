# cycles.py <id> <t0> <t1> [x0 x1] [hi lo]: strike reps from screen json (main person): hands-high plateau -> drop -> low end
import json, sys
a = sys.argv; vid, t0, t1 = a[1], float(a[2]), float(a[3]); X0, X1 = (float(a[4]), float(a[5])) if len(a) > 5 else (0, 1)
HI, LO = (float(a[6]), float(a[7])) if len(a) > 7 else (-0.65, -0.8)
d = json.load(open(f'screen/{vid}.json'))
R = []
for x in d['rows']:
    if not (t0 <= x['t'] <= t1): continue
    ps = [p for p in x['p'] if X0 <= p['hipx'] <= X1]
    if ps: R.append((x['t'], max(ps, key=lambda p: p['torso']), len(x['p']), x['cut']))
T = [t for t, *_ in R]; H = [p['handup'] for _, p, *_ in R]
cuts = [t for t, _, _, c in R if c > 18]
last = -9
for i in range(len(R) - 3):
    if H[i] > HI and H[i + 3] < H[i] - 0.3 and T[i] - last > 1.2:
        j = i
        while j > 0 and H[j - 1] > HI - 0.05 and T[i] - T[j - 1] < 3: j -= 1
        k = i + 3
        while k < len(R) - 1 and H[k + 1] < LO: k += 1
        p = R[i][1]
        print(f'top {T[j]:.1f} onset {T[i]:.1f} low-until {T[k]:.1f}  full {p["full"]:.2f} ppl {R[i][2]} face {p["face"]:+.2f} hipx {p["hipx"]:.2f} handup {H[i]:.2f}->{H[i+3]:.2f}'); last = T[i]
print('scene cuts:', [round(c, 1) for c in cuts])
