# Stills of the island, and an honest read

Fifteen stills of seed `20261118`, one or two for each region, taken by `tools/shot.mjs` on the CPU adapter at 1280 x 720 and stored here at half size. Every camera is placed from `world.json` (`tools/views.mjs`), so a new seed moves the views with the land.

Each still was set beside the saved reference its region traces to, on a pair sheet (`tools/pairs.mjs`). The references are other people's pictures on the author's disk, so the pair sheets and the list of reference paths stay outside the repository. The labels below are the art direction document's labels for them.

## The short version

The world is there: the land, the water, the towns, the skyline masses, the weather and the sky all stand where the rules put them, and they can be walked. The picture is a first version. Set beside the saved references, no region looks right yet. Five carry the right idea. The rest show a correct place drawn with placeholder shapes.

The gap has one main cause. The references are dense with small made things, texture and local light. These stills have smooth ground, cones for trees, spikes for grass and plain boxes for buildings, under one sun or moon with no shadows from the masses.

## Region by region

| Still | Reference | Read |
|---|---|---|
| `00-island` | none | **Reads.** The range, the snow, the wet west, the dry east, the bay and the city island are all legible from 52 km up. The coast is plain. |
| `01-thaw-country` | B2.188, snow nights under sodium | **Idea only.** A walled town as a dark line on a snow plain under a pink dusk and a moon. The reference is lamp light on snow at arm's length; this has no lamps in view and no falling snow. |
| `02-uplands-white-house` | likes 27442321, the white house on the moor | **Idea only.** One white house, one small figure of a building in a large place, snow peaks behind. The moor is one flat brown and the grass is orange spikes. |
| `02-uplands-cloud-sea` | B5.70 | **Not yet.** The ridges and the snow line are good terrain. There is no cloud sea in the frame, which was the point of the view. |
| `03-fog-forest` | B1.116, a fog lane in a bare wood | **Closest in mood.** Tiers of conifers fading into fog, dark trunks, a slope. The trees are cones and the birch crowns are yellow blocks. The reference is dark, close and full of twigs. |
| `04-storm-coast` | B12.371, a storm coast in long exposure | **Idea carries.** One stack in a grey sea under a low sky. The stack is a plain frustum and there is no surf, no swell breaking, no port. |
| `05-canyon` | AA426, Holmes's canyon panorama | **Not yet.** A rim town of adobe boxes and a canyon mouth in warm light. The canyon has no strata in view and no depth; the reference is all layered distance. |
| `06-marsh` | img-008 6, the reed hall | **Wrong.** Dry ground with reed spikes and a far town. No standing water, no reed halls in frame, no buffalo. The marsh needs open pools and the view needs to stand at one. |
| `07-city-across-water` | AA185, Blue Moscow | **Idea only.** Dark blocks and a scatter of lit windows across black water at night. No skyline, no reflections of the blocks, no crowd. |
| `08-the-works` | B3.19, a refinery doubled in water | **Furthest from its reference.** Lit furnaces far off across dark ground. The reference is thousands of lamps on pipework, mirrored. The work lamps exist in the shader but the view stands on land, a long way back, and the structures are five plain shapes. |
| `09-monument-ground` | img-011 47, tapered towers above the canopy | **Scale reads, surface does not.** The Tower stands on the dusk horizon from 5.5 km and shows from the uplands 27 km away (`09-tower-from-afar`), which is the megastructure doing its job. Close to, it is a bare cylinder; the reference is an inhabited wall of balconies and ivy. |
| `10-drowned-quarter` | B5.103, overgrown stations and ponds | **Idea carries.** Blocks standing in water with the city behind them in haze. Nothing has grown on anything. |
| `11-far-north-works-town` | img-004 0, Norilsk | **Closest in subject.** A pastel slab block with a few lit windows, a smelter stack, pipes on stilts, snow, whiteout. No pylons, no road, no vehicles, and the snow is one tone. |
| `11-aurora` | likes 26261203 | **Works as an event.** Green and violet curtains over lit blocks and a stack. The curtains are ribbons, the stars are streaks, and the reference has a sea and stacks under it. |

## Known faults in these stills

- White slivers on the mountainsides are small water patches drawn too bright at a distance.
- The ground shows a soft spotted pattern at low sun.
- Grass reads as spikes on every near view.
- The works still was reshot after a lightning flash whitened the first one; a held still no longer takes a flash.

## Frame time

| Adapter | Method | Result |
|---|---|---|
| CPU (SwiftShader) | gaps between animation frames over 20 s, 1280 x 720, machine 51 to 64 % busy | 81 ms in the canyon view, 349 ms in the works view |
| RTX 4090 | the same gaps over 5 s, 1600 x 900, in the desktop app's browser pane, GPU held at 100 % by two other jobs | 40 to 45 ms in four views |

The GPU figure did not change between a 164,000-triangle view and a 793,000-triangle view, so it tells about the contended machine and the pane and gives no scene cost. A quiet-machine measurement is owed.
