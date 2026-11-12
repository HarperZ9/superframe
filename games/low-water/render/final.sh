#!/usr/bin/env bash
# Last pass after finish.sh: the frost film, the Spit and the Ropewalk fixes, calmer daylight; then their stills.
cd "$(dirname "$0")/.."
until grep -q "FINISHED" content/logs/finish.txt 2>/dev/null; do sleep 30; done
export LW_PLATE=1
B() { node render/bake2.mjs "$@" > content/logs/final-$2.log 2>&1; echo "end $2 $?"; }
B --place ropewalk & B --place spit & wait
B --place quay --variants frost & B --place gasholder --variants frost & wait
B --place quay_day --only post & B --place gut_day --only post & wait
B --place mole --variants frost & wait
cd render
node tools/arena_from_plate.mjs spit spit 0 0 22 12 --datum 0 | head -1; node tools/arena_from_plate.mjs ropewalk ropewalk 0 0 26 6 --datum 9 | head -1
cd ..
for p in ropewalk spit quay gasholder quay_day gut_day mole; do node render/bake2.mjs --place $p --only meta > /dev/null; done
S() { node render/stills.mjs "$@"; }
for v in night frost dark; do S ropewalk --variant $v --at 13,0,3; done
for v in stars lanterns frost; do S spit --variant $v --at 12,0,5; done
S quay --variant frost --at -1.5,0,-1; S gasholder --variant frost --at 10,0,5.5; S mole --variant frost --at 30,0,-1.6
for v in day late; do S quay_day --variant $v --at -3,0,-3 --before quay; done; S gut_day --variant day --at 0,0,0
echo FINAL DONE
