#!/bin/bash
# restart the pseudo-labellers if they died (resumable: label.py skips done names)
cd /workspace/hema/rb
for k in 0 1 2 3; do pgrep -f "label.py q$k.jsonl" >/dev/null || nohup /workspace/hema/venv/bin/python label.py q$k.jsonl lab$k.jsonl 2 >> lab$k.log 2>&1 & done
