"""Job list for bodies/angles renders, in priority order (see docs/bodies-angles-split.md). Output: jobs.tsv
name split body drill level az h d lens scale noise crf drop seed"""
import random, zlib
STRIKES = ["zornhau", "scheitelhau", "krumphau", "zwerchhau", "schielhau"]
STEPS = ["advance", "retreat", "passing-step-forward", "passing-step-backward"]
LEVELS = ["master", "experienced", "beginner"]
TRAIN_NEW = ["short_slim_male", "tall_heavy_male", "avg_longlimb_female"]
TRAIN_OLD = ["tall_slim_male", "short_broad_female"]
TEST = ["tall_slim_female", "stocky_short_male"]
jobs = []
def train(body, drill, level, k=0):
    name = f"{body}_{level}_rnd{k}"; seed = zlib.crc32(f"{drill}/{name}".encode()) % 1000000; r = random.Random(seed)
    az = round(r.uniform(-25, 45), 1); h = round(r.uniform(1.0, 1.5), 2); d = round(r.uniform(3.0, 3.9), 2); lens = round(r.uniform(20, 26), 1)
    scale = 480 if r.random() < 0.3 else 0
    jobs.append((name, "train", body, drill, level, az, h, d, lens, scale, round(r.uniform(.008, .03), 3), r.randint(23, 32), round(r.uniform(.03, .08), 3), seed))
def test(body, drill, level, az):
    name = f"{body}_{level}_az{az}"; seed = zlib.crc32(f"{drill}/{name}".encode()) % 1000000
    jobs.append((name, "test", body, drill, level, az, 1.25, 3.3, 24.0, 0, .02, 28, .05, seed))
# zornhau first for every new body (creates the per-body guard fit used by the other strikes)
for b in TRAIN_NEW + TEST: train(b, "zornhau", "master") if b in TRAIN_NEW else test(b, "zornhau", "master", 0)
# Batch A: strikes, train new bodies (random camera), test bodies master/beginner at 0 and +40
for d in STRIKES:
    for b in TRAIN_NEW:
        for l in LEVELS:
            if not (d == "zornhau" and l == "master"): train(b, d, l)
    for b in TEST:
        for l in ["master", "beginner"]:
            for az in [0, 40]:
                if not (d == "zornhau" and l == "master" and az == 0): test(b, d, l, az)
# Batch B: strikes, remaining test grid + old train bodies at random cameras
for d in STRIKES:
    for b in TEST:
        for az in [0, 40]: test(b, d, "experienced", az)
        for l in LEVELS:
            for az in [20, -20]: test(b, d, l, az)
    for b in TRAIN_OLD:
        for l in LEVELS: train(b, d, l)
# Batch C: steps
for d in STEPS:
    for b in TRAIN_NEW + TRAIN_OLD:
        for l in LEVELS: train(b, d, l)
    for b in TEST:
        for l in LEVELS:
            for az in [0, 40, 20, -20]: test(b, d, l, az)
with open("jobs.tsv", "w") as f:
    for j in jobs: f.write("\t".join(map(str, j)) + "\n")
print(len(jobs), "jobs;", sum(j[1] == "test" for j in jobs), "test")
