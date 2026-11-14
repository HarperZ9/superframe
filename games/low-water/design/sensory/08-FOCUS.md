<!-- writing-profile: research -->
# Sensory 8: focus, the lens and light as storytelling

Part of [SENSORY.md](../SENSORY.md). Proposal, 2026-10-22, for the author, the writers, the plate lead and
the effects lead. The author's direction, verbatim, 2026-10-22: "Like a living world being observed", and
later the same day: "Sounds great, depth and baked normals, as well as lighting that is dynamic with the
tilt-shift. Also, utilizing deoth of field and camera effects in a way to better highlight in focus areas,
and aid in storytelling are huge. Visual effects as storytelling elements are fantastic."

The engine side is built and measured in raw-native PR #211 (P23, the tilt-shift lens):
- a lens whose plane of focus is tilted in the world, so the sharp wedge follows a street and the walls
  that cross it;
- defocus painted as coarser paint, with the ink fading out of focus;
- a focus director that racks by intent;
- an optional lens and print effect stack under the 05-CARE limits.

This page says how the game uses it: the tags writers put in scenes, what the plates must export, how
light joins in, and how the browser renderer gets it.

## 1. The camera is an observer

The camera watches a living miniature town. The world goes on outside focus: background figures, smoke,
washing and birds keep moving in the soft areas. When nothing happens, the observer's attention wanders a
little to something alive (a dog, a lit window, washing on a line) and comes back. A door slam, a runner or
a cart pulls its focus. Talk and fights lock it: neither drift nor events may take focus from a speaker or
a fight. raw-native checks this over a scripted 90 s timeline: 0 of 2,280 locked frames fail, and a control
without the locks fails on 916.

Each look gives the observer a character:

| Look | Observer | Lens behaviour |
|---|---|---|
| L0 daily | A patient naturalist | Slow racks (about 0.5 s), idle drift after 6 s, dwell 3.5 s, then back |
| Town map | A model maker over the table | Strong miniature (1:40), the plane along the street, no drift |
| The record, the Accuser | A cold inventory | Deep focus (stopped down) or a fixed scan order through every person in view, fast racks, no return to the player between items |
| L6 dream | A frightened child | Narrow depth of field, short dwell, a slow capped jitter (at most 0.02 dioptres a frame, 0.4 Hz), the plane tilted wrong |
| L8 memory | An old photograph | Print look, gate weave, a soft edge |

Reduced motion turns every focus change into a cut and stops drift, event pulls, jitter, gate weave and
grain movement.

## 2. Focus as storytelling: scene tags (proposal)

A new node statement `focus:` beside `camera:` (game/engine/dialogue/parse.mjs). Each value maps to one
director intent or parameter. The writer names people and props by their ids in the scene.

| Device | What it says | Tag | Director behaviour | Care |
|---|---|---|---|---|
| The reveal pull | The thing a speaker lies about | `focus: rack Fennick > jar` | Rack from the speaker to the prop over the character's rack time, hold 2 s, rack back. The line plays during the hold | A cut under reduced motion |
| Tension narrows | The room closes in | `focus: tension 0.6` (0 to 1) | The wedge narrows: the f-number opens and the miniature strength rises with tension, on the spring. At 1 only the speaker's face is sharp | The speaker is always sharp (the lock holds) |
| Sliding off | A person dying, or one the scene ignores | `focus: slide-off Keel` | The plane drifts off that person over 3 s and does not come back while the node runs; their ink fades with the defocus | Never during the player's own choice text |
| Cold deep focus | The record, the Accuser, a form being filled | `focus: deep` | Stop down until everything in view is sharp; ink at full weight everywhere; no drift | None |
| Breathing lens | Dread | `focus: breathe` | A slow focus breath (about 0.25 Hz, at most 0.02 dioptres a frame) and a 1% field-of-view breath | Off under reduced motion; under the flash rule's 0.5 Hz limit |
| The held frame | Memory, era 1 | `focus: memory` | The memory look: print, gate weave, one thing moving | Weave off under reduced motion |
| The observer looks away | The world goes on | `focus: wander` (the default in walk) | Idle drift and event pulls as in section 1 | Never in talk or a fight |
| Hands off | A scene that must not move | `focus: hold` | Freeze the current focus | None |

The lock rule is not a tag; it always holds. No tag can take focus from a speaker mid-line or from a fight.
`slide-off` on the current speaker is refused with a warning at load.

## 3. Plate G-buffer: what the bake exports (spec for the plate lead)

Measured from render/bake2.mjs on 2026-10-22, the bake already computes these and keeps most in render/.tmp:

