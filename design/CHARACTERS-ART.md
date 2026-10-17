<!-- writing-profile: research -->
# Characters: art direction

Draft 1, 2026-10-17. Character art and animation lead. How the people of Gullet are designed,
built and moved. The how-to and the evidence live in `characters/` (PIPELINE.md, AUDIT.md,
PROGRESS.md); this page is the rule set a new character is made against.

## 1. One body, many people

Every person is the same 20-joint skeleton scaled by a proportions record (height, leg share, head,
neck, shoulders, hips, arm, stoop), dressed by a costume script from shared parts, coloured by a
palette, and moved by one shared clip library with an optional style layer. A new character is a
file of about fifty lines. Consistency comes from sharing the skeleton and the clips; character
comes from proportions, costume, palette and style.

## 2. Design rules

1. **Grotesque warmly** (look bible 2.6, 7). Heads 1.2 to 1.5 times natural; necks long; one
   exaggerated feature each: Lamb's coat and hat over a long neck, Fennick's neck, Marrow's girth.
2. **Value first.** Under sodium only value survives. Every design has one large pale mass against
   a dark one, placed where it reads from across the quay: Lamb's collar and stick, Fennick's
   surplice (the largest pale shape on the quay), Marrow's apron and the blindfold at his throat.
   Two people standing together must differ in value where they touch.
3. **A rim of the other light.** Each figure takes a thin rim from the lamps behind it, so
   overlapping silhouettes split along an edge (also the clean-room spec's proposal 2 in
   CHARACTER-PRESENTATION.md).
4. **Shadows lean violet, never grey.** Light is quantised into painted value steps; the shadow
   step leans violet; the ink is dark violet-brown, heavy on the silhouette, light on folds.
5. **Brushwork belongs to the body.** Strokes are anchored to the figure, not the screen, so a
   moving person does not shimmer. The screen-space painter is for still portraits only.
6. **Faces are sculpted, not drawn.** Brow, sockets, lids, cheekbones, nose, lips and jaw are one
   smooth surface; a character is a set of numbers on that face (nose length and hook, jaw, chin,
   lids, brows, jowls, stubble).
7. **Tools say who you are** (SYSTEMS-FULL 18.4). What a person carries is drawn on the grip axis
   of the right fist; two-handed tools put the left hand on the shaft every frame.

## 3. The three built to production standard

| | Lamb (the assessor, the player) | Ambrose Fennick (deacon) | Marrow Dunlin (Guild steward) |
|---|---|---|---|
| Proportions | 1.86 m, long arms, long neck, head 0.27 m | 1.99 m, narrow shoulders, neck 0.27 m, small bald head | 2.04 m, short legs, vast torso and belly, head 0.29 m |
| Silhouette | Wide-brimmed hat tilted back; slate greatcoat to mid-calf, split front with an oxblood lining; claims case on the left hip on a diagonal strap | White surplice to the knee with bell sleeves over black oilskins to the ankle; a black stole; a glass bell jar under the arm | Blue smock, white stained apron from chest to below the knee, sleeves rolled, wading boots to the knee |
| Pale mass | Collar and shirt front; the stick's brass | The surplice | The apron; the blindfold round the neck |
| Face | Long hooked nose, heavy lids, a long chin under the brim's shadow | Long fine nose with a hook, wide thin mouth, raised white brows, high cheekbones | Broad nose, heavy brow and lids, jowls, a dark beard shadow |
| Tools | The Vane's folding stick (light; the tin cockerel on its tip); the claims case (shield); the storm lantern (use) in the left hand, on the belt when that hand is busy | The filament crook (long, two-handed); sets the jar down to fight | A priest, the short weighted club for killing fish (bar); a gutting knife on the belt |
| Style over the shared clips | none (the reference body) | Upright and looking up in calm clips; the jar arm pinned | Wide planted stance, arms out, head down |

Every clip of the library plays on all three: 100 clips in all, listed in
`characters/PROGRESS.md`, with combat's names and numbers taken from
`game/engine/combat/out/timing.combat.json`.

## 4. What the rest of the cast needs

For each of the 38 speaking parts (PRODUCTION.md section 5), in this order of need:

1. A proportions record and a costume script from the parts library: half a day each for a new
   silhouette, an hour or two for a variation (the four Lamplighters share one costume and differ
   in proportions, palette and one prop).
