#!/bin/bash
# p5/step4.sh <tag> <fixture.gz> "<spec>": rebuild model from the fixture + full phase-5 evaluation on top of the
# committed branch code, then restore. spec as p4sweep: "" = P4 (committed default),
# "|stepMax: 9, strikeMin: 0|settle" = P3 (settle detection, no activity gates).
# Output: /workspace/hema/real/results/p5_<tag>.txt (+ /tmp/p5_<tag>_*.log). Never touches the fresh set.
cd /workspace/hema-gap; f=frontend/src/drill/continuousMotion.ts; g=frontend/src/drill/motionRecognition.ts
T=$1; FX=$2; spec=$3; O=/workspace/hema/real/results/p5_$T.txt; R=/workspace/hema/real
cp $FX frontend/test-fixtures/motion-poses.json.gz
if [ -n "$spec" ]; then ov=${spec%%|*}; rest=${spec#*|}; gate=${rest%%|*}
  [[ "$spec" == *"|settle"* ]] && sed -i "s/mode: 'burst' as/mode: 'settle' as/" $f
  [ -n "$ov" ] && sed -i -E "s/(otherFails: (true|false) )\};/\1, ...{ $ov } };/" $f
  [ -n "$gate" ] && sed -i -E "s/ACTIVITY_GATE = \{ stepMax: [0-9.]+, strikeMin: [0-9.]+ \}/ACTIVITY_GATE = { $gate }/" $g; fi
echo "tag=$T fixture=$FX spec='$spec' $(date +%T)" > $O; grep -n "mode: '" $f | head -2 >> $O; grep -n "ACTIVITY_GATE = " $g >> $O
node frontend/scripts/build-motion-patterns.mjs >> $O 2>&1
node frontend/scripts/evaluate-motion-recognition.mjs /tmp/p5_${T}_syn.json lobo,test > /tmp/p5_${T}_syn.log 2>&1
echo "== synthetic (streaming)" >> $O; grep -E "^==|all master|all beginner" /tmp/p5_${T}_syn.log >> $O
node frontend/scripts/check-motion-scenarios.mjs > /tmp/p5_${T}_scen.log 2>&1; echo "== scenarios" >> $O; grep -E "^FAIL|^\{" /tmp/p5_${T}_scen.log >> $O
echo "== seen generic (MODE=none)" >> $O; MODE=none node $R/p3/lopo.mjs /tmp/p5_${T}_seen.json > /tmp/p5_${T}_seen.log 2>&1; grep -E "^(all|clean|funnel|accepted own|wrong)" /tmp/p5_${T}_seen.log >> $O
echo "== seen + real templates leave-one-person-out (MODE=lopo)" >> $O; MODE=lopo node $R/p3/lopo.mjs /tmp/p5_${T}_lopo.json > /tmp/p5_${T}_lopo.log 2>&1; grep -E "^(all|clean|funnel|accepted own|wrong)" /tmp/p5_${T}_lopo.log >> $O
echo "== idle (12 x 6 s, all drills selected; any accept = false accept)" >> $O; RAWDIR=$R/idle/rawframes MODE=none node $R/p3/lopo.mjs /tmp/p5_${T}_idle.json > /tmp/p5_${T}_idle.log 2>&1; grep -E "^(all|wrong)" /tmp/p5_${T}_idle.log >> $O
mkdir -p $R/results/p5_models/$T && cp frontend/src/drill/motionModel.json frontend/src/drill/motionPatterns.json $R/results/p5_models/$T/
git checkout -- $f $g frontend/test-fixtures frontend/src/drill/motionModel.json frontend/src/drill/motionPatterns.json
cat $O
