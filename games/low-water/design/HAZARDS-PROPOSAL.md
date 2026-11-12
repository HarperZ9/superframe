<!-- writing-profile: research -->
# Nets, ropes and loose ground: a proposal for the director

Combat engineer, 2026-10-17. For the director, who authors these. Asked by the coordinator after the
world-combat work (design/COMBAT-WORLD.md). Nothing here is in any place.json yet: you decide what
goes in, and the record shape is the one agreed with the systems engineer:

```
"terrain": { "hazards": [ { "id", "kind": "net" | "rope" | "slick" | "loose", "at": [x, y, z], "r": metres }
                         or { "id", "kind", "rect": [x0, z0, x1, z1] } ] }
```

## What each kind does in a fight

| Kind | Effect | Who it catches |
|---|---|---|
| net | speed x0.7; trips (a short stagger) a body crossing it at over 2 m/s with its motion more than 110 degrees from where it looks | someone backing away fast with their eyes on an opponent; a body facing its way steps over |
| rope | speed x0.75; trips like a net | as for a net |
| slick | grip x0.6 (slower to start, stop and turn; slides further when hit) | everyone on it |
| loose | a roll on it runs 0.8 as far | anyone rolling |

The shell's walking will slow over nets and ropes too (systems engineer, via combat's terrainAt), so
the town and the fight agree on the ground. No hazard does damage; a trip opens the body to a blow.

## Proposed placements

Positions are plate world metres (x east, z toward the camera), checked on walkable cells
(game/engine/combat/tools/hazards.mjs --check). The notes are suggestions; the words are yours.

**Lamp Quay** (quay plate; e.wardens, e.lamplighters, quay2.wardens)
- `quay_nets`, net, at [19.6, 0, -6.0], r 1.2: drift nets hung to dry over the crates by the mole root,
  a heap of them on the stones.
- `quay_warp`, rope, rect [22.0, -2.2, 25.5, -1.7]: the ferry's mooring warp laid along the quay edge to
  the bollard at the mole steps.

**The Spit** (spit plate; e.strippers)
- `spit_painter`, rope, rect [12.6, 4.2, 16.2, 4.8]: the strippers' painter between the barges, slack on
  the shingle until the flood takes it up. This is the line the `strippers_painter` spot already cuts.
- `spit_coal`, loose, at [18.6, 0, 5.6], r 1.3: coal spilled from the Ann Tull's open hatches.
- `spit_patience`, slick, at [10.0, 0, 3.4], r 1.4: frost on the Patience's tilted deck boards (the spot
  note already says so).

**The Ropewalk** (ropewalk plate; ropewalk.e.door, ropewalk.e.door4)
- `ropewalk_strand`, rope, rect [6.5, 2.7, 18.5, 3.1]: a strand laid out down the walk between the old
  rope posts, waiting to be twisted.
- `ropewalk_coil`, net, at [10.4, 0, 1.2], r 0.8: a coil of telegraph wire under the post where the Vane
  hangs.

## Measured (before you author them)

Each plate's fights with and without the proposals, five styles, 4 seeds; kiting is the strongest
kiter per style (world-runs/hazards.txt). Won, mean seconds, mean share of Standing lost, trips.

| Plate | Fair, bare | Fair, with | Kite, bare | Kite, with |
|---|---|---|---|---|
| Quay (60 fights) | 55, 12.1 s, 0.41 | 55, 12.0 s, 0.41, no trips | 16, 74.4 s, 0.63 | 15, 74.5 s, 0.64, Lamb tripped 2 |
| Spit (20) | 5, 21.8 s, 0.92 | 5, 24.1 s, 0.90 | 6, 40.3 s, 0.90 | 7, 41.3 s, 0.84, opponents tripped 6 |
| Ropewalk (40) | 39, 10.2 s, 0.28 | 39, 11.6 s, 0.31, Lamb tripped 2 | 18, 45.5 s, 0.50 | 19, 48.4 s, 0.56, Lamb tripped 12 |

Reading it:
- The Ropewalk strand is the one that works: it lies along the line a kiter backs down, so the kiter
  trips 12 times in 40 fights and loses more Standing, while fair play trips twice.
- The quay pieces sit off the line the quay fights take; they are set dressing as placed. If you want
  them to bite, a net or warp between the fight mark (16.1, -2.9) and the mole steps would.
- On the Spit the skirmishers' backward scuttle trips over the painter (6 times), which helps Lamb a
  little. That is the rule working both ways.
- The first rule tripped anyone running or rolling across a net. It helped kiters: chasers ran over the
  ropes (37 opponent trips on the Ropewalk against 18 for the kiter). The rule now trips only a body
  moving fast with its eyes behind it.

Does not prove: 20 to 60 fights per row, and these are scripted players. Small differences (one or two
wins) are noise.
