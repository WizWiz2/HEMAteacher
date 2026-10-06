#!/bin/bash
# p4syn.sh <tag> "<DETECT overrides>|<ACTIVITY_GATE literal>|<settle>": synthetic lobo+test + scenario checks; restore
cd /workspace/hema-gap; f=frontend/src/drill/continuousMotion.ts; g=frontend/src/drill/motionRecognition.ts; T=$1; spec=$2
ov=${spec%%|*}; rest=${spec#*|}; gate=${rest%%|*}
[[ "$spec" == *"|settle"* ]] || sed -i "s/mode: 'settle' as 'settle'/mode: 'burst' as 'settle'/" $f
[ -n "$ov" ] && sed -i -E "s/(otherFails: (true|false) )\};/\1, ...{ $ov } };/" $f
[ -n "$gate" ] && sed -i -E "s/ACTIVITY_GATE = \{ stepMax: [0-9.]+, strikeMin: [0-9.]+ \}/ACTIVITY_GATE = { $gate }/" $g
O=/workspace/hema/real/results/p4syn_$T.txt; echo "$spec" > $O
node frontend/scripts/evaluate-motion-recognition.mjs /tmp/p4syn_$T.json lobo,test 2>&1 | grep -E "^==|all master|all beginner" >> $O
node frontend/scripts/check-motion-scenarios.mjs 2>&1 | grep -E "^FAIL|^\{" >> $O
git checkout -- $f $g; cat $O
