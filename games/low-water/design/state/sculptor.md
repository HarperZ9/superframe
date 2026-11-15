# The sculptor (character heads): notes

Owner: the character-art engineer. Others' news is read from their own files in design/state/.

## 2026-10-21: open eyes and the eight moods on the old head (The Quota)

**What changed.** The Quota's cast (characters/cast/quota.mjs, quota2.mjs) now opts in to three head
options in characters/cast/parts.mjs. Low Water's 36 heads use none of them and stay hash-identical
(checked after every change: neutral and the wary, startled and set presets on lamb, keel, sabine, gorm).

- `lidRange: true`. Neutral is open with the iris showing. `face.lids` is now the character's
  heaviness, 0 open to 1 heavy, and stops short of closing; expressions can still close the eye.
- `exprGain: 1.8`. The expression's brow, inner brow, lids, jaw, mouth width and mouth corners are
  multiplied, so the eight moods read at portrait size. On this path brows follow the forehead back as
  they rise, the inner ends move twice as far and the outer ends drop when they pinch, a smile lifts
  the cheeks and the lower lid, and a grieving mouth pushes the lower lip up.
- `X.corners` reaches the old head: the mouth line's ends lift or drop.
- The eyes are no longer buried. Three causes, all fixed on the lidRange path only: the eye was built
  before the skull's later skin, a wider or deeper skull put its front over the iris, and the cheek's
  colour claim (sdfmesh gives a point the material of the nearest primitive, less its bias) painted
  big cheeks over the eyes. Children, Will, Gedge, Pask and Mary had skin-coloured eyes before this.
- Ned: a longer, less round cranium (`skull: [0.9, 1.06, 0.94]`, `faceLen 1.12`) and a firm mouth
  (`lips 0.78`, `mouthCut 1.35`, a deeper line). Will: lids 0.55, no stubble (it hid the mouth),
  brow thickness 1.1, skull a little taller so the cap clears the brows.

**For the rendering lead (portrait moods), action needed in game/engine/paint/portrait/moods.mjs.**
`exprFor`'s old-head branch should pass `corners: q.corners` through, and for a lie (`dir.lie`) pass
`held: true` with the corners of the warm cue at intensity 3 times 0.8 (`portraitCue({ ...dir, int: 3,
lie: false }).corners * 0.8`). Without `held`, Quota portraits show a lie as a weak warm smile with the
eyes joining in. Reference: `exprOld` and `lie` in characters/proto/mood_sheet.mjs. The mapping is copied into characters/proto/mood_sheet.mjs until
moods.mjs lands on dev.

**For the Studio.** Sitters from The Quota now open their eyes at neutral; rebake references.

**The sheet.** game/capture/quota-heads-2026-10-21/quota-moods-ned-will.png: Ned and Will, eight moods
(neutral, warm, anxious, angry, grieving, afraid, contempt, lying), portrait camera, paraffin light.
Run: `PORTRAIT_CAST=quota node proto/mood_sheet.mjs <out.png> ned,will` from characters/, under the
heavy-cpu lock.

## Change log for parts.mjs (re-bake after each)

- 2026-10-21 23:50: lidRange, exprGain, X.corners, eye built last with the skull and cheek yielding
  their colour claim (lidRange heads only); Low Water hashes unchanged. Quota references need a re-bake.
