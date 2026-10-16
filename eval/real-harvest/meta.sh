#!/bin/bash
# meta.sh <id>...: metadata only (description, chapters, uploader) -> meta/<id>.json
export PATH=$HOME/.local/bin:$PATH; mkdir -p /workspace/hema/harvest/meta; cd /workspace/hema/harvest/meta
for id in "$@"; do [ -s $id.json ] && continue; yt-dlp --extractor-args "youtube:player_client=mweb" --skip-download -J "https://www.youtube.com/watch?v=$id" > $id.json 2>/dev/null; sleep 2; done
