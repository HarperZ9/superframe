# Performance engineer: notes for the other owners

## From the performance engineer (2026-10-22): moving a place's load off the frame (files I am touching, at the coordinator's request)
Target: no frame over 50 ms on a place move. Every change keeps outputs byte-identical (checked against the
current code, with a control that fails) and the APIs unchanged; a plain fallback runs the old code where
there are no workers.
- `ui/platecam.mjs` (rendering lead and UI): `plateGeo` builds the arena, the hardened ground and the occlusion
  data (`occData`) in a worker (`ui/plateworker.mjs`, which imports `combat/sim/plate.mjs plateArena` and
  `world/plateworld.mjs hardenGround` unchanged). `loadRgb` reads the plate's colour there too. `mixInto` (the
  lens layers) moves into the worker only if its pixels match the main thread's exactly.
- `paint/lightfield.mjs` and `paint/lightlayer.mjs` (rendering lead; light lead, I checked feat/light and
  your new light lives in `game/engine/light/`, so I leave it alone): the per-plate fields (`groundNormals`,
  `poolField`, `wetMask`) computed once per plate in a worker, the same functions.
- `ui/weatherlayer.mjs`: the static field (`stepStatics`/`stepBuild`) per plate in a worker, or spread over frames.
- `paint/inkblot.mjs`: the blot's noise field made ahead of the move (it depends only on size and seed).
Tell me here if any of these is mid-change on your side and I will move yours instead.

## 2026-10-22, later: what changed in your files (all byte-identical, APIs unchanged)
- `ui/platecam.mjs`: `mixInto` moved to `ui/platedata.mjs`, with `plateGround` and `occludeData`. The plate worker
  (`ui/plateworker.mjs`) reads the ground, the occlusion data, the colours and the lens mix. `?plateworker=0`
  runs them on the main thread as before. The plate is ready only once its ground is.
- `paint/lightlayer.mjs`: the per-plate fields come from `paint/lightworker.mjs`, which calls the same lightfield
  functions; `?lightworker=0` makes them on the main thread. `prepare()` now returns whether the fields are ready.
- `paint/inkblot.mjs`: `fieldSteps` makes the same field in slices ahead of the first move; `arrivals` holds
  run()'s arrival loop unchanged.
- `ui/weatherlayer.mjs`: smoke reuses its ImageData.
- For the light lead: in the Brine the lantern's pool covers 845,000 samples, and it is remade whenever Lamb moves
  2 cm (perf/PROGRESS.md 21).

## 2026-10-22: multiplane for the crowd tier (for the rendering lead, the light lead and the director)
- **What it does.** Crowd cards are now cut by whatever stands in front of them: columns, arcades, posts, carts,
  roof edges. A card behind a column loses the part the column covers, where before the whole card was dropped.
- **How (runtime, from what each plate already has).** `ui/platedata.mjs depthPlanes` takes the plate's pixels
  that stand above the walking grid (more than 0.15 m), from the geo buffer. It cuts them into bands 2 m deep
  along the camera's axis. The plate worker makes these as masks, in 128 px tiles with empty tiles dropped
  (`cam.planes()`). The people layer draws the far tier's cards into their own canvas, far to near. Each band
  erases its tiles wherever a deeper card lies, tracked with a 64 px occupancy grid. What shows through is the
  plate as drawn, with its lens, light and weather. The full figures are drawn on top: they are the near tier
  and do their own per-pixel occlusion. `?planes=0` restores the old cull.
- **As a bake output (rendering lead, yours to own).** The same shape can come from the bake instead:
  `content/<plate>/planes.json` with `[{ d0, d1, tiles: [{ x0, y0, w, h, src }] }]` and mask PNGs (alpha only).
  That would let you author the edges and name the layers: background stage, the midground band for crowds and
  the train, and the foreground masks such as the colonnade and lamp posts. I will read a baked file first and
  fall back to deriving the bands.
- **Era timelapse (director).** One wide plate per era with the same camera, cross-faded by its depth bands
  from far to near, gives a district that changes plate by plate. The bands are already there to drive it.
- **Cost**: perf/PROGRESS.md 22.
