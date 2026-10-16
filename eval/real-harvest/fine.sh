#!/bin/bash
# fine.sh <id> <start> <dur> <iv> <cropfilter or none> <name>
id=$1; ss=$2; du=$3; iv=$4; cr=$5; nm=$6
C=""; [ "$cr" != none ] && C="$cr,"
ffmpeg -v error -y -ss $ss -t $du -copyts -i raw/$id.mp4 -vf "${C}fps=1/$iv,scale=-1:${H:-170},drawtext=text='%{pts\:hms}':x=2:y=2:fontsize=13:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=${T:-8x8}" sheets/f_${nm}_%02d.jpg
