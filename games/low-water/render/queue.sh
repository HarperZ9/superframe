#!/usr/bin/env bash
# Bake places one after another at Idle priority: render/queue.sh <lane-log> <place> [<place> ...]
cd "$(dirname "$0")/.."; lane="$1"; shift
for p in "$@"; do echo "$(date +%H:%M:%S) start $p" >> "$lane"; bash render/idle2.sh content/logs/$p.v2.log --place $p >> "$lane" 2>&1; echo "$(date +%H:%M:%S) end $p $?" >> "$lane"; done
