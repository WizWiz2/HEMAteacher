#!/bin/bash
# exp_cfg.sh <tag> <fixture.gz> [sg=0] [hs=0] : run exp.sh with config toggles on top of the committed hema-gap code, then restore
cd /workspace/hema-gap; T=$1; FX=$2; shift 2
for o in "$@"; do case $o in
  sg=0) sed -i 's/styleGroups: true/styleGroups: false/' frontend/src/drill/motionTraining.ts;;
  trim=0) sed -i "s/HAND_TRIM = { on: true/HAND_TRIM = { on: false/" frontend/src/drill/motionRecognition.ts;;
  feet=*) sed -i "s/STRIKE_SCORING = { feet: 1 }/STRIKE_SCORING = { feet: ${o#feet=} }/" frontend/src/drill/motionRecognition.ts;;
  hs=0) sed -i 's/hand_share: 1,/hand_share: 0,/' frontend/src/drill/motionTraining.ts;;
esac; done
cp $FX frontend/test-fixtures/motion-poses.json.gz
/workspace/hema/real/exp.sh $T > /tmp/exp_$T.out 2>&1
git checkout -- frontend/src frontend/test-fixtures
grep -v "^\s*$" /tmp/exp_$T.out | grep -E "acceptDistance|master|beginner|own" | sed 's/ \[.*//'
