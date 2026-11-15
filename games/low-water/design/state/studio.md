# The Studio (art tools): notes

Owner: the art-tools engineer. Others' news is read from their own files in design/state/.

## 2026-10-21: second round

**What changed.** The Studio (tools/studio/, `node tools/studio/serve.mjs`, port 8810) now has the
author's combination of stroke light and paint, liquify and transform, and the painter comforts. How to
use it, with the pen-tablet checks for the author: tools/studio/README.md.

- **Stroke light and paint.** The scripted paint-over is targeted: eyes, mouth, brows and nose, the shadow
  side's one shape, the cloth's folds and a few edges of ground. The light side keeps the underpainting's
  strokes under a warm glaze. A light-stroke brush (preset "light stroke") loads with the canvas colour
  lifted toward the key, the way the painter lays its lights. A blend per region (face light side, face
  shadow side, hair and hat, clothes, ground, eyes and mouth) sets how much paint shows over the
  underpainting. Ned's script share of the figure: see the report and the manifest (`authorship`).
- **Rebuild exactness is a gate.** The 18/255 mood drift came from a stale composite (a filled layer
  added, the next wet stroke picking up the old picture). Fixed; tests/rebuild.test.mjs fails the old
  behaviour. `bin/build.mjs` rebuilds every source from its record; `--check` fails above 1/255.
- **Facing.** The sitter turns three-quarters right through the camera (`cam.turn`, default -32); the key
  comes from the same side (az 39), so it falls on the face. No mirroring anywhere.
- **Liquify and transform** reshape every layer, the underpainting included, are undoable, replay
  exactly, and are flagged when a painting is carried to another age or era.

**Rendering lead (design/state/painted.md).** The Studio now uses your `paintPortrait({ G, A, face, seed,
opts })` and your `MOODS` and `exprFor`. It still makes its own G-buffer for one reason: `sit()` ties the
sitter's facing to the camera (facing = yaw - 32, three-quarters left), and the talk panel wants
three-quarters right without a mirror. A `turn` option in `sit()` (facing = yaw - turn) would let me
delete my adapter. The export follows your three changes: 640 x 800, eyes at 40 percent, and each entry
records `heads` and the eyes' and mouth's positions from your `.info`.

**UI lead.** `characters/portraits-painted/index.json` is ready to be read first, as the coordinator asked.

**Results, 2026-10-21 late.** Ned (three columns: underpainting, the first full paint-over, the new
combination): script share of the figure 86.1 percent full, 9.5 percent targeted (glazed 23.7 percent).
Will Brack, neutral and angry, era 2, with the liquify pass: script 6.7 percent. Rebuild gate: Ned
rebuilt from its text source matched its export at 0/255 (twice); Will with script, mood and liquify
rebuilds exactly in one process (0.0/255). Across processes the gate reported Will (and once Ned) as
"reference changed, not drift": characters/cast/parts.mjs was edited (uncommitted) at 22:16, 23:39 and
23:45 while the runs were going, and the sitter's fingerprint (meta.refHash) caught it.
**For whoever edits characters/cast/parts.mjs:** a painted portrait is tied to the head it was painted
on. When the head changes, `node tools/studio/bin/build.mjs --check` names it; the painting can be carried
to the new head with "Carry paint here" (the log replays through the form, changed regions flagged).
**Note:** `.git/info/exclude` on this machine lists `characters/portraits-painted/`. The coordinator's
ruling keeps the sources, index and manifest in git, so new sources are added with `git add -f`.

## 2026-10-22: the coordinator's answers, done

- **A changed head is a rebuild.** When a sitter's fingerprint differs from the one it was painted on,
  loading or `bin/build.mjs` re-bakes the reference and replays the strokes on it (even if cached layer
  images exist). Strokes that now land on another material (checked at their first, middle and last
  point) are flagged: their places in the log go in the source's `meta.unplaced`, and the area is shown in
  amber. `--check` fails only for a painting whose head did not change.
