#!/bin/bash
# Two Idle lanes (priority is set inside each node job). Frames to $1.
R=${1:-${TMPDIR:-/tmp}/low-water-reel}; cd "$(dirname "$0")/.."
( for p in lamb fray; do node proto/reel.mjs $p $R >> $R/lane1.log 2>&1; done ) &
( for p in turntable secondary npcs enemies quay walkquay; do node proto/reel.mjs $p $R >> $R/lane2.log 2>&1; done ) &
wait
echo all done >> $R/lane2.log
