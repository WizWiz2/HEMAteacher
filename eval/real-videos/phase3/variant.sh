#!/bin/bash
# variant.sh <tag> [toggles]: apply toggles to the hema-gap source, rebuild the model, real reps + 1-NN diagnostic; restore.
cd /workspace/hema-gap; T=$1; shift; R=frontend/src/drill
for o in "$@"; do case $o in
  arm1) sed -i "s/ARM_REL = { on: false/ARM_REL = { on: true/" $R/motionRecognition.ts;;
  arm2) sed -i "s/ARM_REL = { on: false, keepAbsHoh: true/ARM_REL = { on: true, keepAbsHoh: false/" $R/motionRecognition.ts;;
  burst) sed -i 's/mode: "span" as/mode: "burst" as/' $R/motionRecognition.ts;;
  swt) sed -i "s/strikeWindowTemplates: false/strikeWindowTemplates: true/" $R/motionTraining.ts;;
  sg0) sed -i 's/styleGroups: true/styleGroups: false/' $R/motionTraining.ts;;
  feet=*) sed -i -E "s/STRIKE_SCORING = \{ feet: [0-9.]+ \}/STRIKE_SCORING = { feet: ${o#feet=} }/" $R/motionRecognition.ts;;
  floor=*) sed -i -E "s/j === 15 \|\| j === 16 \? \.25 : \.03/j === 15 || j === 16 ? .25 : ${o#floor=}/" $R/motionTraining.ts;;
esac; done
git diff --stat | tail -1
node frontend/scripts/build-motion-patterns.mjs 2>&1 | tail -1
cp $R/motionModel.json /tmp/model_$T.json
MODE=dump SRC=all ADDOUT=/tmp/realtpl.json node /workspace/hema/real/p3/lopo.mjs >/dev/null 2>&1; cp /tmp/realtpl.json /tmp/realtpl_$T.json
node /workspace/hema/real/p3/nn.mjs 2>&1 | grep 1NN
[ -n "$LOPO" ] && MODE=lopo SRC=all node /workspace/hema/real/p3/lopo.mjs 2>&1 | grep -E "^(all|clean)"
git checkout -- frontend/src