- **Key from the scene, per portrait.** "Key from scene" in the Sitter panel takes the place (x, y, z and
  the sitter's facing there) and asks the light lead's `drawerRig(at, cam)` (game/engine/light/adapters.mjs,
  still on feat/light) for the key, keeping its angle and side to the face. With no light model running
  (the Studio alone) the portrait keeps its own key and says so. The chosen place is kept in `meta.lightFrom`.
- **Liquify reach.** A "Reach" option (radius up to 480 px, a broad falloff) moves a whole mass; Will's
  scripted pass now uses it on the skull or cap, the jaw's corners, the chin and the mouth.
- **Ned's mouth** is now lips: a bowed upper lip a half-step darker, a thin line tapering into the
  corners, a lighter lower lip with one light catch toward the key, and the shadow under it.

**Rendering lead:** the `turn` option in `sit()` (facing = yaw - turn): the coordinator agreed it; when it
lands I delete the Studio's own G-buffer pass. One more: the painter's `paintMouth` leaves a small dark
square at each mouth corner on Ned (visible in the underpainting at 768 x 960, about 8 px); the Studio
paints over the mouth but not that far out.

## 2026-10-22, later: the form override and Will's nose

- **Form override.** "+ Form" adds a form layer: the brush lays planes on it (Plane yaw and pitch, from the
  face's own forward), it never shows in the picture, and the light-stroke brush over it loads its colour
  from those planes lit by the portrait's key (or the scene's), not from the sculpt's normals. The
  "Form light" view shows the planes lit. A scripted pass (script/planes.mjs) blocks a head's planes
  (forehead, brow shelf, sockets, cheek front and side past the cheekbone, muzzle, jaw side and underside,
  nose bridge, side and base) and lays light on the planes that face the key and one soft shadow statement
  on those that turn away.
- **The default key moved off the camera.** It sat almost on the camera's axis, which lights a face flat,
  one reason the early proofs read as balls. It now sits 46 degrees round toward the side the sitter faces,
  25 up (short light: the front lit, the broad cheek turning into shadow).
- **Will's nose** stays broken (its shape kept) and comes down in size (two pinches toward its tip).
- **Will's proof** (game/capture/studio-2026-10-21/will-proof.png): script share of the figure 18.4 percent
  (glazed 7.9). The sculptor's 01:00 change (jaw corners, cheekbones, a bent nose) landed during the run,
  so the gate re-baked Will with 4 strokes flagged; per the coordinator's ruling for Ned, Ned's and Will's
  final exports wait for the sculptor's "stable" note, then both are re-run clean.

## 2026-10-22, later still: the mosaic fixed

The form pass now covers each plane: the shadow side as one mass in a few tall strokes, a base coat on
every other plane (broad strokes on the broad planes, small ones only at the nose, sockets and brow), a
soft scumble across soft plane edges (hard only at the brow shelf and the side of the nose), light
strokes on top, and a fill of anything still open. The check (`formCoverage`, core/form.mjs): Will's
underpainting shows through 0.03 percent of the form-painted face (limit 5). Script share 25.0 percent.
Still to improve: the shadow side shows vertical stroke stripes, and the planes read a little flat
beside the underpainting's own modelling. Final exports wait for the hat-line commit, then a clean run.

## 2026-10-22: Ned and Will released

Re-run against the stable head 399990d after the mosaic fix. `bin/build.mjs --check` rebuilt both from
their text sources alone: Ned neutral, Will neutral and Will angry each match their exports at 0/255,
on an unchanged head, with no strokes flagged. Exports: characters/portraits-painted/ (index.json,
manifest.json; images are built by the release step). Script share of the figure: Ned 20.3 percent
(targeted, no form pass), Will 25.0 percent (with the form pass; underpainting showing through the
planes 0.03 percent).
**UI lead:** the painted index is ready to be read first, as agreed.

## 2026-10-22, afternoon: lit-side modelling, shadow strokes, the corner squares; peoples; any game

- **Lit side.** The form pass is now two layers: "form light" (the planes that face the key, as value and
  colour at 45 percent opacity, so the underpainting's own stroke light shows through) and "form shadow"
  (the shadow side as one mass, full strength). The mosaic check reads each coat's own cover, so partial
  opacity is a choice, not a hole: Will 0.05 percent open (limit 5).
- **Shadow side.** One tone over the mass, large overlapping strokes along each plane's run with the angle
  turned a little each time (down the cheek, along the jaw): no stacked verticals.
- **For the painter: the underpainting's stray darks.** The portrait painter (paintPortrait) leaves small
  solid dark squares on the skin at both mouth corners and beside the nose, on Ned and Will (and likely the
  rest of the cast). The Studio now covers them on a "cleanup" layer just above the underpainting (one soft
  stroke of the skin round each; Ned had 10, Will 5): hide or erase any one there. Rendering lead: the cause
  is in the underpainting (paintMouth and the eyes' pass, as far as I can tell); the Studio only masks it.
- **Peoples' palettes.** A game's config can name its peoples; a sitter's skin light, skin shadow and hair
  lean toward their people's by a small share (18 percent for The Quota: Tarn, Hesh, Vell, from the world
  bible), never set, so the render leads and the people is a temperature. Their three swatches join the
  sitter's palette. A sitter of two peoples takes half of each.
- **Any game (the author's standing rule on reusable tools).** The Studio now reads one game config
  (tools/studio/games/<name>.mjs): its cast loader, materials, head construction, portrait light and
  defaults, export root and default era, and peoples. The Quota and Low Water are both there; `?game=lowwater`
  in the browser or `--game lowwater` on the command line opens the Gullet's cast (checked: Lamb sits and
  paints). The renderer is still this repo's character rig (characters/); a different engine would need a
  sitter adapter, which is the next extraction.
- **For the tools architect.** design/state notes asked me to answer your questions, but
  notes/2026-10-22-tools-platform/PLAN.md does not exist yet. What the Studio can give a
  platform: core/ (layers, brushes, history, stroke log and replay, liquify and transform, masks by rule,
  export and the rebuild gate) has no game in it; games/<name>.mjs is the seam; the sitter
  (core/sitter.mjs, core/anchors.mjs) and the portrait painter call are the engine-specific part.
- **For the sculptor.** With your uncommitted changes in the working tree (characters/rig/materials.mjs and
  the people presets), Aaron's reference fails in characters/render/shade.mjs light() (a material with no
  entry, `.emit` of undefined). Probably mid-change; the Studio waits for your "head stable" before the batch.
