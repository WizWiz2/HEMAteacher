#!/bin/bash
# search.sh: yt-dlp flat search (ytsearch20) per query in queries.txt -> search.txt (### query / id|dur|channel|title)
export PATH=$HOME/.local/bin:$PATH; cd /workspace/hema/harvest
Q=${1:-queries.txt}
while IFS= read -r q; do [ -z "$q" ] && continue; grep -qxF "### $q" search.txt 2>/dev/null && continue; echo "### $q" >> search.txt
  yt-dlp --extractor-args "youtube:player_client=mweb" --flat-playlist --print "%(id)s|%(duration)s|%(channel)s|%(title)s" "ytsearch20:$q" >> search.txt 2>> search_err.txt; sleep 4; done < $Q
echo done > search_done
