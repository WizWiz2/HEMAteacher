#!/bin/bash
# vr_queue.sh: browser-MediaPipe pass (raw frames + own-drill result) for every cut clip lacking rawframes; loops until 'vr_stop' exists
cd /workspace/hema/eval/harness
while [ ! -f /workspace/hema/real/vr_stop ]; do
  while pgrep -f "node vr_eval.mjs" >/dev/null; do sleep 10; done
  A=""; for f in /workspace/hema/real/clips/*/*.mp4; do d=$(basename $(dirname $f)); c=$(basename $f .mp4); [ -f /workspace/hema/real/rawframes/${d}__${c}.json ] || A="$A $d=$f"; done
  if [ -n "$A" ]; then PORT=5210 RAWDIR=/workspace/hema/real/rawframes nice node vr_eval.mjs /workspace/hema/real/results/vr_own.json $A >> /workspace/hema/real/results/vr_own.log 2>&1; else sleep 20; fi
done
