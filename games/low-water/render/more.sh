#!/usr/bin/env bash
# Weak plates found by looking at the stills: the Gut's near side, the stairs' light, the arrival pull-back.
cd "$(dirname "$0")/.."
until grep -q "LAST DONE" content/logs/last.txt 2>/dev/null; do sleep 30; done
export LW_PLATE=1
node render/bake2.mjs --place gut > content/logs/more-gut.log 2>&1 & node render/bake2.mjs --place wide_arrival > content/logs/more-wa.log 2>&1 & wait
node render/bake2.mjs --place stairs > content/logs/more-stairs.log 2>&1
for p in gut stairs wide_arrival; do node render/bake2.mjs --place $p --only meta > /dev/null; done
for v in night rigged frozen dark; do node render/stills.mjs gut --variant $v --at 0,0,0; done
for v in dark lit frost; do node render/stills.mjs stairs --variant $v --at 0,8.7,0; done
node render/stills.mjs wide_arrival --variant night
echo MORE DONE
