<!-- writing-profile: research -->
# Glyph: an alternative rendering pipeline

Rendering lead, 2026-10-21. Author, verbatim, 2026-10-21: "The ASCII rendering should be much
more extensive, layered, and fleshed out. This is essentially a shader overlay." Then, the same day: "It
should not be a post-process shader either, it should be a full alternative rendering pipeline." So
Glyph renders the game from the scene, as Oil and Ink does, and shares only the scene, the simulation
and the camera. Neither renderer reads the other's output.

## 1. The interface

```
renderer.renderFrame(scene, camera, lights, ui)
```

- `scene`: the place (place.json, its geo buffers: a world point and a surface kind for every plate
  sample, at half the plate's size), the variant and hour, the terms (rain, fog, tide, wind), the
  figures with their posed skeletons (world joints, the held tool, the cast's proportions and palette)
  and the fighters in a fight, the darkness (blackout fade).
- `camera`: the plate's bake camera (orthographic, yaw, elevation) and the view on it (left, top, zoom).
- `lights`: the place's lights for the variant, the carried lantern, the moon or sun for the hour.
- `ui`: the panels open on screen (their boxes and text) and the hints.

Two implementations: `oilInk` (the existing layer stack: plate, painter, light, weather, people,
fights; its layers still run their own frame loops, so for now its renderFrame only shows them) and
`glyph` (this document). The play screen holds one renderer at a time and switches on F7. The
simulation (walking, talking, combat, animation clocks) runs the same under both: the figure drawers
are driven in either mode, and in Glyph mode they record the posed skeleton instead of rasterising.

## 2. The pipeline

Each frame, in order. Cells are cw x ch screen pixels (8 x 12 at 1080p's base zoom), numbered from the
plate's corner, so a cell is a patch of the world, not of the screen.

1. **Scene to cells** (per plate, variant and zoom; cached). For each cell, from the geo samples that
   fall in it: coverage by surface kind (the two largest), the nearest depth along the camera's
   forward, the surface normal (from neighbouring world points), height, and the cell's world point.
   A minority kind (10 to 45 percent of the cell) whose samples lie along a line (eigenvalue ratio 3
   or more) is a thin feature: a pole, a rail, a rope; it gets a line glyph along its projected
   direction, over the cell's main glyph. Emitting kinds (sodium, window, flame, lantern, stovefire,
   candle, arc) are light sources in cells.
2. **Materials** (`materials.mjs`). Every surface kind maps to a glyph language: a density ramp, its
   edge glyphs, a motif tied to world coordinates (brick courses, plank grain, cobble, water ripple,
   roof slates), a foreground colour (the kind's own colour, lit) and a background rule, and an
   emissive rule. Water, stone, brick, wood, metal, cloth, rope, glass, mud, sand, weed, slate and skin
   each have their own.
3. **Lighting** (per cell, from the scene's lights, never from the painting). Ambient by hour (moon
   blue at night, warm sky by day) weighted by the normal; each lamp `I (1 - d/r)^2 max(0, n.l)`;
   shadows by marching from the cell's world point toward the light through the cells' depth buffer
   (a point is shadowed when a surface nearer the camera stands where the march projects). Static
   lamps and the moon are baked per plate and variant; the carried lantern is lit per frame within its
   reach, with the same shadow test. Light sets a glyph's density and weight as well as its colour.
4. **Effects**: emissive glyphs with glyph-shaped bloom and a warmer halation round them; rain as
   glyph particles falling in world space, hidden behind nearer cells; wet ground mirroring lamps and
   figures as dimmed mirrored glyphs; fog thinning glyphs with depth; an optional phosphor stage
   (scanlines, an RGB triad) at the end.
5. **Figures** (`figures.mjs`): from the posed skeleton each figure is drawn as capsules (torso, head,
   arms, legs, coat skirt) into the cell grid; inner cells take the cloth's dense glyphs, edge cells
   line glyphs along the bone, the head cell a face glyph chosen by facing, the hat and the held tool
   their own glyphs. The glyphs follow the bones, so a figure never swims. Animation and combat
   timing are the shared simulation's.
6. **UI** (`ui.mjs`): every open panel drawn natively in the grid: a box-drawing frame on its box and
   its text set in cells at each line's place; the DOM panels stay in place for input but are not
   shown. An F7 hint and a preset panel (green, amber, full colour, ink on paper; layer switches).
7. **Raster**: each cell's glyph from an atlas ordered by measured ink coverage; only cells whose
   glyph, colour or background changed are drawn again, after shifting the last frame with the pan.

Hysteresis: a cell keeps last frame's glyph level until its value leaves that level's band by a
margin, so a value near a threshold never flickers.

## 3. GPU path

The CPU path comes first and is the reference. The GPU path keeps the same split: the per-plate cell
tables become textures; lighting, figure capsules, particles and the raster become one WebGL2
fragment pass at cell resolution (state, with the hysteresis ping-pong) and one at screen resolution
(the atlas lookup and the effects). raw-native's WebGPU host is the longer route (its hysteresis and
CRT passes are the same ideas in WGSL); the game has no WebGPU device today. GPU time is measured with
EXT_disjoint_timer_query_webgl2 once the GPU lock is free (training has priority).

## 4. Measures

- Flicker: ground cells whose glyph changes between frames while the camera pans (world-tied cells)
  and on a still camera, against a screen-tied control.
- Figure findability: each figure's mask region against its surround (Michelson of mean values),
  against Oil and Ink's on the same views.
- Frame time per scene, CPU, and GPU when the lock allows.

## 5. What this does not do yet

- Thin features come from what the plate's samples show; a rail thinner than a sample is not seen.
- Shadows are traced through the camera's depth (2.5D): a surface hidden from the camera cannot cast.
- UI text is set in the grid's cells at each line's place; rich styling (italics, small caps) maps
  to colour only.