| Buffer | Today | Size and format | Proposal |
|---|---|---|---|
| World position | Exported, `geo-pos.f32` | Half size (geoScale 0.5), 3 f32 a sample | Keep. It is the depth source: the browser lens takes each sample's distance from place.json's camera |
| Material id | Exported, `geo-id.u8` | Full size, u8 | Keep |
| Depth | `render/.tmp/<place>/depth.f32`, not exported | Full size, f32 | Export as `geo-depth.f16` (full size, half floats, view distance in metres) for sharp CoC edges at full resolution |
| Normals | `render/.tmp/<place>/nrm.f32`, not exported | Full size, 3 f32 | Export as `geo-nrm.oct16` (full size, octahedral, two snorm8 a pixel), world space |
| Paint id | `render/.tmp/<place>/pid.u8`, not exported | Full size, u8 | Export as `geo-pid.u8` for per-object relighting and focus targets |

The change is additive: three more writes beside the existing `geo-id.u8` write in bake2.mjs, for the first
variant only, since geometry does not change between variants. place.json gains a `gbuffer` list naming
what was written. The plates' colour images do not change, so content/PLATES.lock does not move. Cost: about
2.1 MB a 1080p place for depth and normals, plus 2 MB for the paint id. The plate lead owns render/; this is
a request, not an edit.

## 4. Light that moves with the lens (proposal and bounds)

With baked normals, moving lights relight the painted plate in the browser: a carried lantern, a struck
match, a door opening onto a lit room, a fire. The light model (game/engine/light) already does this from
normals it derives from `geo-pos.f32`. Those normals are NaN at edges and noisy on thin parts, and baked
normals replace them. The tilt-shift joins the light in one way: the in-focus region takes a subtle key-light
lift, so the eye goes where the lens points.

Bounds, to be written as the effects lead's bounds file before code:
- **Key lift:** at most +6% luminance inside the wedge, on the rack spring, never a step. It counts as
  luminance change for the 05-CARE flash checker, which must stay at 0 added flashes over a rack.
- **Temporal stability:** a lantern carried across a plate at walking pace changes no sample's light by
  more than 4% between frames (beyond the light's own flicker). The relit plate's warp instability is no
  worse than the unlit plate under the same camera pan.
- **Frame budget in the browser** (Chrome, the RTX 4090 through ANGLE, 1920 x 1080, measured with
  `EXT_disjoint_timer_query_webgl2`):
  - relighting at most 1.5 ms a frame with four moving lights;
  - the tilt-shift at most 1.5 ms a frame while focus moves, and 0 ms when it is still, because the plate's
    defocused image is cached;
  - on the 60 Hz frame time, no more than 1 frame in 200 over 16.7 ms with both on.

## 5. The browser port (game/engine/fx)

- **`fx/focus.mjs`:** the focus director in JavaScript, a line-for-line port of raw-native's
  focus_director.cpp, tested in node against the same d1 to d5 checks.
- **`fx/lens.mjs`:** the CoC of every geo sample against the tilted plane. From it, a WebGL2 painted defocus
  of the plate canvas: a sector Kuwahara whose radius follows the CoC, at half resolution, recomputed only
  while focus moves. The first version runs the Kuwahara on sRGB colour, not on pigment latents, which
  differs from raw-native. That gap is recorded and is the next step.
- **Figures:** a figure takes the CoC at its own feet and head. Out of focus, its painter steps down a
  stroke level, so it is painted coarser rather than blurred.

Verified in a real browser with the quota-shell tool. Stills of walk, talk, examine, fight and dream go into
`game/capture/focus-2026-10-22/`.

## 6. Status, 2026-10-22

Built, behind a flag (`?tilt=daily`, or localStorage `lw.tilt`; off by default):
- `fx/focus.mjs`, the lens geometry and director, with `fx/tests/focus.test.mjs` (d1 to d5 and the tension wedge, 7 pass);
- `fx/tiltshift.mjs`, the WebGL2 plate lens over the view, fed by `geo-pos.f32` and wired to walk, talk, examine, fight
  and dream from the game's own state;
- `fx/tools/tiltshot.mjs`, the stills.

Seen in the browser (game/capture/focus-2026-10-22, headless SwiftShader): the daily look is right but subtle. Away from
the plane the plinth and ground soften while Lamb and the walls stay crisp, and each intent moves the target (the
stats file shows speaker, prop, fight and the dream look). The dream look is wrong: its strong isotropic Kuwahara
swaps the snowy roofs for the wall paint across edges, which reads as a glitch. A first run doubled the houses
because the CoC cap was in plate pixels at zoom 2.66; it is now a screen size.

Not yet built:
- the structure tensor (anisotropy);
- pigment-latent mixing;
- figures painted coarser out of focus;
- the `focus:` tag in the parser;
- the key-light lift and the baked-normal relighting;
- GPU timing on the RTX 4090 (`EXT_disjoint_timer_query_webgl2` is read when present; headless SwiftShader has none).

The default stays off until the dream look is fixed.
