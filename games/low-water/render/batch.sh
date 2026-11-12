#!/usr/bin/env bash
# Final key frames, two lanes at Idle priority (at most two heavy jobs at once). Writes frames/.
cd "$(dirname "$0")/.."
mkdir -p frames/logs
lane1() { for k in lamp_quay lamp_room; do LW_LOG=frames/logs/$k.log bash render/idle.sh render/kf.mjs --kf $k --w 1280 --h 720 --workers 6 --out frames; done;
          LW_LOG=frames/logs/dawn.log bash render/idle.sh render/dawn.mjs --out frames --w 1280 --h 720; }
lane2() { for k in brine_door chancel; do LW_LOG=frames/logs/$k.log bash render/idle.sh render/kf.mjs --kf $k --w 1280 --h 720 --workers 6 --out frames; done;
          for k in weigh_vote flats gut; do LW_LOG=frames/logs/$k.log bash render/idle.sh render/flat.mjs --kf $k --w 640 --h 360 --up 2 --out frames; done; }
lane1 > frames/logs/lane1.txt 2>&1 & lane2 > frames/logs/lane2.txt 2>&1 & wait
echo "batch done"; ls frames
