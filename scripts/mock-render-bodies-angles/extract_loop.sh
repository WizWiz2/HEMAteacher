#!/bin/bash
# Detached: browser MediaPipe Lite pose extraction (in-app regression page of the PR #16 app = "before") for every
# finished ba clip. Raw dumps: /workspace/hema/ba/raw/<drill>__<split>__<name>.json ; page results: vr_before.json
BA=/workspace/hema/ba; H=/workspace/hema/eval/harness; FX=/workspace/hema/eval/ba_before; mkdir -p $BA/raw
(cd $FX/frontend && setsid nohup npx vite --port 5204 --strictPort > $BA/vite_before.log 2>&1 &)
for i in $(seq 60); do curl -s localhost:5204 > /dev/null && break; sleep 2; done
cd $H
while true; do
  ITEMS=""
  for f in $(ls $BA/clips/*/*/*.mp4 2>/dev/null); do n=$(basename $f .mp4); d=$(basename $(dirname $f)); s=$(basename $(dirname $(dirname $f)))
    [ -f $BA/raw/${d}__${s}__$n.json ] || ITEMS="$ITEMS $d=$f"; done
  if [ -z "$ITEMS" ]; then
    if grep -q "lane 1 finished" $BA/progress.txt 2>/dev/null && grep -q "lane 2 finished" $BA/progress.txt 2>/dev/null; then echo "extract finished $(date +%T)" >> $BA/progress.txt; break; fi
    sleep 60; continue; fi
  PORT=5204 RAWDIR=$BA/raw nice -n 5 node ba_extract.mjs $BA/vr_before.json $ITEMS >> $BA/extract.log 2>&1
  sleep 5
done
