#!/bin/bash
# exp.sh <tag>: rebuild model from the fixture in /workspace/hema-gap, synthetic lobo+test, seen real replay -> results/exp_<tag>.txt
cd /workspace/hema-gap; O=/workspace/hema/real/results/exp_$1.txt
node frontend/scripts/build-motion-patterns.mjs > $O 2>&1
node frontend/scripts/evaluate-motion-recognition.mjs /tmp/syn_$1.json lobo,test > /tmp/syn_$1.log 2>&1
grep -E "^==|all master|all beginner" /tmp/syn_$1.log >> $O
/workspace/hema/real/eval_seen.sh /workspace/hema-gap $1 >> $O 2>&1
cat $O
