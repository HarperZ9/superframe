#!/usr/bin/env bash
# Bake era 1's outdoor plates on the harvest worlds (render/worlds/_season.mjs; package W3-C addendum, 2026-10-22):
# the post, the hill and the tower as era 1's own plates (q1_post, q1_hill, q1_tower), the Haldane Yard barns and Osby
# fair. Skips a plate whose files are already there (rerun after a stop), then relocks content/PLATES.lock.
# Run from the repo root:  bash render/bake_era1_season.sh
set -u
mkdir -p content/logs
for p in q1_post q1_hill q1_tower q1_barns q1_osby; do
  v=$(LW_PLATE=1 node -e "import('./render/places/$p.mjs').then(m=>console.log(Object.keys(m.default.variants)[0]))")
  if [ -f "content/$p/$v.png" ] && [ -f "content/$p/place.json" ]; then echo "$p: baked"; continue; fi
  LW_PLATE=1 node render/bake2.mjs --place $p --out content > content/logs/$p.v2.log 2>&1 && python render/tools/restreak.py --src content --dst content --only $p/$v >> content/logs/$p.v2.log 2>&1; echo "$p: $?"
done
node render/tools/plates.mjs lock
