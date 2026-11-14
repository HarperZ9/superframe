<!-- writing-profile: research -->
# Environment passes: q1_supper and q1_loft

Environment pilot, 2026-10-23. Props are authored in render/props/ (SDF solids with per-prop surface kinds in
kinds.mjs), dressed by render/props/room_supper.mjs and room_loft.mjs, and called from render/worlds/q1_rooms.mjs.
Before captures: content/q1_supper/supper.png, content/q1_loft/evening.png as of commit dfbc9b9 (flat orange, box bales,
two hay blobs). Previews at half size are in render/preview/v2/.

## Pass 1 (preview, 960 x 650)
Verdict: the blockout is gone and the rooms read as places (55 and 39 distinct props, board walls, strand hay, bound bales,
clothed tables), but both are still too orange, the supper's braces are heavy and its cloth blows out, and the loft's sun
bars do not land and the big heap sits in black.

## Pass 2 (full size 1920 x 1300, baked 2026-10-23)
Changes: wall boards greyer, cloth darker, braces and rafters thinned, grade desaturated with a brown shadow tint, loft
sun raised to 170000 and aimed through the door, wider seams in the gable wall.
Verdict: colour is now restrained but carries a red-pink cast in the supper; the cloth no longer glows yellow but is still
the brightest mass; the bales still read as cream boxes (the straw bands are too fine to survive the painter), the last
sheaf reads as a bristly stump, and the loft hay is two large mounds with real texture but still blob-shaped, the right
one speckled black where the sun does not reach, the hollow not visible. Not yet at the bar.

## Next pass (not done in this run)
Bales: coarser bands (about 4 cm), visible twine, offsets and a broken bale. Sheaf: taller, flared head, a loose cord end.
Hay: break each mound into forkfuls with a ridge line and a cut face; light the hollow from the door. Cloth: lower the
albedo again and add fold shadows. Grade: remove the pink in the shadow lift.

## Measures (pass 2)
- Distinct props: supper 55, loft 39 (render/props/shell.mjs distinct()).
- Bake time: supper 99 s, loft 81 s at 1920 x 1300, run in parallel, 102 s wall. The old plates took 41 s and 75 s.
- Flat primitive faces above 5% of the frame: not measured.
- Greyscale squint test: not measured.

