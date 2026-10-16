"""Frontal renders (azimuth 60..90 deg from profile toward the front; az 90 = person faces the camera) for all nine drills.
run_ba3.sh columns. Strikes zornhau/zwerchhau/schielhau use real_v4 shapes + ba3 guard/tempo scheme; scheitelhau/krumphau
and footwork use the ba scheme (default presets, 180 frames). Train: 5 TRAIN bodies (master/experienced), test: 2 TEST bodies.
Order interleaves drills so a partial batch still covers every drill. Usage: python3 gen_jobs_front.py [out=jobsf.tsv] [pilot]"""
import random, zlib, json, sys
OUT = sys.argv[1] if len(sys.argv) > 1 else "jobsf.tsv"
DRILLS = ["zornhau", "zwerchhau", "schielhau", "scheitelhau", "krumphau", "advance", "retreat", "passing-step-forward", "passing-step-backward"]
SHAPED = {"zornhau", "zwerchhau", "schielhau"}
TRAIN = ["short_slim_male", "tall_heavy_male", "avg_longlimb_female", "tall_slim_male", "short_broad_female"]
TRAIN_LV = ["master", "experienced", "master", "experienced", "master"]
TEST = [("tall_slim_female", "master", 80), ("stocky_short_male", "experienced", 65), ("tall_slim_female", "beginner", 70), ("stocky_short_male", "beginner", 85)]
TEMPO = {"zornhau": 2.0, "zwerchhau": 1.7, "schielhau": 1.0}; LF = {"master": 1.0, "experienced": 1.15, "beginner": 1.5}
def job(name, split, body, drill, level, cam=None):
    seed = zlib.crc32(f"front/{drill}/{name}".encode()) % 1000000; r = random.Random(seed)
    if cam is None:
        cam = (round(r.uniform(60, 90), 1), round(r.uniform(1.0, 1.5), 2), round(r.uniform(2.6, 3.3), 2), round(r.uniform(20, 26), 1))
        deg = (480 if r.random() < 0.3 else 0, round(r.uniform(.008, .03), 3), r.randint(23, 32), round(r.uniform(.03, .08), 3))
    else:
        cam = (cam, 1.25, 2.9, 24.0); deg = (0, .02, 28, .05)
    if drill in SHAPED:
        gov = {"hand_y": round(r.uniform(0.84, 0.94), 2), "hand_x": 0.82, "sword_ang": 95}
        if drill == "schielhau":
            gov = {"hand_y": round(0.62 + (gov["hand_y"] - 0.89), 2), "hand_x": 0.62, "hand_lat": 0.30, "sword_ang": 75, "shoulder_raise": 2.0}
        extra = (240, "-", json.dumps(gov), json.dumps({"tempo": round(TEMPO[drill] * LF[level], 2)}), "real_v4.json")
    else:
        extra = (180, "-", "-", "-", "-")
    return (name, split, body, drill, level, *cam, *deg, seed, *extra)
per = {}
for d in DRILLS:
    tr = [job(f"{b}_{l}_front", "train", b, d, l) for b, l in zip(TRAIN, TRAIN_LV)]
    te = [job(f"{b}_{l}_az{az}", "test", b, d, l, az) for b, l, az in TEST]
    per[d] = [tr[0], te[0], tr[1], tr[2], te[1], tr[3], tr[4], te[2], te[3]]
jobs = [per[d][i] for i in range(9) for d in DRILLS]
if len(sys.argv) > 2: jobs = [per["zornhau"][0], per["zwerchhau"][1]] if sys.argv[2] == "pilot2" else [per["zornhau"][0], per["advance"][1]]
with open(OUT + ".tmp", "w") as f:
    for j in jobs: f.write("\t".join(map(str, j)) + "\n")
import os; os.replace(OUT + ".tmp", OUT); print(len(jobs), "jobs;", sum(j[1] == "test" for j in jobs), "test")
