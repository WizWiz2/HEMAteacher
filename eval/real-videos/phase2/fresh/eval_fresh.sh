#!/bin/bash
# eval_fresh.sh <checkoutRoot> <tag>: FINAL ONLY. Replay locked fresh clips (own + cross + personal calibration) -> results/fresh_<tag>_*
F=/workspace/hema/fresh; R=/workspace/hema/real; mkdir -p $F/results
DR="advance guards-basic krumphau passing-step-backward passing-step-forward retreat scheitelhau schielhau zornhau zwerchhau"
python3 $F/facing_map.py > $F/results/facing_map.json
OWN=""; CROSS=""; for f in $F/rawframes/*.json; do d=$(basename $f | sed 's/__.*//'); OWN="$OWN $d=$f"; for x in $DR; do CROSS="$CROSS $x=$f"; done; done
cd /workspace/hema/eval/harness
FACING=$F/results/facing_map.json node $R/replay_facing.mjs $1 $F/results/fresh_$2_own.json $OWN > /dev/null 2>&1
FACING=$F/results/facing_map.json node $R/replay_facing.mjs $1 $F/results/fresh_$2_cross.json $CROSS > /dev/null 2>&1
echo "== generic ($2)"; python3 $F/score_fresh.py $F/results/fresh_$2_own.json $F/results/fresh_$2_cross.json
for v in all clean; do python3 $F/personmap.py $v > /tmp/fresh_pm_$v.json
  echo "== personal calibration ($2, $v)"; APPROOT=$1/frontend RAWDIR=$F/rawframes FMAP=$F/results/facing_map.json PERSONMAP=/tmp/fresh_pm_$v.json node $R/personal.mjs $F/results/fresh_$2_personal_$v.json 2>&1 | grep -v "^\s*$"; done
