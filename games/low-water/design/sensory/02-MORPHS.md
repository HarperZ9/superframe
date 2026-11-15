<!-- writing-profile: research -->
# Sensory 2: morphs, crossovers and the style-state field

Part of [SENSORY.md](../SENSORY.md). How one look becomes another, in the world and over time, and the
engine feature that makes it possible without shimmer.

## 1. The kinds of morph

| Kind | What the player sees | Story use | Exists today |
|---|---|---|---|
| **Region blend** | Two looks side by side in one frame, joined by a soft seam that is fixed to the world | The era window (L8); the cells' dither light reaching out under the door into the painted corridor; the Well House's watercolour stopping at its threshold | Bake-time only (render/v2/erawindow.mjs:1-6) |
| **Object in two looks** | One prop drawn in two looks at once, split along a plane through the object | The Haldane bowl: era 2 Osby glaze on one half, era 4 red plastic halftone on the other, when the player examines it after the world record holds a later run (content/quota/q_props.lwd:19-31) | No |
| **Intrusion** | A patch of another look with no window or frame to explain it | Premonition (L7); a surreal break (03-SURREAL.md) | No |
| **Time morph** | The whole frame's parameters glide from one look to another | Falling asleep into the dream; the dream cue's one frame (game/engine/paint/dream.mjs:4-5) | Screen-space filters in the shell |
| **Era timelapse** | One wide plate per era with the same camera, cross-faded by depth band, far to near | Moving between eras at the bell tower | Proposed with the depth bands already built (design/state/perf.md:45-46) |
| **Ink-blot** | Ink spreads over the view and draws back on the new scene | The move between lenses and places, fainting | Built (game/engine/paint/inkblot.mjs:1-6; design/art/STYLE-PARITY.md:18) |
| **Threshold dissolve** | Each pixel switches when the fade passes its threshold | Blackouts and brownouts (era 3) | Built for plates (design/LOOK-UNIFIED.md:58-61) |
| **Paint to type** | Strokes give way to glyph cells where a screen or a document is | Era 5 phones and CCTV; the read-back's world dissolving into the record | Glyph exists as a whole-frame switch on F7 only (design/art/STYLE-PARITY.md:41) |

Rules for every morph:

1. **A morph has a cause the record can name.** A flag, a dream, a chapter, a prop state, a stock. No
   morph runs for spectacle.
2. **The paper UI never morphs** except into the read-back's typed document. The dream already keeps
   the UI sharp (game/engine/paint/dream.mjs:23).
3. **Fight telegraphs and ways out stay in the base look** inside a fight's bounds, so a morph never
   hides a tell (design/art/STYLE-PARITY.md lists them as both-style features; their readability is
   already measured).
4. **Seams belong to the world.** A seam that slides across a surface as the camera moves is a defect,
   and the bounds below fail it.
