#!/bin/bash
# dl.sh <id>... : 360p (-f 18) download of a VERIFIED candidate + MediaPipe pre-screen (screen.py)
export PATH=$HOME/.local/bin:$PATH; cd /workspace/hema/harvest
for id in "$@"; do
  [ -s raw/$id.mp4 ] || yt-dlp -q --extractor-args "youtube:player_client=mweb" -f 18 --write-info-json -o "raw/%(id)s.%(ext)s" "https://www.youtube.com/watch?v=$id" > logs_dl_$id.txt 2>&1
  [ -s screen/$id.json ] || nice python3 screen.py $id >> screen.log 2>&1
  echo "$id ok"
done
