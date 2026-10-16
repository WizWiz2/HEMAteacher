g () 
{ 
    id=$1;
    out=$2;
    shift 2;
    i=0;
    for t in "$@";
    do
        ffmpeg -loglevel error -y -ss $t -i raw/$id.mp4 -frames:v 1 -vf "scale=266:-1,drawtext=text='$t':fontcolor=yellow:fontsize=18:x=5:y=5" /tmp/z_$i.png;
        i=$((i+1));
    done;
    ffmpeg -loglevel error -y $(for k in 0 1 2 3 4 5 6 7 8;
do
    echo -i /tmp/z_$k.png;
done) -filter_complex "xstack=inputs=9:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0|0_h0+h1|w0_h0+h1|w0+w1_h0+h1" $out
}
