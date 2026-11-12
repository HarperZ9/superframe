<!-- writing-profile: procedure -->
# Act 3: joins between districts (director, 2026-10-17)

Read this with `design/ACT3-WRITER-BRIEF.md`. It settles questions writers have raised and names
the flags each district must set or read. Declared ids are in `content/act3/facts3.lwd`.

## B1, the gale lamps: three moments act-wide

ACT3-PLAN meant **three moments for the whole act**, one per rain band (21:20, 22:40, 03:30), not
one per lamp per band (that would be up to nine scenes, the chore loop the editor warned about).

- A district's lamp moment plays only if that band's shared flag is unset, and sets it:
  `b1.band1` (the 21:20 band), `b1.band2` (22:40), `b1.band3` (03:30). Replace any district-local
  band flags with these.
- So in each band Lamb tends **one** chosen lamp, the one in the district Lamb is in, and the other
  chosen lamps are kept by their own people, or not.
- A chosen lamp that goes out sets `lampout.<lamp>` (steps, porthole, gut, balance, hill, bulb,
  mother). A lamp nobody tended in any band and not shuttered goes out at the 03:30 band: write that
  as one line in your district at 03:30 if your lamp was chosen and never tended (`!has(<your
  district>.tended)`), and set its `lampout.` flag.
- At 04:30 the world sets `gale.lamps_held` if no chosen lamp went out; dawn3's epilogue reads the
  `lampout.` flags lamp by lamp.

## The storm shutter

`i.storm_shutter` is supplied by **quay3** from Keel's store, beside the oil can (`quay3.oil`).

## Who sets what

| Flag or var | Set by | Read by |
|---|---|---|
| `quay3.boat`, `quay3.stowed`, `quay3.coffin_sail` | quay3 | oldlight (how Lamb arrived; the sneak opening; the way home) |
| `collier.through` / `collier.spit` (by 04:00) | mole3 | quay3, hill3, dawn3 |
| `loss3.mother`, `loss3.lamp`, `wreckers.real`, `mole3.crown_fitted`, `mole3.bulb_fitted` | mole3 | dawn3 |
| `gasholder3.crown_up`, `gasholder3.bulb_up` | gasholder3 | mole3 |
| `hester.seen_typing`, `hester.told`, `pip.told`, `e.matched`, `letter.kept_open`, `ropewalk3.offered` | ropewalk3 | dawn3, gut3, hill3 |
| `crake.drafts` | ropewalk3 or hill3 | dawn3, gut3 |
| `weigh3.sent` | weigh3 | ropewalk3 (the tube message landing) |
| `gut3.salt_sent`, `gut3_guild`, `gut3_comes`, `gut3.noll_fell` | gut3 | brine3 (the last vote and the surge; Mab's line if Noll fell) |
| `oldlight.lanterns`, `lowroom.soot`, `damp.dry` | oldlight | dawn3 |
| `vote.keeper_paid`, `surge.held` | brine3 | dawn3 |
| `wenna.asked` | day2 | mole3, dawn3 |
