#!/usr/bin/env bash
# Chancel Hill with its near side cut to garden walls, after the extra pass; then its stills.
cd "$(dirname "$0")/.."
until grep -q "EXTRA DONE" content/logs/extra.txt 2>/dev/null; do sleep 30; done
LW_PLATE=1 node render/bake2.mjs --place hill > content/logs/last-hill.log 2>&1
node render/tools/arena_from_plate.mjs station hill 0 0 14 10 --datum 40 > /dev/null
for v in lit frost dark; do node render/stills.mjs hill --variant $v --at -9,2,2; done
LW_PLATE=1 node render/bake2.mjs --place room > /dev/null 2>&1; LW_PLATE=1 node render/bake2.mjs --place room_day > /dev/null 2>&1
node render/stills.mjs room --variant night --at 0,0.6,0; node render/stills.mjs room_day --variant day --at 0,0.6,0
echo LAST DONE
