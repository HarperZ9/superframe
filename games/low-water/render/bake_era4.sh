#!/usr/bin/env bash
# Bake The Quota's era 4 plates (plates agent, 2026-10-22): the sixteen q4_* places of year 70 (the tower, the station,
# the mill office, yard and floor, the boardroom, the Furrowe and Brack and Joss flats, the estate stair, the Sheaf,
# Exchange Street, the Row, the Well House floor, the police desk, and Mira's kitchen in year 103). Skips a plate whose
# files are already there (rerun after a stop), bakes up to LW_JOBS at once (default 3), then relocks
# content/PLATES.lock. Run from the repo root:  bash render/bake_era4.sh [place ...]
set -u
mkdir -p content/logs
one() {
  p=$1
  v=$(LW_PLATE=1 node -e "import('./render/places/$p.mjs').then(m=>console.log(Object.keys(m.default.variants)[0]))")
  if [ -f "content/$p/$v.png" ] && [ -f "content/$p/place.json" ]; then echo "$p: baked"; return; fi
  LW_PLATE=1 node render/bake2.mjs --place $p --out content > content/logs/$p.v2.log 2>&1 && python render/tools/restreak.py --src content --dst content --only $p/$v >> content/logs/$p.v2.log 2>&1; echo "$p: $?"
}
export -f one
ALL="q4_mill_office q4_board q4_police q4_furrowe_house q4_brack_flat q4_joss_flat q4w_saro_flat q4_mill_floor q4_well_floor q4_estate_stair q4_station q4_mill_yard q4_row q4_exchange_street q4_tower q4_sheaf"
printf '%s\n' ${@:-$ALL} | xargs -P "${LW_JOBS:-3}" -I{} bash -c 'one {}'
node render/tools/plates.mjs lock
