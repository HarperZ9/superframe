<!-- writing-profile: research -->
# Characters: audit

2026-10-16. How the people of Low Water are drawn today, what the raw-native engine offers a
character pipeline, and what is missing. Read from the prototype (`game/`), the playthrough and
trailer stills, the Low Water worktree of raw-native (`native/`,
branch `feat/low-water-host`) and raw-native `origin/main` at `abe2c93`.

## 1. How characters are drawn now

**Code path.** `game/main.mjs` collects the player and the room's NPCs each frame, sorts them by
depth and calls `drawPerson()` from `game/figures.mjs` (97 lines). Each person is a record in
`PEOPLE` (height, head, neck, stoop, girth, part values and true colours, a hat kind, one prop
flag). `drawPerson()` draws into a scratch Canvas 2D:

- a ground-shadow ellipse;
- two stroked lines for legs, swinging with `sin(8t)` when walking;
- one closed quadratic path for the coat, filled with one flat tone;
- a pale surplice or apron clipped inside the coat path;
- a rectangle of shade on the side away from the light;
- one stroked arc for the arm and an ellipse for the hand;
- a line for the neck, an ellipse for the head, an ellipse for the nose, a dot for the eye;
- a hat from six hand-drawn shapes; props as small shapes (lantern glow, rope ring, bell jar).

It then hides pixels the plate's world buffer puts in front, and adds the lantern glow.

**Facing.** One profile, mirrored by `face = ±1`. There is no front, back or three-quarter view,
so a figure walking toward or away from the camera is the same side view sliding.

**Light.** One scalar `light` (summed inverse-square sodium from the three quay lamps) and a
`side` sign. Under sodium every part goes through one value-to-orange ramp; indoors parts take
their true colour times `light`. The shade rectangle is the only modelling.

**Scale.** The quay camera (yaw 36, elevation 26, distance 72 m, fovY 0.37) gives about 27 pixels
a metre at the player's spot, so a 1.8 m person is about 48 px; the code draws at 1.2 times
(`px = 1.2 * (fy - hy) / h`), which makes Lamb about 60 to 70 px. In the Brine (fovY 0.23,
44 m) and the weigh-house (fovY 0.16, 60 m) a person is 130 to 135 px at true scale; the stills
show Lamb at about 190 to 250 px because of the same 1.2 factor and the closer room grids.

**Animation.** Exactly two states: standing and walking. Walking is a 0.04 bob, a ±0.12 leg swing
and a hand drift, all from one `sin(8t)`. There is no turn, no start or stop, no talk gesture, no
examine, nothing for combat. Every character walks with the same cycle at the same rate.

**What the stills show** (`game/capture/playthrough/q02, q05, q10, q16`; trailer60):

- On the quay (q02, q05) figures are 60 to 70 px orange silhouettes. Lamb and Keel by the steps
  read as two small dark shapes; Keel and Fennick near the lamp merge into one blob with one pale
  patch. Fennick's surplice is a small pale wedge, not the large white mass the bible gives him.
- Indoors (q10, q16) the figures are large, flat and graphic: a single-tone coat, a ball head with
  an ellipse nose, a dot eye, no hands to speak of. Against plates that are painted with thousands
  of directional strokes and impasto, the figures read as paper dolls from another game. This is
  the author's "cartoonish next to the painted plates".
- The baked crowd in the weigh-house plate is dark blocks behind the drawn people (Phase 3 note).

**Verdict.** The author's critique holds on every count: detail (a dozen primitives a figure),
consistency (one hand-tuned path per prop, two animation states, one side view), and fit (flat
fills beside painted plates). Nothing in the current path can carry a combat move set: there is no
skeleton, no clip, no timing, no facing beyond left and right.

## 2. What raw-native offers a character pipeline

Checked by reading source on 2026-10-16 (worktree and `origin/main` `abe2c93`).

| Capability | Present? | Where | Notes |
|---|---|---|---|
| Skinned meshes (bone weights, joint matrices) | **No** | none | No `JOINTS_0`, `WEIGHTS_0`, skin or joint-matrix code anywhere in `src/`, `raw/` or `web/` |
| Skeletal animation (clips, sampling, blending) | **No** | none | No animation channels, no clip sampler |
| glTF import | Partial | `src/assets/gltf.cpp`, `raw/assets/gltf.hpp` | C++ only. Reads the node tree and triangle primitives' POSITION, NORMAL, indices. No skins, no animations, no morph targets; sparse accessors refused |
| Scene hierarchy with node transforms | Yes | `web/world/scene.mjs` (runtime G0, ADR 0014) | Node kinds group, mesh, sprite, tilemap, camera, light; world transforms compose. A rigid-part puppet could live here; skinning could not |
| Sprites | Yes | `web/motion/renderer.mjs` (sprite add/over passes), `scene.mjs` kind `sprite` | The Motion renderer draws sprites through WebGPU; the Low Water prototype does not use it (it draws in Canvas 2D) |
| Billboards | No dedicated path | | Sprites face the screen; there is no camera-facing quad with depth |
| CPU software rasterizer | Yes, C++ | `src/renderer/swr_*.cpp` | A textured triangle rasterizer for the C++ host; not reachable from the browser prototype |
| Paint-over projection | Yes | `web/shaders/paintover/` (camera, painter, projector, grade) | `painter.mjs` is the Hertzmann-style stroke painter that painted the plates. Works on any image with an id and normal buffer, so it can paint a character G-buffer |
| Palette-locked lighting | Yes | `web/shaders/palettelight/` | Per-pixel: needs a G-buffer (albedo index, normal, irradiance split). A character G-buffer can be fed through it |
| Dither-quantised lighting | Yes | `web/shaders/ditherlight/` | Per-pixel, screen-anchored Bayer. Same: a character G-buffer can go through it, so a figure dithers with the same matrix as the blackout plate |
| Spectral sodium shading | Yes | `web/shaders/sodium/` | Needs spectral materials and the sodium plan; the prototype approximates it with a value ramp |
| Caricature warp | Yes | `web/shaders/caricature/` | A salience warp made "for the grotesque register": swells heads and lamps by a salience buffer. A candidate for a later pass over figures |
| Outlines and toon ramps | Yes, C++ | `src/renderer/outline.cpp` | CPU G-buffer outlines; the web side has none |

**Missing for any pipeline that animates 3D characters:** skinning (CPU or GPU), a skeleton and
clip sampler, and a way to draw a skinned mesh in the browser host. glTF skins and animations are
not imported. Everything a character needs after rasterisation (painter, palette and dither
lighting, the sodium ramp, the caricature warp) exists and takes a G-buffer.

## 3. What this audit implies

1. The figures have to be rebuilt from a skeleton, not retouched. A cutout cannot turn, dodge or
   swing, and its detail cannot rise without each prop becoming more hand code.
2. The engine's strength is its per-pixel style passes, and all of them take a G-buffer. A
   character pipeline that produces a G-buffer (id, normal, position, depth) for each figure gets
   the painter, the dither and palette lighting and the sodium ramp for free, which is how figures
   come to "sit inside the painted, sodium-lit world".
3. Skinning and clip sampling are the engine gap. The pipeline decision (PIPELINE.md) says where
   they live first and what the engine PR adds.
4. Scale is part of the problem and not only art: at 48 px true size on the quay a person cannot
   carry detail or combat legibility, whatever the pipeline. PIPELINE.md section 5 gives the camera
   recommendation for the director and the systems engineer.
