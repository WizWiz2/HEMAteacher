#!/bin/bash
# run_replay.sh: offline replay of all browser raw frames (current main checkout in ./app) -> results/rp_*.json
cd /workspace/hema/real
python3 facing_map.py > results/facing_map.json
python3 -c "import json;m=json.load(open('results/facing_map.json'));print(json.dumps({k:('left' if v=='right' else 'right') for k,v in m.items()}))" > results/facing_flipped.json
DR="advance guards-basic krumphau passing-step-backward passing-step-forward retreat scheitelhau schielhau zornhau zwerchhau"
OWN=""; CROSS=""; for f in rawframes/*.json; do d=$(basename $f | sed 's/__.*//'); OWN="$OWN $d=$PWD/$f"; for x in $DR; do CROSS="$CROSS $x=$PWD/$f"; done; done
cd /workspace/hema/eval/harness
FACING=/workspace/hema/real/results/facing_map.json node /workspace/hema/real/replay_facing.mjs /workspace/hema/real/app /workspace/hema/real/results/rp_own.json $OWN > /workspace/hema/real/results/rp_own.txt 2>&1
FACING=/workspace/hema/real/results/facing_flipped.json node /workspace/hema/real/replay_facing.mjs /workspace/hema/real/app /workspace/hema/real/results/rp_own_flipped.json $OWN > /dev/null 2>&1
FACING=/workspace/hema/real/results/facing_map.json node /workspace/hema/real/replay_facing.mjs /workspace/hema/real/app /workspace/hema/real/results/rp_cross.json $CROSS > /dev/null 2>&1
DRILLPAGE=1 FACING=/workspace/hema/real/results/facing_map.json node /workspace/hema/real/replay_facing.mjs /workspace/hema/real/app /workspace/hema/real/results/rp_cross_drillpage.json $CROSS > /dev/null 2>&1
echo replay done
