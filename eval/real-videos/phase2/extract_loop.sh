#!/bin/bash
# Detached: browser MediaPipe Lite pose extraction (in-app regression page, app checkout on :5210) for every finished
# gen2 clip. Raw dumps: /workspace/hema/ba2/raw/<drill>__<split>__<name>.json ; page results: vr_ba2.json
BA=/workspace/hema/ba2; H=/workspace/hema/eval/harness; mkdir -p $BA/raw; cd $H
while true; do
  ITEMS=""
  for f in $(ls $BA/clips/*/*/*.mp4 2>/dev/null); do n=$(basename $f .mp4); d=$(basename $(dirname $f)); s=$(basename $(dirname $(dirname $f)))
    [ -f $BA/raw/${d}__${s}__$n.json ] || ITEMS="$ITEMS $d=$f"; done
  if [ -z "$ITEMS" ]; then
    if grep -q "lane 1 finished" $BA/progress.txt 2>/dev/null && grep -q "lane 2 finished" $BA/progress.txt 2>/dev/null; then echo "extract finished $(date +%T)" >> $BA/progress.txt; break; fi
    sleep 60; continue; fi
  PORT=5210 RAWDIR=$BA/raw nice -n 5 node ba_extract.mjs $BA/vr_ba2.json $ITEMS >> $BA/extract.log 2>&1
  sleep 5
done
