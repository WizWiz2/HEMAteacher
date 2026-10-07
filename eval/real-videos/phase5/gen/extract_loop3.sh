#!/bin/bash
# Detached browser MediaPipe extraction (app on :5210) of every finished ba3 clip -> $BA/raw/<drill>__<split>__<name>.json.
# Stops after all NL render lanes wrote "lane N finished" and nothing is left. Usage: BA=/workspace/hema/ba3 NL=3 ./extract_loop3.sh
BA=${BA:-/workspace/hema/ba3}; NL=${NL:-3}; H=/workspace/hema/eval/harness; mkdir -p $BA/raw; cd $H
while true; do
  ITEMS=""
  for f in $(ls $BA/clips/*/*/*.mp4 2>/dev/null); do n=$(basename $f .mp4); d=$(basename $(dirname $f)); s=$(basename $(dirname $(dirname $f)))
    [ -f $BA/raw/${d}__${s}__$n.json ] || ITEMS="$ITEMS $d=$f"; done
  if [ -z "$ITEMS" ]; then
    fin=$(grep -c "lane [0-9]* finished" $BA/progress.txt 2>/dev/null)
    if [ "${fin:-0}" -ge $NL ]; then echo "extract finished $(date +%T)" >> $BA/progress.txt; echo "EXTRACT DONE" > $BA/EXTRACT_DONE; break; fi
    sleep 60; continue; fi
  PORT=5210 RAWDIR=$BA/raw nice -n 5 node ba_extract.mjs $BA/vr_ba3.json $ITEMS >> $BA/extract.log 2>&1
  sleep 5
done
