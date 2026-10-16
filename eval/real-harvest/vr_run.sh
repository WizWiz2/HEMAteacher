#!/bin/bash
# vr_run.sh: browser-MediaPipe pass (app VideoRegressionPage, same as real/rawframes) for every cut harvest clip lacking rawframes. Needs vite :5210 (real/app/frontend).
cd /workspace/hema/eval/harness
A=""; for f in /workspace/hema/harvest/clips/*/*.mp4; do d=$(basename $(dirname $f)); c=$(basename $f .mp4); [ -f /workspace/hema/harvest/rawframes/${d}__${c}.json ] || A="$A $d=$f"; done
[ -n "$A" ] && PORT=5210 RAWDIR=/workspace/hema/harvest/rawframes nice node vr_eval.mjs /workspace/hema/harvest/vr_own.json $A >> /workspace/hema/harvest/vr_own.log 2>&1
echo vr done
