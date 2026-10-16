#!/bin/bash
# rep.sh <out_name> <id:t0:t1[:crop]> ... : 8-frame rows sized for ~800px viewing -> sheets/r_<out>.jpg
out=$1; shift; c=$(echo "$1" | cut -d: -f4); f=1; [ -n "$c" ] && f=$(python3 -c "a,b=map(float,'$c'.split('-'));print(b-a)")
SH=$(python3 -c "print(int(800/(8*1.78*$f)))") NF=8 python3 /workspace/hema/harvest/strips.py /workspace/hema/harvest/sheets/r_$out.jpg "$@" && echo sheets/r_$out.jpg
