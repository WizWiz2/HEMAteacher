#!/bin/bash
# eval_e2e.sh <tag> [bladedet.json]: 30 real clips, own + cross, blade off (no 2nd arg) or on
R=/workspace/hema/real; ROOT=/workspace/HEMAteacher-push; DR="advance guards-basic krumphau passing-step-backward passing-step-forward retreat scheitelhau schielhau zornhau zwerchhau"
OWN=""; CROSS=""; for f in $R/rawframes/*.json; do d=$(basename $f | sed 's/__.*//'); OWN="$OWN $d=$f"; for x in $DR; do CROSS="$CROSS $x=$f"; done; done
cd /workspace/hema/eval/harness
O=/workspace/hema/rb/e2e; mkdir -p $O
BLADEDET=$2 FACING=$R/results/facing_map.json node /workspace/hema/rb/replay_blade.mjs $ROOT $O/$1_own.json $OWN > /dev/null 2>$O/$1.err
BLADEDET=$2 FACING=$R/results/facing_map.json node /workspace/hema/rb/replay_blade.mjs $ROOT $O/$1_cross.json $CROSS > /dev/null 2>>$O/$1.err
python3 $R/score_seen.py $O/$1_own.json $O/$1_cross.json
