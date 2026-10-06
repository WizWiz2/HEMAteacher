#!/bin/bash
cd /workspace/hema/real
while true; do n=0
 for f in raw/*.mp4; do id=$(basename $f .mp4); [ -f screen/$id.json ] && continue; [ -f raw/$id.part ] && continue; n=1
   nice python3 screen.py $id >> screen/log.txt 2>&1; done
 [ -f dl2_done ] && [ $n = 0 ] && break; sleep 20; done; echo done > screen/DONE
