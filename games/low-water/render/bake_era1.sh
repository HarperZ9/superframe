#!/usr/bin/env bash
# Bake The Quota's era 1 plates (package W3-C, 2026-10-22): the nine q1_* places, and the harvest variant of the
# four era 2 places era 1 shares (post, hill, Haldane kitchen, Sheaf). Skips a plate whose files are already there
# (rerun after a stop), then relocks content/PLATES.lock. Run from the repo root:  bash render/bake_era1.sh
set -u
mkdir -p content/logs
for p in q1_board q1_census q1_exchange q1_backstore q1_loft q1_supper q1_supper_yard q1_barns q1_osby; do
  v=$(LW_PLATE=1 node -e "import('./render/places/$p.mjs').then(m=>console.log(Object.keys(m.default.variants)[0]))")
  if [ -f "content/$p/$v.png" ] && [ -f "content/$p/place.json" ]; then echo "$p: baked"; continue; fi
  LW_PLATE=1 node render/bake2.mjs --place $p --out content > content/logs/$p.v2.log 2>&1 && python render/tools/restreak.py --src content --dst content --only $p/$v >> content/logs/$p.v2.log 2>&1; echo "$p: $?"
done
for p in q_post q_hill q_haldane q_sheaf; do
  if [ -f "content/$p/harvest.png" ]; then echo "$p harvest: baked"; continue; fi
  LW_PLATE=1 node render/bake2.mjs --place $p --variants harvest --out content > content/logs/$p-harvest.v2.log 2>&1 && python render/tools/restreak.py --src content --dst content --only $p/harvest >> content/logs/$p-harvest.v2.log 2>&1; echo "$p harvest: $?"
done
node render/tools/plates.mjs lock
