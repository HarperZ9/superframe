<!-- writing-profile: research -->
# Six places with no painted scene: place data and staging for the plates

For the rendering lead, who bakes plates (render/places, render/worlds). Written 2026-10-21 from the Act 1 script, after the scripted runs (PROGRESS 104) found menus shown on a place card in these six places. Each section gives what the scenes need: the room, the things the script touches (marks.spots with the verb the game uses), exits, hides, the lights and their kinds, who stands where, the hours, and the camera. Coordinates are a suggestion in each plate's own world, metres, y up, in the style of `render/worlds/office_in.mjs`. When a plate exists I wire it in `game/engine/wiring/act1-areas.lwd` and move the marks to whatever the plate settles.

Menus shown per scripted run (Fist, Tongue, Shadow, Hands, Eye): ferry 4 each; hall 2, 3, 14, 2, 1; smokehouse 1, 4, 0, 0, 2; loft 0, 4, 0, 0, 3; roof 0, 0, 0, 3, 0; office 0, 0, 0, 0, 1. So the order to bake: ferry (every player sees it first), hall (Shadow lives there), smokehouse, loft, roof, office.

## 1. The ferry deck (`ferry`, zone ferry, footing wood)

16 nodes in quay.lwd (the prologue and its claims, Penhallow at the wheelhouse). 22:20 to 22:41, Low Night, the town ahead.

- **Room.** The after deck of a small coastal steamer, the Saint Cuthwin: about 9 m by 4 m of planking, a rail all round, the wheelhouse forward with a door that swings with the swell, a hatch down to the hold, the funnel behind the wheelhouse. Deck heels a few degrees (the scene heels it at 22:24).
- **Spots.**
  - `rail` (look): where the assessor sits with the claims case on both knees and looks for the lamp. Script: "The assessor sits by the rail" (Q:96).
  - `case` (read): the claims case; "Open the case and read the claim".
  - `wheelhouse_door` (read): the ship's clock through the swinging door, read against Lamb's watch (Q:297 to 313).
  - `hatch` (use): down to the hold and the crate of Hesk eggs (Q:220; Lamb may claim to have been "below, with the eggs").
  - `kit` (read): where Lamb lays out the instruments (Candlemas, the Glass, the Almanac, the Damp, the Vane); one spot is enough.
