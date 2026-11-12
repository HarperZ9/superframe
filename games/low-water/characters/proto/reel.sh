#!/bin/bash
# Two Idle lanes (priority is set inside each node job). Frames to $1.
R=${1:-C:/Users/Zain/AppData/Local/Temp/claude/C--dev/511462c2-3e73-4651-9517-1cd29bf62609/scratchpad/reel}; cd "$(dirname "$0")/.."
( for p in lamb fray; do node proto/reel.mjs $p $R >> $R/lane1.log 2>&1; done ) &
( for p in turntable secondary npcs enemies quay walkquay; do node proto/reel.mjs $p $R >> $R/lane2.log 2>&1; done ) &
wait
echo all done >> $R/lane2.log
