#!/usr/bin/env bash
# After the bake lanes: fight ground and place.json metadata for every plate, then all stills.
cd "$(dirname "$0")/.."
until grep -q "end lamp " content/logs/laneA3.txt 2>/dev/null && grep -q "end office " content/logs/laneB7.txt 2>/dev/null; do sleep 30; done
cd render
for spec in "quay quay 13.6 -9.4 11 9 --datum harbour --spawns 16.2,-3.0;19.8,-2.6;18.2,-4.4;21.2,-4.0;16.6,-6.0" "floor floor -20 4 15 13 --datum harbour" "floor gully -2 3 16 12 --datum harbour" "brine brine -6 -3.2 12 7 --datum 6.5" "weigh weigh -6 -5 12 10 --datum 6.5" "lamp lamp -4 -4 8 8 --datum 30" "gut gut -8 -4 16 8 --datum 6.2" "gut dogs 0.5 -1.5 7 7 --datum 6.2 --spawns 3.4,3.6;2.6,4.8;4.8,4.4;3.6,1.0;1.4,0.0" "station hill 0 0 14 10 --datum 40" "gasholder gasholder 0 0 20 11 --datum 8" "ropewalk ropewalk 0 0 26 6 --datum 9" "spit spit 0 0 22 12 --datum 0" "mole mole 22 -3.6 16 4 --datum harbour"; do node tools/arena_from_plate.mjs $spec | head -1; done
cd ..
LW_PLATE=1 node render/bake2.mjs --place gut > content/logs/gut.v2.log 2>&1
for p in quay quay_day floor mole mole_day stairs lamp brine brine_day room room_day weigh weigh_day office gut gut_day hill station gasholder ropewalk spit wide_arrival wide_blackout wide_dawn; do LW_PLATE=1 node render/bake2.mjs --place $p --only meta > /dev/null && echo "meta $p"; done
bash render/stills_all.sh
echo FINISHED
