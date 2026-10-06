#!/bin/bash
export PATH=$HOME/.local/bin:$PATH; cd /workspace/hema/real/raw
for id in $(cat ../dl_list2.txt); do [ -f $id.mp4 ] && continue
  yt-dlp --extractor-args "youtube:player_client=mweb" -f 18/b -o "%(id)s.%(ext)s" --write-info-json "https://www.youtube.com/watch?v=$id" > ../logs_dl_$id.txt 2>&1 || echo "FAIL $id" >> ../dl_fail.txt
  sleep 4; done; echo done > ../dl2_done
