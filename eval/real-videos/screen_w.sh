#!/bin/bash
cd /workspace/hema/real; mkdir -p screen/claims
while true; do n=0
 for f in raw/*.mp4; do id=$(basename $f .mp4); [ -f screen/$id.json ] && continue; mkdir screen/claims/$id 2>/dev/null || continue; n=1
   nice python3 screen.py $id >> screen/log_$1.txt 2>&1; done
 [ -f dl3_done ] && [ $n = 0 ] && break; sleep 20; done
