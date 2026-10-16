#!/bin/bash
# peek.sh <id> <t1> <t2> ... : download tiny 0.5 s sections at given times (yt-dlp --download-sections, no full download),
# take one frame each -> sheets/peek_<id>.jpg (labelled grid, 4 per row)
export PATH=$HOME/.local/bin:$PATH; cd /workspace/hema/harvest; id=$1; shift
D=/tmp/peek_$id; rm -rf $D; mkdir -p $D; A=""
for t in "$@"; do A="$A --download-sections *$t-$(python3 -c "print($t+0.5)")"; done
yt-dlp -q --extractor-args "youtube:player_client=mweb" -f 18 $A -o "$D/s_%(section_start)s.%(ext)s" "https://www.youtube.com/watch?v=$id" 2>/dev/null
n=0; for t in "$@"; do f=$(ls $D/s_${t}.mp4 $D/s_${t}.0.mp4 2>/dev/null | head -1); [ -z "$f" ] && continue; n=$((n+1))
  ffmpeg -v error -y -i $f -frames:v 1 -vf "scale=320:180,drawtext=text='$t':x=3:y=3:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.6" $D/f_$(printf %03d $n).jpg; done
[ $n -eq 0 ] && { echo "peek failed $id"; exit 1; }
ffmpeg -v error -y -pattern_type glob -i "$D/f_*.jpg" -vf "tile=4x$(( (n+3)/4 ))" sheets/peek_$id.jpg && echo sheets/peek_$id.jpg $n
