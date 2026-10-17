#!/usr/bin/env bash
# Rooms re-baked with matte floors after final.sh, then their stills and mode stills.
cd "$(dirname "$0")/.."
until grep -q "FINAL DONE" content/logs/final.txt 2>/dev/null; do sleep 30; done
export LW_PLATE=1
node render/bake2.mjs --place station > content/logs/extra-station.log 2>&1 & node render/bake2.mjs --place weigh > content/logs/extra-weigh.log 2>&1 & wait
node render/bake2.mjs --place brine > content/logs/extra-brine.log 2>&1
for p in station weigh brine; do node render/bake2.mjs --place $p --only meta > /dev/null; done
S() { node render/stills.mjs "$@"; }
for v in lit dark; do S station --variant $v --at 7,0,5; done
for v in night dark; do S weigh --variant $v --at 0.6,0,0.8; done; S weigh --variant night --at 0.6,0,0.8 --figs
for v in night wethour dark; do S brine --variant $v --at 0,0,0.3; done; S brine --variant night --at 0,0,0.3 --figs
node render/modes.mjs brine night; node render/modes.mjs quay night
echo EXTRA DONE