5. **Reduced motion.** With the setting on, spatial seams hold still, time morphs become a cut on the
   beat with the sound cue carrying it, and no advection or swirl runs (the setting promises "No fades or
   slides", game/engine/ui/settings.mjs:22).

## 2. The style-state field: what it is

A **style state** is one named set of stylised-pipeline parameters: paint (the `PaintParams` fields of
rn:raw/renderer/style_paint.hpp:18-25), palette and grade (in OKLab), dither (the `DitherPlan` fields of
rn:raw/renderer/style_ditherlight.hpp:26-38), and an amount for each discrete stage (halftone, mezzotint,
glyph, pen hatching) as those passes land.

The **style-state field** says, for every pixel, which states apply and how much. It is computed per
pixel from the G-buffer's world position, so it is fixed to the world by construction. Its inputs:

| Input | Authored in | Example |
|---|---|---|
| Global state with a time weight | The scene (a `cmd: look <id> <weight> <secs>` line, beside the existing `cmd: dream`) | The dream at 0.8 |
| World regions: box, sphere, or a plate's geo-buffer mask, with a soft edge in metres | `place.json` `styleRegions` | The cells' dither under the door, edge 0.4 m |
| Object overrides: an object or prop id, optionally split by a world plane | `@prop` `look:` field | The bowl's two halves |
| Story-driven weights | State-of-mind records reading stocks and meters | Hunger at 0.6 |

Priority, low to high: global, regions, story weights, objects. The field resolves to at most four
active states per tile (RGBA8 weights plus a four-entry index into the frame's preset table).

How each stage blends:

- **Continuous parameters** (radius, q, strokeLen, impasto, gloss, broken, lines, exposure,
  granulation, edge, dilution) interpolate in parameter space, with radius and strokeLen in log space.
  The Kuwahara loop already reads a radius per call; the field makes it per pixel. Sector count stays
  at 8 (rn:src/renderer/style_paint.cpp:78).
- **Palettes** interpolate in OKLab.
- **Discrete stages** (dither, halftone, glyph) run where their amount is above zero. Partial amount is
  a dissolve against a world-anchored blue-noise threshold, so coverage is stochastic but does not crawl.
  The noise comes from the engine's own void-and-cluster mask (P8, rn:docs/architecture/ROADMAP.md:239).
- **Tiles** of 16 x 16 pixels whose field is uniform take a fast path that runs one state only.

Why parameter space and not an output crossfade: a crossfade of two paintings shows two sets of edges
at once (double strokes, double ink lines) through the middle of the morph. A parameter morph paints one
painting whose brush changes. Check s5 below tests exactly this, with the crossfade as its control.

### In the game shell before raw-native ships

The shell cannot restyle a baked plate per pixel at run time. Its interim form: the plate's variants per
look are baked (as hour and weather variants are now, design/LOOK-UNIFIED.md:51-54), the field is
evaluated on the plate's geo buffer (half size, design/LOOK-UNIFIED.md:78-79) and selects between the
baked variants per pixel through the same world-anchored threshold; figures read the field at their feet
and set the figure painter's levels and dream terms from it. This is a selection between baked
paintings, so its middle states are dissolves, not parameter morphs. It is honest for region blends and
intrusions and weaker for slow time morphs.

## 3. Bounds, written before code

In the house style of raw-native's evidence (a `*-bounds.json` written "before any code and before any
run", each check with its bound, prediction and kill, ending with what it does not prove: for example
rn:evidence/p14-clouds-bounds.json:3 and rn:evidence/p5-world-strokes-bounds.json:4 [p5]). This
section is the content for the engine owner to commit as `evidence/p22-style-state-bounds.json` in
raw-native, dated on the day it is committed and before the pass is written. Proposed as P22 after P21,
which it generalises (P21 composites two styles through one mask, rn:docs/architecture/ROADMAP.md:253).

**Scene.** The owned analytic art scene and its orbit: radius 8.5, eye height 4.2, 1 degree a frame, 48
frames at 320 x 180, frames 9 to 47 scored (rn:raw/renderer/art_scene.hpp:28-31 [p5]; the P5 bounds use
the same, rn:evidence/p5-world-strokes-bounds.json:10 [p5]). States A = `oil`, B = `watercolour`
(rn:src/renderer/style_paint_canvas.cpp:46-52), and C = the `ink` dither-light preset for the discrete
case.

**The metric.** Temporal instability as defined in rn:evidence/rr-bounds.json:25: the mean over pixels
with valid history and over RGB of |(out_t - warp(out_t-1)) - (ref_t - warp(ref_t-1))|, warped by the
true motion vectors, with the unstylised lit frame as `ref` so the scene's own change is not counted. Code
on the P5 branch: rn:raw/renderer/art_metrics.hpp:14-30 and rn:src/renderer/art_metrics.cpp:20-33 [p5].
Statistics: paired bootstrap, 10,000 resamples, 95% interval (as P5).

| Check | What | Bound | Prediction | Kill |
|---|---|---|---|---|
| s1 identity | Field all A, then all B, then all C | Output equals the single-style `runPaint` (or the dither pass) exactly on the CPU reference; GPU within one 8-bit code of the CPU on every pixel (the display chain's standard, rn:docs/architecture/ROADMAP.md:86) | Holds exactly | Any differing pixel on the CPU |
| s2 seam on the orbit | A region seam (A inside, B outside, edge 0.5 m) across the plinth and wall | Instability in the seam band (pixels within the edge) at most 1.10 times the instability of the scene's own object-edge band | 1.02 to 1.06 | The interval's lower bound above 1.10 |
| s3 time morph, still camera | A to B over 48 frames | Each frame's mean change at most 1.5 times the even share (total A-to-B change / 47); 95% of pixels change in one direction only | Max ratio about 1.2; 98% monotonic | Any frame above 1.5, or monotonic share under 95% |
| s4 mid-state on the orbit | Weight held at 0.5 | Instability at most 1.25 times the larger of A's and B's on the same orbit | About 1.05 | Lower bound above 1.25 |
| s5 no double strokes | At weight 0.5, count XDoG line pixels | Inside the range spanned by A and B, plus 15% | Inside | Above it. **Control:** a 50/50 output crossfade must exceed A's and B's range by 30% or more; if the control does not fail, s5 is void |
| s6 screen-anchored control | The s2 seam fixed in screen space while the camera orbits | Must fail s2 by 2 times or more | Fails by 3 to 6 times | If it passes, the metric cannot see seams and s2 is void |
| s7 discrete dissolve | A to C with the world-anchored blue-noise threshold, on the orbit | Seam-band instability at most 1.25 times the scene edges | About 1.15 | Lower bound above 1.25. **Control:** the same dissolve with screen-anchored noise must fail |
| s8 tile fast path | Field uniform per tile vs per-pixel evaluation everywhere | Identical output | Identical | Any pixel differs. **Control:** one planted tile misclassification must be caught |
| s9 cost | RTX 4090, D3D12, 1920 x 1080, GPU timestamps (rn:evidence/gpu-timestamps-runs.json:6-11) | Two states over the full frame: at most 1.0 ms above the costlier single style. Uniform field: at most 0.15 ms above the single style. Four states: at most 2.0 ms | 0.6, 0.05, 1.3 ms | Any bound missed on the median of 50 repeats |
| s10 shell interim | Headless CPU Chrome, 1280 x 720, the RENDER-TARGET T11 conventions (design/RENDER-TARGET.md:37) | Field evaluation plus variant selection at most 2 ms a frame on a plate; figure painter stays at 4 ms or less a figure | 1.2 ms | Missed on the median |

**The CPU reference check.** The float64 reference resolves the field at every pixel with no tiling and
no fast path, builds that pixel's parameter set, and runs the same per-pixel kernel with it. The GPU pass
must agree within one 8-bit code (s1's standard) on the s2, s3 and s4 frames. A second control plants a
parameter interpolated in linear rather than log space on the GPU only; the parity check must catch it.

**Frame budget for the game.** The whole frame holds 16.7 ms on the wide square with its crowd on a
quiet machine (design/quota/07-PRODUCTION.md:30). The field's share is s9's bound.

**Does not prove.** That any morph looks good; that the surreal reads (03-SURREAL.md tests that); cost on
a mid-tier GPU; stability on skinned figures, which the art scene does not contain (figures carry their
own strokes, design/RENDER-TARGET.md:28, and need their own run).

## 4. Catalogue of planned morphs, with their causes

| Morph | Kind | Cause in the records | States |
|---|---|---|---|
| Falling asleep by the stove | Time | `cmd: dream 0.8` (content/quota/q_dreams.lwd:31) | Era 2 to dream over 6 s |
| The dream came true | One frame | `dream.due` matched, then `cmd dream cue` (design/state/gameplay.md:141-143) | Dream at 1.0 for one frame |
| The bowl in two eras | Object | Examining `q.haldane_bowls` when the world record holds a later run | Era 2 and era 4 halves |
| The cell under the door | Region | Entering the district office corridor | Era 2 oil, cells dither |
| The district meeting's yields | Region growing to global | Each chairman's record figure | Era 2 to mezzotint, 10% more of the room per false figure |
| The photograph cut | Object and memory | `q.haldane_five` state `cut` (design/quota/08-WORLD-MEDIA.md:192-193) | Present and era 1 inside the frame |
| The clip on every phone | Region | Era 5 screens | Era 5 paint, glyph |
| The record arriving | Global | The read-back opens | World to paper |
| Bet's chapter | Global, light | `perspective.start` | Era 2 shifted (L9) |