- **People.** Penhallow at the wheel, and at the rail after the near miss (Q:279). About forty souls are on board: a few seated figures under the rail forward, no faces needed.
- **Exits.** `gangway` to the quay berth (the act moves on to quay.lwd's berth scenes).
- **Lights.** Paraffin: the binnacle lamp in the wheelhouse (small, warm), a masthead light (reach about 6 m). No sodium on the deck. Ahead, three sodium dots on the quay and, at the end of the mole, Mother's dark head (a shape, no light). The place record gives light 0.12.
- **Hours.** One variant, night (22:20 to 22:41); the near miss is a camera and heel event, not a second plate.
- **Camera.** Exterior, closer than the quay (people read at deck scale): the office's 34 degrees yaw and 30 elevation, ppm about 150. The wide_arrival plate stays for the pull-back.

## 2. The Guild hall (`hall`, zone gut, footing wood, shelter)

43 nodes in gut.lwd: the vote by smell, the blindfold line, the two pans, Marrow at the head of the table, Spratt.

- **Room.** A long low hall: about 12 m by 5 m, a scrubbed table down the middle, benches both sides, a barrel on a trestle, a door to the lane at the foot. Over the table, two brass pans on chains from hooks; the brass words over the head of the table with AND NEVER FOR THE SEA scratched under them (gut.hall.apron).
- **Spots.**
  - `pans` (read, smell): the two pans turning on their hooks; pull them down; smell the two fish; Candlemas to them.
  - `head` (talk): Marrow's place at the head of the table.
  - `plate` (read): the brass plate and the scratched words under the apron.
  - `bench` (climb): a bench to stand on and tell the hall about Agnes Spratt.
  - `line` (wait): where the blindfolded line forms for the vote.
  - `back_door` (sneak): Shadwell's back door, for THE DARK route to watch from the smoke.
- **People.** Marrow at the head; Spratt by the door; at the vote forty aprons. A crowd is needed: about twelve standing figures along the benches, the rest implied by the room's far end in shadow.
- **Exits.** `lane` (the Gut), `smoke` (through Shadwell's back door).
- **Lights.** Paraffin: two hanging lamps over the table, a candle at the head. The hall goes dark for the vote (the lamps are put out): a blackout variant with one struck light (Lamb may strike a light in the middle of the hall). Place light 0.35.
- **Hours.** `early` (empty, before 00:40), `vote` (full, 00:40 to 01:30 and the second vote at the appointment), `dark` (the vote in darkness).
- **Camera.** Interior: as the office (yaw 34, elevation 30, ppm about 160 for the larger room).

## 3. Shadwell's smokehouse (`smokehouse`, zone gut, footing stone, shelter)

29 nodes: Shadwell reading the hour off soot, Marrow and the fish of the year at 03:30, the confessions.

- **Room.** Tall and narrow: about 5 m by 4 m, racks of herring on rods up into the dark (ten thousand, a texture, not geometry), a fire pit of oak chips that does not flame, a fire-door to the lane, a chimney.
- **Spots.**
  - `soot_board` (read): the whitewashed board by the door where Shadwell reads the hour (and soot on a wall, a flake of fish skin).
  - `fire_door` (wait): stand in the heat and dry out (gut.smoke.dry: "turning, as the herring do").
  - `fish_of_year` (smell): the fish of the year on its hook in the middle; under it a fish box where Marrow sits.
  - `box` (wait): the box for Lamb.
  - `sack` (use): the corner sack where Shadwell sleeps; curing salt.
- **People.** Shadwell at the board (or asleep on a sack in the corner at 03:30); Marrow on the box under the fish.
- **Exits.** `lane` by the fire-door; `hall` by the back door.
- **Lights.** The fire pit: a low red glow under the racks, light 0.4, no flame; nothing else. This is the warmest room in Act 1.
- **Hours.** `night` (Shadwell awake), `late` (03:30, Shadwell asleep, the fire low).

## 4. The Low Company's net loft (`loft`, zone gut, footing wood, shelter)

17 nodes: Lugg mending a net by feel, Merrow on a coil of rope, the sack with the green copper.

- **Room.** A low room under a roof, about 6 m by 3.5 m, rafters at head height (Lugg folded in three under the lowest beam), nets hung in grey swags from every rafter, a hatch in the floor with a ladder down to the lane.
- **Spots.**
  - `sack` (read, use): under the lowest swag of net, a sack with a loop of green copper at its neck; bury it under the nets.
  - `boards` (listen): ear to the boards (THE DARK).
  - `waders` (use): two pairs of waders standing in the corner.
  - `lugg` (talk) under the low beam, `merrow` (talk) on the coil of rope.
- **Exits.** `hatch` down the ladder to the lane.
- **Lights.** Very dark (0.15): one shuttered lantern or none; light from the hatch below. Lamb's own lantern matters here.
- **Hours.** One night variant; the loft is empty when Lugg and Merrow are elsewhere (gut.loft.empty).

## 5. The weigh-house roof (`roof`, zone quay, footing stone)

9 nodes: the climb, the town balance, the lantern on the beam, the frost.

- **Room.** Wet lead roof, about 6 m by 4 m, a low parapet, the drainpipe Lamb climbs. The town balance: an oak beam on a post as thick as a mast, iron pans the width of cartwheels tilted toward the harbour, a hook at the top of the beam where the town's weights hung.
- **Spots.** `drainpipe` (climb), `beam_hook` (use: hang the lantern), `pans` (read: the tilt), `parapet` (look: out along the mole to Mother).
- **People.** Hobb comes up with the weigh-house lamp and goes down without looking at it.
- **Exits.** `drainpipe` down to the weigh-house yard.
- **Lights.** Sodium from the quay below (0.8 sodium share), the lantern on the hook when hung (paraffin), Mother out on the mole when burning.
- **Hours.** `night`, and `frost` (after 04:10: the roof white, the beam frozen at its tilt).

## 6. The weigh-house office (`office`, zone weigh, footing wood, shelter)

20 nodes: the Board's office, the drawer, the works order, the specification, the blotter; Shadow's run in at the window.

- **Room.** A small office, about 4 m by 3.5 m: a desk with a green blotter, a chair with a drain hole over a tin basin, a drawer marked BOARD, WORKS, red ledger spines, a window onto the yard with the sodium's orange coming through, a rain-butt under it outside.
- **Spots.** `blotter` (read), `drawer` (use), `ledger` (read: the town balance ledger), `window` (read: by the window's orange), `desk` (use: the lantern on the desk, or low under it).
- **People.** Gorm and Hobb may come in (the Shadow run's loss: found by a lantern, then a second).
- **Exits.** `window` (the way Shadow comes in), `tube` (through to the tube room).
- **Lights.** Dark (0.08): sodium through the window (0.3 share); the lantern Lamb sets on the desk (warm, brown) or under it (a low pool).
- **Hours.** One night variant; the lantern is run-time light.

## What happens next

- The rendering lead bakes in the order above. For each plate, the marks named here go into its `marks` with these ids, so the area wiring can name them.
- I wire each into `act1-areas.lwd` as it lands (hotspots from the spots, the people on their marks with the script's presence conditions) and re-run the scripted runs with `--places` until no menu shows a place card.
