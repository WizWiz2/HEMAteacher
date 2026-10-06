"""Phase 5 real-shape strike jobs (jobs3.tsv, run_ba3.sh columns: ... frames fwg gov lov shp).
Same bodies / camera ranges (az -25..+45) / webcam degradation as ba/gen_jobs.py; M/E/beginner + slow/paused variants.
Usage: python3 gen_jobs3.py <shape.json>"""
import random, zlib, json, sys
SHAPE = sys.argv[1] if len(sys.argv) > 1 else "real_v1.json"
STRIKES = ["zornhau", "zwerchhau", "schielhau"]
LEVELS = ["master", "experienced", "beginner"]
TRAIN = ["short_slim_male", "tall_heavy_male", "avg_longlimb_female", "tall_slim_male", "short_broad_female"]
TEST = ["tall_slim_female", "stocky_short_male"]
TEMPO = {"zornhau": 2.0, "zwerchhau": 1.7, "schielhau": 1.0}        # burst duration ~ real (REAL_SHAPE.md)
LF = {"master": 1.0, "experienced": 1.15, "beginner": 1.5}
jobs = []
def job(name, split, body, drill, level, r, cam=None, slow=False):
    seed = zlib.crc32(f"{drill}/{name}".encode()) % 1000000
    if cam is None:
        cam = (round(r.uniform(-25, 45), 1), round(r.uniform(1.0, 1.5), 2), round(r.uniform(3.0, 3.9), 2), round(r.uniform(20, 26), 1))
        deg = (480 if r.random() < 0.3 else 0, round(r.uniform(.008, .03), 3), r.randint(23, 32), round(r.uniform(.03, .08), 3))
    else:
        deg = (0, .02, 28, .05)
    gov = json.dumps({"hand_y": round(r.uniform(0.85, 1.0), 2), "hand_x": 0.68})
    lov = {"tempo": round(TEMPO[drill] * LF[level] * (1.5 if slow else 1.0), 2)}
    if slow: lov.update(hesitation=0.6, guard_hold=1.6)
    jobs.append((name, split, body, drill, level, *cam, *deg, seed, 240, "-", gov, json.dumps(lov), SHAPE))
for d in STRIKES:                                   # interleave: every drill gets train coverage early
    for b in TRAIN:
        for l in LEVELS:
            n = f"{b}_{l}_rs"; job(n, "train", b, d, l, random.Random(zlib.crc32(f"{d}/{n}".encode())))
for d in STRIKES:
    for b in TEST:
        for l in LEVELS:
            for az in (0, 40):
                job(f"{b}_{l}_rs_az{az}", "test", b, d, l, random.Random(1), cam=(az, 1.25, 3.3, 24.0))
for d in STRIKES:
    for i, b in enumerate(TRAIN):
        l = ("master", "experienced")[i % 2]; n = f"{b}_{l}_rs_slow"
        job(n, "train", b, d, l, random.Random(zlib.crc32(f"{d}/{n}".encode())), slow=True)
with open("jobs3.tsv", "w") as f:
    for j in jobs: f.write("\t".join(map(str, j)) + "\n")
print(len(jobs), "jobs;", sum(j[1] == "test" for j in jobs), "test")
