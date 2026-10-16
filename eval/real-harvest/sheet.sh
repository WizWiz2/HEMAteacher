#!/bin/bash
# sheet.sh <id> [interval_s] [start] [dur] [suffix] : contact sheet with timestamps
id=$1; iv=${2:-2}; ss=${3:-0}; du=${4:-9999}; suf=${5:-}
ffmpeg -v error -y -ss $ss -t $du -i raw/$id.mp4 -vf "fps=1/$iv,scale=${W:-240}:-1,drawtext=text='%{pts\:hms}':x=4:y=4:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.6,setpts=PTS" -frames:v 1 -f null - 2>/dev/null
ffmpeg -v error -y -ss $ss -t $du -copyts -i raw/$id.mp4 -vf "fps=1/$iv,scale=${W:-240}:-1,drawtext=text='%{pts\:hms}':x=4:y=4:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=${T:-6x8}" sheets/${id}${suf}_%02d.jpg
