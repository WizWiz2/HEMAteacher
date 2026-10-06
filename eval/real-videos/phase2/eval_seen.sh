#!/bin/bash
# eval_seen.sh <checkoutRoot> <tag>: replay the 30 seen real clips (own + cross, manifest facing) -> results/seen_<tag>_{own,cross}.json + score
R=/workspace/hema/real; DR="advance guards-basic krumphau passing-step-backward passing-step-forward retreat scheitelhau schielhau zornhau zwerchhau"
OWN=""; CROSS=""; for f in $R/rawframes/*.json; do d=$(basename $f | sed 's/__.*//'); OWN="$OWN $d=$f"; for x in $DR; do CROSS="$CROSS $x=$f"; done; done
cd /workspace/hema/eval/harness
FACING=$R/results/facing_map.json node $R/replay_facing.mjs $1 $R/results/seen_$2_own.json $OWN > /dev/null 2>&1
FACING=$R/results/facing_map.json node $R/replay_facing.mjs $1 $R/results/seen_$2_cross.json $CROSS > /dev/null 2>&1
python3 $R/score_seen.py $R/results/seen_$2_own.json $R/results/seen_$2_cross.json
