#!/usr/bin/env bash
# Bake every place for the game in two lanes at Idle priority (at most two heavy jobs at once).
cd "$(dirname "$0")/.." && mkdir -p content/logs
export LW_PLATE=1
lane1() { for p in quay weigh; do LW_LOG=content/logs/$p.log bash render/idle.sh render/bake_place.mjs --place $p --out content; done; }
lane2() { for p in brine lamp; do LW_LOG=content/logs/$p.log bash render/idle.sh render/bake_place.mjs --place $p --out content; done; }
lane1 > content/logs/lane1.txt 2>&1 & lane2 > content/logs/lane2.txt 2>&1 & wait
echo "bake done"
