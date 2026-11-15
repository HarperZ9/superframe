#!/usr/bin/env bash
# Bake The Quota's era 3 plates (Allocation, year 20; plates package, 2026-10-22): the twelve q3_* places of
# content/quota/e3_world.lwd and q3_well_fire, the Well House burning. Skips a plate whose files are already there
# (rerun after a stop; delete a plate's png to rebake it), then relocks content/PLATES.lock.
# Run from the repo root:  bash render/bake_era3.sh  [names...]
set -u
mkdir -p content/logs
list=${*:-q3_school q3_office q3_furrowe_hall q3_mott_house q3_church q3_ward q3_squad q3_brack_kitchen q3w_far_bank q3_well_house q3_well_fire q3_tower q3_square}
for p in $list; do
  v=$(LW_PLATE=1 node -e "import('./render/places/$p.mjs').then(m=>console.log(Object.keys(m.default.variants)[0]))")
  if [ -f "content/$p/$v.png" ] && [ -f "content/$p/place.json" ]; then echo "$p: baked"; continue; fi
  LW_PLATE=1 node render/bake2.mjs --place $p --out content > content/logs/$p.v2.log 2>&1 && python render/tools/restreak.py --src content --dst content --only $p/$v >> content/logs/$p.v2.log 2>&1; echo "$p: $?"
done
node render/tools/plates.mjs lock