- 2026-10-22 00:30: the eye white claims its carve (WHITE_CLAIM), skull yield 0.02 (lidRange heads only); the eyes showed as dark sockets. Low Water hashes unchanged. Quota re-bake.
- 2026-10-22: sheet saved (quota-moods-ned-will.png). Known: a dark spot beside the nose under the near eye; Will's range smaller under the cap; lying close to warm.
- 2026-10-22 01:00: opt-in noseBend, noseFlat, jawCorners, cheekbones; X.held (a lie: no cheek or lower-lid lift, lids narrow); iris claim cut (the dark spot under the eye was iris colour leaking). Will rebuilt; flat cap takes hatLift. Low Water hashes unchanged. Not yet stable: sheet pending.
- 2026-10-22 01:40: iris claim 0.009 (smaller leak); mood sheet holds the lie's smile at 0.8 of warm. Low Water hashes unchanged.
- 2026-10-22 02:20: **head stable** at de54c5d (parts.mjs, quota.mjs as of that commit). The Studio can re-run Ned's and Will's portraits. Sheet: game/capture/quota-heads-2026-10-21/quota-moods-ned-will.png. Rendering lead: pass held: true and the warm cue's corners for a lie (see proto/mood_sheet.mjs exprOld).
- 2026-10-22 02:50: Ned's hat line is now a thin, low-contrast tan line (material hatline 60 and the hatLine tube in quota.mjs), not a pale band. Head geometry and expressions unchanged. **Head stable** at this commit; from here the heads are the Studio's reference.
- 2026-10-22: **head UNSTABLE**: rebuilding The Quota's cast on people presets (Tarn, Hesh, Vell, mixed) and class markers, per the author's direction of 2026-10-22. Studio: wait for the next "head stable" line. Low Water's heads untouched.
- 2026-10-22: people presets (cast/peoples.mjs: Tarn, Hesh, Vell ranges; classes) and the slice cast rebuilt on them; new opt-in head options hunger, scar, teeth, gaps, bridge, hairTex; materials 61-67 (hands, teeth, scar, patch, goodwool, embroid, vellscarf). Still UNSTABLE: sheets not yet looked at. Low Water hashes unchanged.

## 2026-10-22: the sculpted head (The Quota)

**head UNSTABLE until the line below says stable.** The Quota's cast now builds on `cast/sculpt.mjs` (the old
head stays in `cast/parts.mjs` for Low Water and as the control, `SCULPT.on = false`). Same face records,
same expression object (`setExpression`), same `make()` call site; the head is built from planes as signed
distance shapes and meshed by the forge's narrow-band mesher (`forge/mesher.mjs`).

- Structure: cranium with flat side planes and temple planes, brow ridge over carved orbits, outer orbital
  rim, cheekbones and arches, muzzle, ramus, jaw angle and body, masseter, chin, nose (bridge box, tip,
  wings, columella, nostrils), philtrum, lips with corners, the fold over the chin, ears on the side plane,
  the neck and sternomastoids into the skull.
- Eyes: eyeball, iris and pupil meshed exactly in rings about the gaze (round at any size), a cornea with a
  wet highlight (material `iris` 68, `wet` in `render/shade.mjs` light()), lids as shells with an almond
  aperture. A lie (`X.held`) narrows the lids, drops the cheek lift and turns the gaze aside and down.
- Surface: no cheek or jawcool material on this head. One skin, the painter's three zones as a vertex tint,
  lips a step off the skin (`sculptPalette`), an iris colour by people. Ned's hat line and Will's scar are
  painted into the vertex colour. Hair and headscarves grow off the skin above a hairline.
- Props that sat on the old face moved: Ned's and the Captain's moustaches are a face option, Aaron's ears
  are `earOut`, Pask's spectacles sit on the new eyes, the scarf is sculpted (the hat blob stays for the old head).
- Bounds, controls, results: characters/notes/HEAD-BOUNDS.md. Captures: game/capture/sculpt-2026-10-22/.

**For the Studio and the rendering lead.** Quota references need a re-bake once the head is stable. The
portrait moods mapping (`exprOld` in proto/mood_sheet.mjs) drives this head unchanged.
- 2026-10-22 16:20: **head stable** (the commit that adds this line). Painted and glyph portraits rebaked.
  Known and open: sockets and under-cheek planes too dark in banded light, the cast too alike in
  silhouette, children's lower faces in shadow. Resume list: characters/notes/FIDELITY.md.
