#!/usr/bin/env bash
# Bake The Quota's era 5 plates (plates agent, 2026-10-23): the seventeen q5_* places of year 115, three weeks in April
# (the mast over the churchyard, Mill Street, the five kitchens and flats, Ellie's spare room, the mortuary, the council, the
# archive, Haldane Yard, the square, the Well House, the ring road verge, the antique shop, headquarters, the syndicate).
# Skips a plate whose files are already there (rerun after a stop), bakes up to LW_JOBS at once (default 3), then relocks
# content/PLATES.lock. Run from the repo root:  bash render/bake_era5.sh [place ...]
set -u
mkdir -p content/logs
one() {
  p=$1
  v=$(LW_PLATE=1 node -e "import('./render/places/$p.mjs').then(m=>console.log(Object.keys(m.default.variants)[0]))")
  if [ -f "content/$p/$v.png" ] && [ -f "content/$p/place.json" ]; then echo "$p: baked"; return; fi
  LW_PLATE=1 node render/bake2.mjs --place $p --out content > content/logs/$p.v2.log 2>&1 && python render/tools/restreak.py --src content --dst content --only $p/$v >> content/logs/$p.v2.log 2>&1; echo "$p: $?"
}
export -f one
ALL="q5_mara_flat q5_furrowe_kitchen q5_brack_kitchen q5_channel q5_saro_flat q5_mortuary q5_council q5_archive q5_well_house q5_police q5_syndicate q5_mill_street q5_haldane_yard q5_square q5_tower q5_ring_verge q5_shop"
printf '%s\n' ${@:-$ALL} | xargs -P "${LW_JOBS:-3}" -I{} bash -c 'one {}'
node render/tools/plates.mjs lock
