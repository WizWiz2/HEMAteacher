#!/bin/bash
# p4sweep.sh "<DETECT overrides>|<ACTIVITY_GATE literal>|<settle>" ...: seen funnel (MODE=none)
cd /workspace/hema-gap; f=frontend/src/drill/continuousMotion.ts; g=frontend/src/drill/motionRecognition.ts
for spec in "$@"; do
  ov=${spec%%|*}; rest=${spec#*|}; gate=${rest%%|*}; [ "$rest" = "$spec" ] && gate=""
  [[ "$spec" == *"|settle"* ]] || sed -i "s/mode: 'settle' as 'settle'/mode: 'burst' as 'settle'/" $f
  [ -n "$ov" ] && sed -i -E "s/(otherFails: (true|false) )\};/\1, ...{ $ov } };/" $f
  [ -n "$gate" ] && sed -i -E "s/ACTIVITY_GATE = \{ stepMax: [0-9.]+, strikeMin: [0-9.]+ \}/ACTIVITY_GATE = { $gate }/" $g
  echo "== $spec"
  MODE=none node /workspace/hema/real/p3/lopo.mjs /tmp/sw.json 2>&1 | grep -E "^(all|clean|funnel)" | grep -v "funnel all"
  git checkout -- $f $g
done