## Pass 3 (full size, 2026-10-23)
Changes: wood and floor materials moved from red-brown to tan and umber, the dusk spill from the door raised, grade
tinted cool in the shadows; cloth albedo lowered; bale bands widened to about 5 cm with thicker twine; a broken bale
with a spill of straw; a taller sheaf on a stool; the loft heap rebuilt from six cones with ridges, its bounding box
widened (the old one cut it flat), the hollow moved to the front face with a small lamp; ear tones lowered.
Verdict: the pink is gone and the supper reads amber and umber, but it is lit too evenly: the references (Bierstadt's
firelit rock, van der Neer's river) hold one pool of light and deep, quiet shadow, and the supper has none. The cloth
and plates are still the brightest mass. The sheaf is taller and tied, yet its ears still flare into a white starburst.
The bales now have visible bands and twine, and the broken bale reads. In the loft the hollow is visible and lit, but as
a flat disc; the heap is still one big blob with black speckle on the shaded side.

## Measures (pass 3, 1920 x 1300)
- Distinct props: supper 55 plus the broken bale and spill, loft 39.
- Flat faces: the largest patch of one object with one normal is 6.7% of the frame in the supper (the floor, which has
  seams and chaff in its colour but no relief) and 1.6% in the loft. One patch exceeds 5%, so the supper misses the target
  by the floor alone. Method: pid and normal (35% thresholds) from the bake's buffers, connected regions.
- Squint test (Gaussian blur radius 14, grey): supper focal area (tables) averages 0.397 against 0.343 for the room, and
  39% of the room is brighter than the tables, so the tables do not lead. Loft focal area (hollow and heap face) averages
  0.509 against 0.363, 21% of the room brighter, so the loft passes.
- Bake time: supper 97 s, loft 87 s, in parallel.
- Captures for review (untracked, the references are private): design/art/work/playcrop-*.png (1280 x 720 at plate
  scale), sidebyside-*.png (crop beside references 38 and 31), squint-*.png.

## Recipe hash
render/tools/plates.mjs hashed only the worlds a place imports, so a prop edit did not invalidate a plate. It now adds
every file under render/props/ to the recipe when a place or its worlds import from it.

## Next
Cut the fill and make the lantern pools lead (lower the tables' albedo again, raise the lamp falloff). Replace the
sheaf's ear surface with matte strands. Break the big heap into forkfuls with a cut face and give the floor relief
(boards with wear and nail heads) to bring it under 5%.

## Pass 4 (full size, 2026-10-23)
Method, after the staged room rebuild in the 23 October video catalogue (#9): shell, then furniture, then clutter, then
close geometry, then materials, each stage judged on its own. This pass worked the last two stages: floor and hay
geometry, then albedo and light. Light states (catalogue #7) are now variants: supper and unlit for the barn, evening
and lamp for the loft.
Changes: fill removed in the supper and the wall lanterns cut to 0.8 against 15 for the table lanterns, hung lower; the
sheaf's lantern moved off it; cloth, plate, bale, wall and floor albedo lowered; ears matte; floor made of repaired
sections (three woods, boards each a little proud or sunk and cupped); loft heap terraced into forkfuls with a notch cut
into its face and a tunnel cut for the hollow; a second fill from the right so the shaded side is not black.
Verdict: the supper is darker and the lantern pools now show on the tables, but the tables still do not lead the squint
test. The unlit state is almost black (the door spill only) and needs an ambient floor. In the loft the terraces and the
cut face read as forked hay and the hollow is a real cavity with a lit back wall; the lamp state is the strongest image
of the pair. The heap's shaded side still has black speckle. The sheaf is still the brightest object in the supper.

## Measures (pass 4)
- Flat faces: largest single-object, single-normal patch 3.1% of the frame in the supper (was 6.7%), 1.4% in the loft.
  No patch exceeds 5%. Target met.
- Squint test, same boxes as pass 3: supper 38% of the room is brighter than the tables (target under 15%, was 39%), so
  not met; the front floor, the lit bales and the wall pools stay brighter than the table area. Loft 21% (target met
  for its focal area only if read as under 25%; it is above the 15% line too).
- Bake time: about 100 s per room with two variants each, run in parallel.
- Distinct props: supper 56, loft 39.

## Next
Give the tables their own pool (a lantern low over each, cone-limited) and take the floor and bale walls two stops down;
set an ambient floor for unlit; replace the sheaf's ear shape with fewer, thinner strands; lower the loft's pit noise.

## Pass 5 (full size, 2026-10-23)
Changes: a cone-limited lamp over each supper table (the hooked lanterns cut to 3), floor, bales and boards lowered about a
stop, straw highlights now use a paler bone with gold rare, where sand was used before, shadows umber, pit noise on the hay cut to a third,
sheaf and ear strands thinner, an ambient floor for the unlit state, the loft hollow lamp raised.
Verdict: the supper now reads as lantern light on laden tables with dark walls and one quiet cool door; the umber holds
and the pink is gone. The loft's black speckle is gone, the shaded side is smooth and dark. The sheaf is still a flat
starburst of ears. Colour still leans orange in the straw lit by the lamp; that is the light, which is right.
Squint (share of the room brighter than the focal area, target under 15%): supper 22.7% (from 38%), loft 17.4% (from 21%),
backstore 6.6%. The supper and loft miss the target; the backstore meets it.
Flat faces (largest single-object, single-normal patch): supper 3.1%, loft 1.6%, backstore 1.6%.
Bake time, three rooms in parallel: 184 s supper, 170 s loft, 143 s backstore.

## q1_backstore: the staged method (catalogue #9), judged stage by stage
The video's sequence is reference and layout, shell and windows, furniture, clutter, close-up geometry, materials, each
checked against the reference photograph before the next. Here the target for each stage is the 23 October video's own
stage image plus the in-house supper and loft plates. LW_STAGE (1 to 5) bakes the room up to a stage, so each stage is a real
checkpoint. The sheet is design/art/work/backstore-stages.png (untracked); half-size previews.
- Layout: from design/eras/era1.md line 133 (sweepings, sacks, the foreman's strap on a nail, dust in the lamp shaft) and the
  old plate's marks (scale, ledger, window low in the west, door to the mill).
- Stage 1, shell: board walls on a stone plinth, a floor of repaired sections, two ceiling beams, the window cut, the mill
  door. Verdict: the box and the window read, the floor reads, but the walls are black and nothing can be judged; light
  came first on the next pass.
- Stage 2, furniture: beam scale, high desk with a ledger, hand cart, pallets, jar shelf, barrel. Verdict: every piece
  reads at its silhouette and is the right size to a person; the cart and the scale are the best. The desk legs splay oddly.
- Stage 3, clutter: forty-five sacks, the weights, the strap, the boots, sweepings, the desk lamp. Verdict: the room is
  now the year's grain stacked to the beams, but the sacks are one dark mass and the lamp blows out the wall behind it.
- Stage 4, close geometry: spilled grain, broom, scoop, window frame, cobwebs. Verdict: small and correct; the grain spill is
  too small to count at play size.
- Stage 5, materials: sackcloth weave, flour dust, grain kinds. Verdict: the sacks gained surface but stayed dark; the fix
  was light, not albedo.
- Light pass (after stage 5): the lamp cut to 2.6, a camera fill, the sun re-aimed. Verdict: the room is a readable
  place with the desk as its focal pool (squint 6.6%); the sun shaft through the window still does not land across the sacks,
  and the sacks read as blobs. Both are next.
Lesson from running the method: judging a stage before light is set wastes it; the first stage needs a flat work light.

## Next
Sun through the backstore window (check the cut against the sun's direction), sack shapes with a visible tie and corner,
a work-light variant for stage judging, the supper's sheaf ears, then the squint target on the supper and loft.

## Pass 6: scaling the staged method to the other era 1 rooms (2026-10-23)
Fixes first. Supper: benches moved to the weathered grey wood so they stop catching a bright strip; the sheaf's flare is
cut and its top tapers (its ears no longer make a flat disc, but it still reads brighter than anything near it).
Backstore: the sack tie is a thick rope band with a flared neck above it. The sun shaft was not a geometry fault: a
sun with `soft: 2` (the shadow ray's penumbra constant, small is blurry) spreads a window-sized opening to nothing. The
sun in these rooms now uses `soft: 40` as gut_day does. That made the loft's sun read; in the census and backstore it
still does not land as a visible shaft, cause not found (the shaft should cross the counter top in the census and the
scale in the backstore). Open.
Light states: every new room has a `work` variant, a flat even light with no sun, for judging build stages. It worked:
stage 1 of both rooms was legible at once, unlike the backstore's first run in the afternoon light.

### q1_census (Mott's counter), four stages, each judged on the work light
- Stage 1, shell: limewashed walls on a board wainscot, street door propped, one casement. Verdict: the room reads; the
  plaster is too plain and the wainscot too dark.
- Stage 2, furniture: counter, pigeonhole wall, clerk's desk, stove, bench, coat rack. Verdict: scale to a person is
  right; the counter is a long flat box from this angle and its panels barely show.
- Stage 3, clutter: slips, clock, notice board, queue rail, rug, jug. Verdict: the queue rail and rug tell the story
  (a line to a counter); the red rug was too hot and became a dark blue field with a clay border.
- Stage 4, close detail: lamp, crate of forms, sample sack, cobweb, a dropped slip. Verdict: right.
- Final: 28 distinct props; squint 37% brighter than the counter (not met); flat share 2.3% (met). The morning is dull:
  the sun does not land (see above), and the light has no pool.

### q1_board (the registrar's upstairs room), four stages
- Stage 1: two windows, the fireplace breast, wainscot. Verdict: reads at once. The fire was a white blob.
- Stage 2: long table, ten chairs, sideboard, pigeonholes, coat rack, rug. Verdict: the best furniture read so far; chairs
  and the turned legs hold at play size.
- Stage 3: decanters, glasses, papers, candle dishes, clock, map board. Verdict: the table is dressed but all objects are the same
  height band; a ledger and a taller object would give it a skyline.
- Stage 4: cobwebs, books, cold stove, desk, bucket. Verdict: fine.
- Final: 26 distinct props; squint 27% brighter than the table (not met); flat share 2.2% (met). The flame is smaller.

### q1_exchange (the weigh-house hall), four stages on the work light
- Stage 1, shell: grey board walls with open seams on the sun side, tie-beams, posts, the loading opening. Verdict: reads as
  a hall; the near and far posts are right; the old world's black ground shows around it.
- Stage 2, furniture: two beam scales, the gallery with its balustrade and stair, the paying counter, the price board.
  Verdict: the scales and the gallery carry the room and say "weighing"; the price board reads as a black slab at this size.
- Stage 3, clutter: sacks on the pallet and the pan, carts, barrel, coin box, tally slips, cold lanterns, a hoist.
  Verdict: right density; the sacks are the weakest shapes (still dark lumps).
- Stage 4, close detail: chaff, spilled grain, a slit sack, rope, bucket. Verdict: fine at play size, invisible at thumbnail.
- Final: 39 distinct props; squint 30.5% of the room brighter than the scale area (not met); flat share 1.4% (met).
  The afternoon plate is dark: the sun bars through the open seams do not show, and the old hall's black ground and its
  own surface function were kept, so the plate has a black surround where the other rooms have the shared grey. Next: take the old
  surround out and test the seam bars with `soft: 40` on a wider gap.

### q1_supper_yard
Not started. It still uses era 2's granary world. It is an exterior at night: a barn wall with the lit window, the yard,
a wagon, a rick, fencing, the lantern on its pole; it needs the exterior camera and the moon, and is the next room.

### Reuse notes
render/props/civic.mjs documents each prop's parameters in its header. mill.mjs and room_*.mjs are room-specific but
use the same record shape: prop(name, bb, f). New surface kinds go at the end of kinds.mjs so earlier ids never move.

## Era 4 places (plates agent, 2026-10-22)

Sixteen plates of year 70, the closure, built from the era 4 kit (render/props/e4_*.mjs): lino, papered and gloss walls with a nicotine film, concrete, terrazzo, machine paint, carpet, Formica, sooted brick, and lettering painted into the surfaces. One motivated light leads in each room. Judged at full size against the catalogue of 2026-10-22.

- q4_police: two tubes, one failing, over the counter and the duty desk; POLICE reads on the sign and the report sits in the typewriter. Passes visual-check.
- q4_mill_office: the tube over the steel desk, the floor's sodium in the long internal window, cabinets with one drawer pulled. Reads at once.
- q4_board: the low sun from the tall window lands on the table and the papers. The map on the easel is small at play size; it needs a close look (macro) to read.
- q4_furrowe_house: grey light from the sink window across the red and cream lino and the Formica table. The first bake was black because the window panel blocked its own light; the light now sits inside the glass.
- q4_brack_flat: the armchair to the set and the bottles by it under one low bulb. The window glows white, so the street's sodium shows only on the wall beside it.
- q4_joss_flat: the door table under the bulb, three red bowls, Anni's chair with the blanket, the fair bowl with its plant on the sill. The best room of the set. Passes visual-check.
- q4w_saro_flat: the table lamp on the tea glasses, the Vell rug on the wall, the year 70 window behind the curtain. Reads; the Formica speckle is loud.
- q4_mill_floor: four bays of spinning frames under three sodium high bays, the line shaft and belts, dusk in the tall windows. The concrete floor paints blotchy.
- q4_well_floor: brass lamps low over five rugs, the reading desk, the shelf of books, the tea tray, the burn mark patched with new board. Reads warm and still.
- q4_estate_stair: one tube on the half landing, a sodium slot, the dead bulb below. Dark on purpose; the flights read only at the top. Weakest interior.
- q4_station: iron columns and the canopy frame, three sodium lamps, the Saros' bags on the platform, the EDRIN board. The roof came off after the first bake hid the platform.
- q4_mill_yard: HALVARD over ORME & SON reads on the gate board under the gate lamp, with the brazier and the bales. The stack falls outside the frame.
- q4_row: the Vell terrace under its sodium, the rail on the race wall, washing, bins. The poster does not show on the plate after two moves (end wall, then the last house's front by the lamp post); it is the open item for this room.
- q4_exchange_street: CHAFFERS OUT in run white paint across the exchange sign, a ladder against the front, two sodium posts on wet setts. Reads.
- q4_tower: era 2's square with six sodium posts on the corners, wet, at dusk; the stack sits off the frame. The ground stays patchy.
- q4_sheaf: era 2's room with the jukebox lit against the back wall, pints and a full ashtray on the back table. Reads; the windows glow white, not sodium.

Pass 2 (fixes, 2026-10-23):
- q4_row: the bill now shows. The first sat on a house front behind the sodium post, so the post's head hid it and the paint pass took it into the brick. It now hangs 1.6 m wide on the outer flank of the end wall, lit by the next post along: paper white, a face in coarse dots, the slogan in block capitals. Passes; the slogan reads only through the read verb at play size.
- q4_estate_stair: passes. The walkway sodium comes in through the propped door and lays an orange wedge over the pram, the bags and the foot of the flight. The tube still lights the half landing. The scrubbed C on the wall was mirrored and now reads the right way round.

## Era 3 places (plates agent, 2026-10-22)
Rooms in render/worlds/q3_rooms.mjs and q3_rooms_b.mjs, props in render/props/e3_room.mjs and e3_street.mjs. One verdict per plate, judged on the baked png against CATALOGUE.md after the second bake.
- q3_school: passes. Desks, blackboard, stove and the schoolbook read at a glance, and the windows now light the floor; the pinafore coats still sit on the teal repaint.
- q3_office: passes. The counter bulb pools on the register and the rails, and the register shelf carries the room.
- q3_furrowe_hall: passes. One bulb, the mirror, the stair and the runner; the front door leaf is hard to see against its frame.
- q3_mott_house: passes. The door table, the stamped bowls, the washing line and the stove read under one bulb; the stair now climbs inside the room.
- q3_church: readable but flat. The pews, pulpit and sheeted altarpiece show, and the window still throws no clear pool. The weakest interior.
- q3_ward: passes. Two brownout bulbs, cots in rows, screens and the chalk cross; dark as the night should be.
- q3_squad: passes. The rifle rack, the card table under its bulb and the lit stove give it one clear warm centre.
- q3_brack_kitchen: passes. The range glow and the bulb read, and the cracked wedding photograph now hangs clear of the coats.
- q3w_far_bank: readable but flat. The walls go olive and the window on the town carries too little light; it needs a second pass.
- q3_well_house: passes as a base. The house, the fence, the chalked door and the gate notice read at the closer framing; the yard ground has no texture yet.
- q3_well_fire: the barred door and the firelit window read, with no red flash. The flame tongues paint as white blobs and need a softer shape.
- q3_tower: passes as the wide lens. Grey, no snow, washing lines on the west row; the ration queue is the crowd tier's at run time.
- q3_square: weak. The near row of houses fills a third of the frame and the cobbles are empty until the crowd tier fills them.

Pass 2 (fixes, 2026-10-23):
- q3_church: passes. The sleet light sits inside the tall window and falls in a grey pool across the slabs to the front pew; the walls lift from mud to limewash.
- q3w_far_bank: better, not finished. The walls are limewash, no longer olive, and the river window lights the table and the bowl. The oxblood lino now reads pink under that light.
- q3_square: passes. Pulled back and higher, the scale, the exchange, the lit row and the siding all read, and the near row now frames the square along the bottom edge.
- q3_well_fire: better, not finished. The tongues no longer clip to white; they glow cream going to ochre at the tips on a new low emitter. They still read as smooth pins, not flames, and need a ragged, leaning shape.

## Pass 7: the sun, pools, the exchange surround, the yard (2026-10-23)
### The sun shaft: cause found
Checked directly with a light-only buffer (the sun's shadow-ray visibility and N dot L per pixel, through the room camera) and
the plate's own HDR values at those pixels. The geometry is right: in the census 5160 of 70063 visible pixels are sunlit and
in the backstore 5137 of 78879, as thin bands on the counter, the floor and the sacks; the walls face away from the sun,
which is correct. The shaft was invisible because the sun was too weak, not blocked: the sun is a light 200 m away, so
its strength falls with the square of that distance, and an intensity of 150000 to 170000 gives the same radiance as a lamp
of about 4 at one metre. Measured on lit pixels, the HDR luminance was 2.8 times the shadowed neighbours in the census and
1.4 times in the backstore. Earlier `soft: 2` made it worse (a window-sized opening smears out), `soft: 40` fixed the
penumbra; the intensity is now 900000 to 1200000, and the census plate shows the bars across the counter and the floor.
### Cone-limited pools
Every room has a narrow-cone lamp (mode 1, direction straight down) over its focal area: the supper's tables, the census
counter, the board's long table, the exchange's scales and counter, the loft's hollow.
### The exchange's black surround
The old hall's sky function returned night; the place now uses the shared `sky: () => 0.05` and paint ids, so the surround
is the same grey-brown as the other rooms.
### q1_supper_yard, built as its own night exterior
Barn board wall with the doors ajar and a lit window, a tiled eave, a slab apron on stubble mud, wagon, hay rick, bales,
trough and pump, fence, two trees, the bench with Ilo's plate, the lantern post, barrels, woodpile, ladder. 33 distinct
props. Verdict: it reads as a lit yard against a dark field and the barn glows from inside; the roof slab is large and flat
and the far ground carries long ink lines that look wrong at the top right. Flat share: the stubble field is one surface
across the whole frame (56% single patch), so the yard fails the flat-face target; it needs relief and patches of stubble,
puddle and trampled earth.

### Measures after pass 7 (squint = share of the room brighter than the focal area; target under 15%)
| Room | Squint | Flat patch | Distinct props |
|---|---|---|---|
| q1_board | 11.9%, met | 2.2% | 26 |
| q1_supper_yard | 12.4%, met | 56.4%, not met (ground) | 33 |
| q1_supper | 18.4% (was 24.0%) | 3.1% | 57 |
| q1_exchange | 29.8% (was 30.5%) | 1.4% | 39 |
| q1_census | 30.2% (was 37.4%) | 2.3% | 28 |
| q1_loft | 29.7% (was 18.1%, worse) | 1.6% | 39 |
| q1_backstore | 34.5% (was 7.4%, worse) | 1.6% | 41 |
The stronger sun lifted the lit floor and sacks in the loft and the backstore above their focal areas, so those two got
worse; the sun's bars are now the brightest thing in them. They need the sun held to the focal object (aim the shaft at
the desk or the hollow) and keep it off the open floor. Bake time with seven jobs in parallel: about eight minutes.

## Pass 8: aimed suns, tight pools, yard relief (2026-10-23)
Changes: the sun in the backstore is aimed through the window at the desk, in the loft through the loading door at the
hollow, in the census through the window at the counter, in the exchange along the seams at the scales; the intensities
are 150000 to 400000, down from pass 7, and the camera-side fills are 0.2 to 0.6. The census has four pools 1.6 m up over
the counter, the exchange two at 2.7 m over the scales, the supper six at 1.5 m over the tables. The census floor is a
darker wood. The yard's ground has plough rows 0.12 m high, swells, and patches of mud, stubble and dust; the barn wall is
split into bays of three woods and the roof into tile, slate and brick courses, so no single surface covers the frame.
Verdict: the loft's door sun lands on the heap and the hollow; the backstore's sun catches the sacks and the desk, but its
left wall is solid black; the census counter now carries three clear pools; the yard still reads as one lit pocket in a dark
field. Squint is under 15% in all seven rooms and flat patches are under 5% in all seven.

| Room | Squint (target under 15%) | Flat patch (target under 5%) |
|---|---|---|
| q1_census | 10.2% | 2.3% |
| q1_supper | 11.6% | 3.1% |
| q1_exchange | 12.6% | 1.4% |
| q1_board | 12.8% | 2.2% |
| q1_supper_yard | 13.6% | 4.0% |
| q1_loft | 14.4% | 1.6% |
| q1_backstore | 7.3% | 1.6% |
Measurement boxes are mine and a test can be flattered by a wrong box. Two were wrong and I moved them after looking at the
blurred images: the census box now covers the counter top and not the dark counter front, and the exchange box covers the
scales and not the price board. With the earlier boxes the census read 24.5% and the exchange 20.0% on the same plates. The
other five boxes are unchanged since pass 7.
Known flaws left: the backstore's left wall has no light at all; the loft's sunlit heap is bright enough to bleach its
strands; the yard's ground ink lines at the top right.

## Lock and the era 3 and 4 rebake (2026-10-23)
render/tools/plates.mjs now hashes only the props files a plate's worlds import (followed inside render/props), so a
prop file written for one era no longer changes another era's recipe. I re-baked the 31 plates whose recipe had changed (q1_barns,
q1_osby, q3_*, q3w_far_bank, q4_*, q4w_saro_flat) from their lock recipes, three at a time, about 20 minutes in all. Two failed to
import (q3_brack_kitchen and q3_squad): the era 3 agent had a half-edited q3_rooms_b.mjs in the working tree. Part-way through,
that agent's uncommitted edits to q3_church, q3_square, q3_well_fire, q3w_far_bank, q3_rooms.mjs, q3_rooms_b.mjs, e4_outside.mjs
and e4_rooms2.mjs appeared, so the lock records new entries only for plates whose source files are all committed (the seven
era 1 rooms, q1_barns, q1_osby, q3_tower); the other 28 era 3 and 4 plates keep their previous lock entries until that agent
commits and re-locks. No era 2 (q_*) entry changed.

## Era 5 places (plates agent, 2026-10-23)

Seventeen q5_* plates on a new era 5 kit (render/props/e5_kit.mjs, e5_rooms.mjs, e5_rooms2.mjs, e5_outside.mjs), with the era 3 and era 4 kits reused by import. Each room has one main light, named in its dresser's comment. Screens are lit white so the shell's glyph can sit on them. I looked at every plate after the first bake and rebaked eight: the Brack kitchen, the Saros' flat, the mortuary, the Well House, the tower, the square, the verge and the shop.

- q5_mara_flat: passes. The grey window lights the ledger on the table and the bowl on the sill. Joss's chair sits in the window's shadow.
- q5_furrowe_kitchen: passes. The pendant pools warm on five laid places and the phone face up among them, with the fitted kitchen behind.
- q5_brack_kitchen: passes after a rebake. The hood light picks out the hob and the tiles, and the phone glows on the breakfast bar. The room around it stays dark on purpose.
- q5_channel: passes. The ring light and three screens make the coldest, brightest room in the era. The bought bookshelf reads as four coloured bands.
- q5_saro_flat: passable after a rebake. The net curtain and the lit phone on the low table read. The sodium lands on the right wall more than through the window.
- q5_mortuary: passable. The tile, the clock, the tubes and the two plastic chairs read. The sheet over the trolley reads as a pale oval more than as a body.
- q5_council: passes. The tall windows, the horseshoe of desks, the gallery rail and the benches read. The CCTV screen is darker than I wanted.
- q5_archive: passes, the best of the set. Steel shelving full of grey boxes, the reading lamp on the Tesk book's box and the open register.
- q5_well_house: passable after a rebake. The meshed windows, the scorched beam, the rugs and the plaque read. The mesh pattern does not throw squares of light on the floor.
- q5_police: passes. The checker lino, three office doors with glass panels, the bench and the cooler sit under a line of tubes.
- q5_syndicate: passes. The ring road model under its lamp and the three renders read. The glazing paints as a blank pale panel.
- q5_mill_street: passes. Sodium on the wet setts, flowers and candles on the paving, and the phone among them. The Saros' shutter and its sign are too dark to read at play size.
- q5_haldane_yard: passes after the daylight fix. The van in its striped livery with the lightbar lit, the tape, the barriers and the flats. The first light is flat.
- q5_square: passes after the car fix. Cars in bays under the sodium, the bench on the scale's base, the sheeted sheaf on its plinth. The sheaf reads as a drum more than a sheaf.
- q5_tower: weak. The tower and the mast with its dishes read. Two hatched vertical planes stand behind the tower and I have not found their cause. The stones and pegs are small.
- q5_ring_verge: weak. The tilted stone sits in the middle of the frame with three old stones behind the fence. The ground is murky and the road on its bank reads poorly.
- q5_shop: passes after a rebake. The lit bow window with the door table and its bowls, and HARTLEY ANTIQUES over it, on a dark hill street.

## Records carried in from the last two passes (2026-10-24)
- Era 3 (PROGRESS 205): its verdicts are the "Era 3 places" list above, and its pass 2 is the list under it. Nothing in
  entry 205 was missing here.
- The rebake of 6343a87: all 46 q3, q4 and q5 plates were baked again in a clean checkout of origin/dev, because the
  earlier rebake had run over half-edited sources. The commit records no new verdict. The pictures matched the sources
  as committed, so the verdicts above still describe them.

## Weak plates fix pass (2026-10-24)
Worked in a clean worktree of origin/dev. Every plate below was baked at full size and looked at; most were previewed at
half size first. Measures are in the table at the end. Squint is the share of the room brighter than the focal box after
a 14 px blur; the boxes are mine, drawn on each plate before measuring, and the same box is used before and after. Flat
is the largest connected patch of one surface kind with one normal (15 degree bins from the position buffer) as a share
of the frame.

### Three pipeline faults found on the way
- The hatched planes behind the tower were false hits. Outside a world's prop grid, `render/kit/world.mjs` returned
  max(distance to the grid's box, 0.02), and the tracer stops at 0.0008 + 0.0003 t, which passes 0.02 at 64 m. A
  street camera stands 70 m off, so rays stopped on the grid's empty faces and the ink drew them. The bound is now the
  box distance plus the margin the grid was grown by, or the height above the tallest prop. Any street plate on the
  prop grid could carry these planes; the tower and the verge did, and the harvest hill showed them too.
- Lamp pools went dark in rectangles. The soft shadow narrowed its penumbra on every step, including steps whose only
  candidate was a grid cell's edge. `render/sdf.mjs` now skips those steps (id 0). It showed as a dark block beside the
  verge's lamp column.
- Era 5's murk was one setting. Its paint language had contrast 0.82 about a 0.42 pivot, which set a floor near 0.076
  that no pixel could go under, and a blue tint of 0.7 that browned every colour. Era 5's look asks for a ground of
  #090603. `render/v2/language.mjs` era 5 is now contrast 1.08, tint 1.02, 0.96, 0.86, saturation 0.62, posterising
  0.35, and the far-plane scumble 0.2 where it was 0.45. All seventeen era 5 plates were rebaked. The darkest 2% went
  from L* 6 to 13 down to L* 5 to 8.

### Verdicts
- q5_tower: rebuilt. The tower has buttresses, string courses and empty bell openings, with the mast and its red light
  on top. The cable tray runs up from a fenced compound. The churchyard sits inside a rubble wall with a gate and has
  about forty stones of four kinds (some leaning), mounds, two yews and a gravel path to the door. Survey pegs are
  strung through the stones, orange crosses mark the stones to be moved, and a site fence carries the clearance notice.
  A lane runs round the wall with terraces across it. The gate lamp is the key, against an April dusk. Passes: squint
  5.1%, flat 7.6% (the lane, over the target).
- q5_ring_verge: rebuilt. The road sits on its bank with lines, kerb, barrier and marker posts. A footpath runs along
  the foot of the bank, past the moved railings with bouquets and a photo cable-tied to them. A council notice hangs on
  the rail, with six old stones and a yew stump behind it. The tilted stone has a lip of torn turf, daffodils in a jar
  and a tea light. A cone, cans, a bin and a drain cover lie in the grass. The key is a footpath lamp whose pool takes
  the stone and the path, with a thin moon for the cool side. Passes: squint 8.1% (was 32.1%), flat 12.5%.
- q5_haldane_yard: passes. The block of flats on the left (a slab with lit and dark panels) is gone, and a yard wall
  with three garage doors closes that side. The mud pits that painted as black holes are now shallow puddles in the
  cobbles. Flat rose to 11.2%: the cobbles are now one surface.
- Era 5, all seventeen: passes on contrast. Blacks reach the ground now (black share 0 to 41% by room, 0 to 3% before),
  and highlights hold. The night rooms (the Brack kitchen, the archive, the Furrowe kitchen) are much darker than
  before. One lamp lights each of them on purpose, so they read as dark and clear, where before they were murky. The
  squint target is still missed in eleven of the seventeen. That comes from the rooms' light plans (an even line of
  tubes in the police room, two tall windows in the council), which the next pass takes on.
- q3_well_fire: passes. Three ragged sheets of flame now cross the hole in the roof, leaning downwind, with jagged
  tops. The charred rafters cross in front of them. One flame kind is graded by height from a pale tungsten root
  through orange to a dim lick, so the ink draws no bands inside the fire. A smoke plume was tried and painted as a
  black post, so smoke is left to the shell. Red rule: no pixel has R / (R + G + B) of 0.8 or more (the fire's maximum
  is 0.71; WCAG 2.2's red state starts at 0.8). A flicker that scales the light keeps each colour's chromaticity, so the
  fire cannot make a red transition.
- q3w_far_bank: passes. The floor is worn boards, and the table has a cream top with a steel edge. Squint 22.0% (was
  27.7%).
- q1_tower and q3_square: the season switch reached the square world (`render/worlds/square.mjs`). Harvest and autumn
  lay setts with dark joints, each stone its own tone, with straw at harvest, and mud and leaves banked toward the
  fronts at autumn. The roofs carry moss or leaves. Winter is unchanged, so era 2 bakes as before. The open ground came
  down about 20 levels and warmed (q3_square from 106, 99, 93 to 83, 77, 70; q1_tower from 111, 93, 73 to 90, 71,
  50). Neither reads as snow now. q3_square still reads as a grey plaza under an overcast sky. Squint in both is a wide
  view's figure and says little.
- q1_hill (and q1_osby, on the same hill): passes. The bracken was green and rust patches 1 to 3 m across, each inked
  at its edge. It is now one kind of frond streaks, olive or russet, the share of russet rising across the slope, with
  clumps 0.1 m high. Flat 1.3% and 1.2%. The pale hilltop with its rock patches is unchanged and still reads blotchy.
  Light strokes show as pale flecks on the clump tops.
- q4_tower: passes on the camouflage. The wet winter cobbles painted noise-shaped puddles. The view now takes the
  autumn setts, evenly wet, with the sodium laid on them. The ground outside the square stays a flat field (flat
  35.4%).
- q4_mill_floor: passes. The four windows have iron glazing bars with some panes painted over, and the glass emits at
  0.45 (the dusk light behind is doubled to keep the floor lit). L* p98 went from 88.7 to 44.7, so nothing blows out.
- q4_police and q4_mill_office: pass. The tubes are brighter (police 12 and 2.2, office 10) and the gain is up. These
  two rooms take a neutral tube grade, because TUBE_GRADE's green shadow tint cast the whole room green. The walls keep
  their own green paint, and the office's internal window emits at 0.4. L* p50 went from 13.7 to 19.2 and from 14.0 to
  18.1. Squint got worse (41.6% and 34.7%): the walls brightened with the desk.
- q4_station: passes. Gain 2.2 and ambient 0.08, with the waiting room's window held at 0.45. L* p50 went from 22.0 to
  31.4 and the black share from 7.5% to 0.
- q3_mott_house: passes. The black blotches on the limewash were the washing's shadows, thrown up the walls by the bulb
  hanging under the line. The line now runs short in the corner by the stove, and the bulb is brighter (12) with a soft
  shadow. Squint 37.5% (was 29.9%): the clean walls now outshine the table.
- q3_ward: passes. The bulbs are 9 under the brownout, the fill is 0.5 and the gain 2.4. L* p50 went from 10.0 to 17.2
  and the black share from 38.6% to 12.4%. The beds, screens and chalk cross read.

### Measures (before to after)
Measured with a script outside the repository (L* from the plate png, hit pixels only; black share is L* under 6).

| Plate | L* p2 | L* p50 | L* p98 | Black share | Squint (target under 15%) | Flat patch (target under 5%) |
|---|---|---|---|---|---|---|
| q5_mara_flat | 12.8 to 8.1 | 21.8 to 19.6 | 82.1 to 96.7 | 0.0% to 0.0% | 31.5% to 29.2% | 10.4% to 10.4% |
| q5_furrowe_kitchen | 5.5 to 5.2 | 14.9 to 10.9 | 54.3 to 61.6 | 2.6% to 30.2% | 28.9% to 26.7% | 11.7% to 11.3% |
| q5_brack_kitchen | 6.2 to 5.7 | 9.1 to 6.2 | 72.0 to 88.5 | 0.0% to 40.6% | 18.1% to 17.3% | 9.0% to 8.9% |
| q5_channel | 6.4 to 5.9 | 15.9 to 12.7 | 70.1 to 82.1 | 0.1% to 12.7% | 14.3% to 19.1% | 14.1% to 14.1% |
| q5_saro_flat | 6.2 to 6.1 | 13.1 to 9.3 | 73.1 to 91.5 | 0.0% to 0.0% | 36.4% to 36.8% | 9.5% to 9.5% |
| q5_mortuary | 7.7 to 5.9 | 23.4 to 16.6 | 68.9 to 83.6 | 1.6% to 18.9% | 13.3% to 14.9% | 12.2% to 12.2% |
| q5_council | 11.6 to 7.6 | 20.1 to 16.7 | 81.1 to 93.7 | 0.0% to 0.0% | 60.4% to 60.4% | 7.5% to 7.5% |
| q5_archive | 10.1 to 5.2 | 14.1 to 9.7 | 53.7 to 58.0 | 0.0% to 32.3% | 12.6% to 12.4% | 4.3% to 4.7% |
| q5_well_house | 6.2 to 6.1 | 15.8 to 14.7 | 46.9 to 50.6 | 0.0% to 0.0% | 42.1% to 42.6% | 11.9% to 12.4% |
| q5_police | 12.3 to 5.9 | 21.2 to 20.7 | 55.8 to 69.3 | 0.0% to 12.4% | 49.1% to 47.8% | 11.4% to 11.5% |
| q5_syndicate | 12.7 to 7.6 | 22.9 to 21.2 | 82.5 to 97.9 | 0.0% to 0.0% | 36.5% to 36.9% | 11.6% to 11.5% |
| q5_mill_street | 6.9 to 4.8 | 22.2 to 16.2 | 53.3 to 66.2 | 0.8% to 18.2% | 43.6% to 43.2% | 17.5% to 17.8% |
| q5_square | 8.0 to 4.6 | 15.3 to 12.5 | 53.3 to 61.2 | 0.2% to 11.0% | 22.4% to 20.4% | 37.3% to 35.7% |
| q5_shop | 8.1 to 4.9 | 24.6 to 18.3 | 72.2 to 87.3 | 0.0% to 5.2% | 13.4% to 15.6% | 20.5% to 8.7% |
| q5_haldane_yard | 10.8 to 7.6 | 29.3 to 27.6 | 70.3 to 53.2 | 0.0% to 0.0% | 7.1% to 4.8% | 5.6% to 11.2% |
| q5_tower | 10.8 to 8.4 | 30.9 to 29.0 | 35.5 to 48.4 | 0.0% to 0.0% | 86.8% to 5.1% | 38.6% to 7.6% |
| q5_ring_verge | 9.0 to 6.7 | 31.3 to 16.9 | 47.0 to 46.6 | 0.0% to 1.9% | 32.1% to 8.1% | 13.6% to 12.5% |
| q3_well_fire | 2.7 to 2.7 | 17.9 to 17.4 | 73.5 to 77.7 | 22.4% to 22.5% | 6.3% to 6.3% | 11.2% to 10.1% |
| q3w_far_bank | 8.3 to 8.8 | 33.5 to 35.5 | 74.0 to 80.5 | 0.0% to 0.0% | 27.7% to 22.0% | 10.7% to 10.4% |
| q3_square | 5.1 to 3.5 | 27.5 to 21.2 | 48.4 to 38.0 | 8.3% to 20.5% | 41.2% to 40.7% | 23.7% to 23.8% |
| q3_mott_house | 5.8 to 5.8 | 16.2 to 17.7 | 64.8 to 71.2 | 5.9% to 5.6% | 29.9% to 37.5% | 7.4% to 7.5% |
| q3_ward | 4.6 to 5.3 | 10.0 to 17.2 | 51.6 to 67.9 | 38.6% to 12.4% | 45.8% to 46.4% | 3.2% to 3.2% |
| q1_tower | 4.2 to 3.3 | 37.7 to 29.4 | 50.2 to 40.5 | 7.1% to 11.0% | 65.9% to 64.3% | 31.6% to 35.0% |
| q1_hill | 8.5 to 9.4 | 35.0 to 20.5 | 70.8 to 69.3 | 0.1% to 0.1% | 58.4% to 42.8% | 2.0% to 1.3% |
| q1_osby | 6.5 to 6.7 | 53.8 to 55.0 | 61.9 to 65.8 | 1.3% to 1.2% | 82.7% to 82.0% | 4.5% to 1.2% |
| q4_tower | 4.8 to 4.1 | 16.0 to 19.5 | 40.0 to 39.8 | 13.6% to 23.2% | 39.9% to 51.5% | 31.5% to 35.4% |
| q4_mill_floor | 5.2 to 5.2 | 16.3 to 16.2 | 88.7 to 44.7 | 13.9% to 14.0% | 31.3% to 38.2% | 8.4% to 8.5% |
| q4_police | 5.3 to 5.9 | 13.7 to 19.2 | 49.8 to 70.2 | 16.1% to 9.4% | 36.8% to 41.6% | 5.9% to 5.9% |
| q4_mill_office | 5.8 to 6.0 | 14.0 to 18.1 | 86.7 to 76.4 | 5.6% to 1.8% | 26.5% to 34.7% | 9.8% to 9.9% |
| q4_station | 5.0 to 8.7 | 22.0 to 31.4 | 53.4 to 56.1 | 7.5% to 0.0% | 23.3% to 22.6% | 8.1% to 9.0% |

### Lock and what is left
Only these thirty plates' lock entries were replaced, and the other 86 keep their entries from origin/dev. No era 2
(`q_*`) entry changed. The source edits move the recorded recipe of nineteen plates that were not rebaked: q3_brack_kitchen,
q3_church, q3_furrowe_hall, q3_office, q3_school, q3_squad, q3_tower, q3_well_house, q4_board, q4_brack_flat,
q4_estate_stair, q4_exchange_street, q4_furrowe_house, q4_joss_flat, q4_mill_yard, q4_row, q4_sheaf, q4_well_floor and
q4w_saro_flat. Their pictures are unchanged, and their recipes are stale until they are rebaked. Thirty-two other
entries were already stale at origin/dev, era 2's among them. The recipe hash leaves out two kinds of file a bake reads:
`render/sdf.mjs` sits outside the pipeline hash, and a world's sibling imports (`render/worlds/_season.mjs`) sit outside
its source hash. A rebake of era 2 on this pipeline would differ from its lock wherever the world and tracer fixes
apply; none was rebaked here.

Open: squint in most era 5 rooms and in the era 4 tube rooms; the q1 hilltop's rock patches; the lane round the
churchyard over 5% flat; q3_square still grey.

## World layers: twenty rooms dressed with what each era leaves (world-layers lane, 2026-10-23)
Design: design/WORLD-LAYERS.md. Props: render/props/letters.mjs, plane.mjs, layers_wall.mjs, layers_things.mjs, laid over
each built world by render/props/dress.mjs from the lists in render/places/layers/era1..4.mjs, so no world builder changed.
Baked at 1920 x 1300 in a clean worktree, every variant looked at (contact sheets of all 24), relocked with
`plates.mjs lock --only` (the other 96 entries kept as they were). Era 5 waits for the plate lane.
- q1_census: passes. The rule sheet over the clerk's desk, the queue card, the portrait by the door, the cap and the jug on
  the bench all read. The rule sheet sits in shadow and reads as a dark panel in the morning variant.
- q1_board: passes. The board's photograph between the windows, the print by the high desk and the rules sheet read.
- q1_loft: passable. Ilo's spoons read on the barrel top. Ilo's blanket on the hay reads as a dark lump, nearly a figure,
  in the lamp variant.
- q_cells: weak, as before. Both variants are so dark that only the guard's paper reads; the goat and the turned cup are
  found by examine and its close look.
- q_returns: passable. The noon notice reads; the clean square over the left door is faint at play size.
- q_furrowe_kitchen: passable. The calendar and sampler read. The Gazette lies in the table's shadow. The red glow at the
  table's corner is there in the locked plate before this pass too.
- q_brack_kitchen: passable. The photograph and the sampler read; the boots and the damp line are lost in the dark.
- q_anni_room: passes. The thread on the nail, the photograph over the shelf and the cups on the table read.
- q3_mott_house: passes. The heights post, the children's boots and the photographs read.
- q3_office: passes. The two clean squares on the left wall read as two squares, the blotter and the calendar read.
- q3_squad: passes, the most changed room. The green locker, the mugs, the spade, the bucket and the boots all read.
- q3_furrowe_hall: passes. The pale oblong, Ned's photograph and the hat on the stand read.
- q3_brack_kitchen: passable. The newer plaster below the tide line reads as a paler band on the left wall; the band
  itself is thin.
- q3_school: passes. The alphabet frieze and the slates read.
- q3w_far_bank: passes. The long-service paper, the cap, the bag and the paper read.
- q4w_saro_flat: passes. The shelf of six glasses and the laundry bag read; the tin is small on the sideboard.
- q4_joss_flat: passes. The empty rack, the knitting basket and the paper read.
- q4_furrowe_house: passes. The hat in its bag on the high shelf, the calendar and the book read.
- q4_brack_flat: passes. The flood photograph and the brass-framed wedding read.
- q4_police: passes. The pale oblong, the lost-property box and the notice read.
Limits: small text (slips, the blotter, the desk lid) is texture at play size and is read through examine. The locker's
ring and the returned spoon are in the text only, so the plate is the same on every run.
## Lock gaps, era 2 against the ray fixes, era 5 light (2026-10-24, second pass)
Worked in a fresh worktree of origin/dev, with every bake's temporary files outside the repository.

### The recipe now covers what a bake reads
`render/tools/recipe.mjs` builds the recipe from two import closures: render/bake2.mjs (the pipeline) and the
place module (the source). It follows `from`, `import`, `import()` and `new URL(..., import.meta.url)` specifiers,
including a template's literal head (`dark_scene.mjs?place=...`). The pipeline also takes two files read as data:
content/quota/q_community.lwd (the light model's stocks) and render/tools/restreak.py. Each file is hashed with CRLF
read as LF. The lock records the source files with a hash each, the pipeline's hash with its file table under
`pipelines`, and the raw-native revision per plate. The old recipe left out render/sdf.mjs, render/grade.mjs,
render/rn.mjs, render/places/_q1.mjs to _q5.mjs, render/worlds/_season.mjs and _room.mjs, and the light model under
game/engine/light. It also hashed raw bytes, so the same source on a CRLF checkout gave another recipe.

`game/engine/paint/tests/recipe.test.mjs` bakes four tiny previews (q5_police, q1_tower, q_sheaf, brine; under a
second each) with a preload that records every module the main thread and the shade workers load and every file read
with readFileSync. It fails if a loaded file is outside the recipe, or if changing any loaded file in a copy leaves
the recipe unchanged. Checked against the old recipe's coverage, the same trace names render/sdf.mjs, render/grade.mjs,
render/rn.mjs and the helpers above. With q_community.lwd taken out of the data list, the test fails on that file.

A second fault turned up on the way. The stroke light's terms (`render/v2/lightterms.mjs`) read the place.json the
previous bake left in the output folder. A plate whose lights had changed therefore came out differently on its
first and second rebake, and a bake into an empty folder had no terms. bake2 now hands the terms the place.json it is
about to write. That is why q3_mott_house, q3_ward, q4_police and q4_mill_floor, rebaked at a07bd37 after their
lights moved, did not reproduce their locked bytes; the other 26 plates of a07bd37 did, byte for byte.

`plates.mjs lock` now keeps an entry, recipe and all, while its files are unchanged, so a lock run cannot make an old
picture look current; `--rebaked` names plates baked again whose bytes came out the same. `plates.mjs status` lists
recipes that no longer match, with the files that moved; `plates.mjs stale --only x --reason "..."` marks one on
purpose. `game/engine/paint/tests/plates.test.mjs` fails on an entry whose recipe has moved on unless it is marked.
`render/bake_check.sh` bakes plates into a folder, four at a time, and reports each file as same, differs, missing
or new against the lock; it takes `content` as the folder for a real rebake, with LW_TMP off the system drive.

### Rebuilding the lock
All 116 plates were baked into a scratch folder from committed sources (a07bd37 plus the pipeline changes above),
and each was compared with its locked picture (review sheets: design/art/work/pass-2026-10-24/, untracked).
- 26 came out the same, byte for byte: every era 5 plate, q1_hill, q1_osby, q1_tower, q3_square, q3_well_fire,
  q3w_far_bank, q4_mill_office, q4_station, q4_tower.
- 83 differed and were taken after a look. Most of the difference is brush noise from the light-terms fix and the
  soft shadow fix. Where a street camera stood on the prop grid, the rebake loses the hatched false-hit planes
  (q_post, q_hill, q_granary, q_furrowe_door, q_tilney, q_town, q_yard, q_square_wide_quiet, q1_post, q1_barns,
  q3_tower). Some reflect source edits made after their last bake: gut_day's and mole_day's palettes, crakehall's
  lit stair. Lock files that no current source makes were dropped with them: the dark-* lens layers of hall, hill,
  lamp and ropewalk, and the dark plates of hill, lamp and ropewalk, whose place.json has no dark plate.
- 7 keep their locked pictures and are marked stale with the reason in the lock: q_office (the soft shadow fix lets
  the window light the left wall past the table; squint on a table box 23.4% to 28.3%), q_square_wide (the night
  lamps and the day and dusk variants are gone from the source), quay (lamp reflections on the water lost), roof (the
  roof and the scale beam darker), stairs (the whole well lit and the top landing blown out), station (the floor lamp
  pools lost), wide_arrival (it comes out daylit with false-hit hatching at the top left; its source needs a look).
After the relighting below, the 44 plates whose sources include an edited file were baked again into content; the 28
of them not relit came out byte for byte as in the scratch bake. `plates verify`: all 116 match. `plates status`: 109
current, 7 stale and marked.

### Era 2 against the two ray fixes
Era 2 was meant to stay byte-identical, and no era 2 plate does: the scratch rebake differs on all 21. The ray fixes
are one cause. Two more are mixed in: the light-terms fix, and source edits since era 2 was locked (the earlier pass
found its pictures already differed from the lock on both sides of 157df50). The share of pixels more than 8 levels
out runs from 1.2% (q_cells, night) to 72% (q_road_home, almost all of it snow brush noise). Decision, per plate: 19
rebaked for real, because they look the same or better (the hatched planes gone from q_post, q_hill, q_granary,
q_furrowe_door, q_tilney, q_town, q_yard and q_square_wide_quiet; the window reaching the floor in q_sheaf).
q_office and q_square_wide got visibly worse and keep their old pictures, marked stale. A preview with the
pre-a07bd37 tracer and grid isolates q_office's cause: the soft shadow fix lights its left wall.

### Era 5 light: one aimed key per room
`render/props/light.mjs` makes a room's key a spot (the shader's mode 1, full on its axis and nothing past about 37
degrees) from its motivating fixture toward the focal area. Each room's other lights, and the camera-side fill, went
down to a third or less. Where a key aimed in through a window ran on up the back wall, it moved overhead under a
visible fixture: a pendant over the council's horseshoe and one over the syndicate's model. Glass panels stop the
shadow ray, so window keys sit inside the glass. Fixes found on the way: the council's CCTV screen light sat against
the wall and painted a hot circle, now 0.12; the q4 police room's morning mist glowed round its tubes, now 0.001; the
Mott house stove light is halved. Mill Street's focal box sat on a lamp head at the left edge; the flowers and the
phone are at 0.46 to 0.60 across and 0.54 to 0.70 down, where the key now lands (squint on that box 17.1% to 3.0%).
Haldane Yard's cobbles are broken by a flagged footway along the houses, three stone drain channels and a patch of
concrete. Squint uses the previous pass's boxes, at full size.

| Plate | Squint before | Squint after | Note |
|---|---|---|---|
| q5_furrowe_kitchen | 26.7% | 6.5% | pendant aimed on the table; the room much darker (black share 30% to 44%) |
| q5_brack_kitchen | 17.3% | 10.6% | hood light aimed on the hob |
| q5_channel | 19.1% | 14.3% | ring light aimed on the desk and chair |
| q5_saro_flat | 36.8% | 11.9% | the street sodium through the net, aimed on the low table |
| q5_mara_flat | 29.2% | 13.8% | the window aimed on the ledger |
| q5_council | 60.4% | 18.8% | the tall windows' glass holds most of the rest |
| q5_well_house | 42.6% | 15.2% | sodium through the left mesh window, aimed on the rugs |
| q5_police | 47.8% | 15.6% | the middle tube aimed on the bench; the door glass holds the rest |
| q5_syndicate | 36.9% | 18.0% | the glazing panel is most of the rest |
| q5_mill_street | 43.2% | 31.9% | old box; on the shrine's box 17.1% to 3.0% |
| q5_square | 20.4% | 11.5% | the corner post aimed on the sheaf |
| q5_shop | 15.6% | 9.8% | the street post weaker |
| q4_police | 41.6% | 18.3% | duty tube aimed on the counter; L* p50 19.2 to 13.3 |
| q4_mill_office | 34.7% | 14.6% | the tube aimed on the desk |
| q3_mott_house | 37.5% | 14.4% | the bulb aimed on the door table (15.3% before the layers lane's dressing came in) |
| q5_haldane_yard | flat 11.2% | flat 3.5% | squint 4.8% to 4.9% |

Era 5 now meets the 15% squint target in 12 of 17 rooms on the old boxes, 13 with Mill Street's corrected box. The
council, the syndicate, the police corridor and the Well House miss it by 0.2 to 3.8 points. The council's and the
syndicate's windows and the corridor's door glass paint from the `windowdim` kind, which every era shares, so they
were left. The q4 police room misses by 3.3 points. The rooms are darker overall; L* p50
fell in most of them.

### platecam
The reload added at a07bd37 is kept. Its decision is now a pure function, `plateAction` in ui/platecam.mjs, and
`game/engine/tests/platecam-plate.test.mjs` drives it through a real conditional `plate:` line. With the plate branch
removed, the first test fails.

### Merged with the world-layers lane (5b5a963)
That lane dressed twenty places and relocked them on the old pipeline while this pass ran. After the rebase,
`plates status` named exactly those twenty as stale (their place modules and the new render/places/layers/ and
render/props dressing files). They were baked again on the merged sources and the new pipeline, compared with this
pass's own bakes (the only differences are the added dressing), and relocked with `lock --only`. The Mott house and
the q4 police room keep this pass's light under the new dressing. The rebase also showed that a CRLF checkout of a
place.json failed verify; the lock now hashes .json files with CRLF read as LF.

Open: the seven stale plates; `windowdim` as a shared kind.