2. The parts the cast list asks for that do not exist yet: Keel's peaked cap with buttons and his
   constant drip of water; Wenna's crop and oversized head; Sabine's bun with a fork through it;
   Merrow's rope coil and yellow oilskins; Constant Hobb's two lanterns; Sister Gauze's bell jar
   worn over the head; the Whelk twins as one costume, two palettes; Nan Cockle's age (stoop past
   20 degrees, a stick).
3. Done 2026-10-17: bodies for combat's two archetypes, `characters/cast/warden.mjs` (holder) and
   `characters/cast/salvor.mjs` (skirmisher), and their six clips (`characters/anim/specials.mjs`).
   Still to do: the Lamplighters as their own holder variant (brass pole, dark coat), and the named
   foes (Lugg, Keel in a fight, Conger) as variations of these two.
5. A portrait for each speaking part: the clean-room spec's pattern (small figure in the world,
   face in conversation) and its Low Water proposal (a pencil-and-wash sketch in the Daybook drawn
   in the light of that moment). The painted close-up path in `characters/proto/closeup_c.mjs` is
   the start of it.
6. Crowds (the Guild in the weigh-house, the floor children) as baked sprite groups from the same
   rig, with one live figure at the edge.

## 5. Known limits (first pass)

Up close the figures still lean toward stylised CG; the banded, brush-edged light and the painter
for portraits move them toward the plates. Coats swing on springs (not cloth simulation); feet
hold through ground speed measured from the planted foot (no IK foot lock on slopes or steps);
two hand shapes, open and fist, no finger animation; whole-body cross-fades only.
PIPELINE.md section 7 lists them with what would fix each.

## 6. The character forge (our own tooling, 2026-10-17)

Author, 2026-10-17 (verbatim): "We do not need blender, we will make and use our own assets and
tooling." The costume script (cast/parts.mjs) is good for a crowd; it is not enough for the detail
and distinctness the author asked for. The forge is the tool for individual characters, built in
our own code, whose output the runtime figures, the fight drawer and the portrait bake already read.

- **A character sheet** (`characters/sheets/<who>.json`): proportions, an optional costume-script
  body to start from (`base`), parts of it to drop (`drop`), and **regions**. A region is one
  sculpted surface bound to bones: signed-distance shapes (ellipsoid, capsule and round cone, rounded
  box, torus) combined by smooth union, carve and intersect; displacements on top (draping `folds`
  with a direction and a fade, `wrinkles` gathered at a point, `noise`, `pocks`); a material per
  shape; and **paint layers** stored per vertex (mottling `noise`, a `grad` wash such as wet to the
  thigh, `stripes`, `spots`, and `dirt` that settles where the folds go in).
- **The compiler** (`characters/forge/compile.mjs`): polygonises each region at its own cell size
  (faces and hands fine, coats coarse; three levels of detail), skins it automatically from the
  distance to its bones, and paints it. `forged(sheet, base)` returns a cast member like any other.
- **Mesh files** (`characters/forge/bake.mjs`, `meshio.mjs`): `.lwmesh` per level of detail, loaded
  by the browser and the portrait bake without re-sculpting. Keel's test sheet: 31k triangles far,
  87k mid, 219k near; 0.2 s to 1.6 s to sculpt on the CPU.
- **Review** (`characters/forge/review.mjs <who>`): the costume-script figure and the forged one side
  by side, turnaround and close-up (out/forge-<who>.png).
- **Runtime**: per-vertex paint flows through the rasteriser into the shading (it multiplies the
  material colour, under the brushwork and the light bands), so painted detail survives every light.

Test only: `sheets/keel.json` replaces Keel's head (a tall egg, sunken cheeks, grey sideburns,
heavy lids, broken veins) and his greatcoat skirt (draped folds, wet darkening at the hem, a split
front). It is a format test, not a style decision; the art direction is open, and new bodies wait
for it.

Still to build: a hand region kit (knuckles, nails, fingers posed per hand shape), cloth that
follows the coat springs (a forged skirt is skinned to the skirt joints, which works but was not
tuned), paint stamped from 2D images in bind space (a pattern, a badge), and a browser editor that
shows a sheet updating as it is edited.
