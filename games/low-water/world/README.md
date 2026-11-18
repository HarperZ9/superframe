# The world

Low Water as one continuous island, generated from a seed. The island measures 131 km by 98 km on a grid of 2048 by 1536 cells, 64 m to a cell. It holds eleven regions, a river system, lakes, fifteen ring towns a day's walk apart, forty-six villages, the roads between them and the landmarks that give each region its skyline.

The canonical seed is `20261118`.

The world bible is `WORLD.md`: every region with its geography, climate, light, architecture, people, creatures and the saved images it traces to. `stills/README.md` shows each region and says plainly which look right.

## Make a world

The generator is BuildLang (`gen/`). Build it with buildc 1.15.0 or later, then run it with a seed and an output folder.

```bash
buildc build --release games/low-water/world/gen
mkdir -p games/low-water/world/out/20261118
games/low-water/world/gen/target/release/main 20261118 games/low-water/world/out/20261118
```

A run takes about 30 seconds on one core and prints the time of each stage.

## What it writes

| File | Holds |
|---|---|
| `height.pgm` | ground height, 16 codes to the metre, code = (metres + 512) x 16 |
| `water.pgm` | water surface in the same code, 0 where the ground is dry |
| `river.pgm` | river class, 8 x sqrt(drainage in km2), 0 where there is no river |
| `moist.pgm` | rain share, 0 to 255 |
| `biome.pgm` | ground cover, 0 to 13 (the list is in `gen/climate.bld`) |
| `region.pgm` | region, 1 to 11, spread over the sea so weather has no hole |
| `world.json` | regions, settlements, roads with walking hours, river lines, landmarks, checks |

The rasters are plain PGM text. buildc's file writer takes strings and a string cannot hold a zero byte, so a binary raster is a compiler gap, recorded here as language debt. `pgm.mjs` reads them in node and in the browser.

## Walk it

```bash
node games/low-water/game/serve.mjs
```

Open `http://127.0.0.1:8731/world/walk/index.html` in a browser with WebGPU. W A S D move, the mouse looks after a click, Shift runs, F flies, Space and C rise and sink. The number keys, 0 and minus go to the eleven regions. The wheel turns the clock and T holds it.

The page draws four passes on the engine's web GPU host (`native/web/raw-gpu.mjs`): sky, ground, masses and water.

- **Ground.** CDLOD on a quadtree from 32.8 km nodes to 128 m, vertices 4 m apart under the walker. The 64 m raster carries the land; a lattice noise adds relief 16 m and 4 m across, and the walker's feet compute the same function.
- **Water.** One surface for the sea, the lakes and the rivers, with depth colour, a wind-driven swell, foam at the shore and lamp streaks near towns. Still water doubles what stands over it from a mirror pass; a ripple stretches each lamp's double into a vertical streak (the brightest of twelve taps down a line) and the crests break it into dashes in bands of distance.
- **The works** (`walk/build/works.mjs`, `walk/build/plant.mjs`). Five furnace complexes, and round each a street grid of process blocks: open steel structures of decks with vessels through them, column clusters, tank farms in their bunds, spheres, fired heaters and cooling cells, with a pipe rack down every street. About 450 blocks, 1.4 million triangles and 27,000 lamps for the canonical seed. The works region has a `gloom` of 0.9 in `weather.mjs`, so its night dome and air fall near black and the lamps carry the picture.
- **The kit of parts** (`walk/build/parts.mjs`). Windows, doors, lanterns turned on a lathe, signs with lettering drawn from a seed, chimneys, clutter (air conditioners, potted plants, bicycles, crates, vending machines, heaps of shovelled snow), cables across lanes, and people as small figures with coats and umbrellas. Each region builds from the same parts in its own vernacular (`VERNACULAR`: snow, coast, marsh). The snow town of Thaw Country is built from it.
- **The storm coast** (`walk/build/coast.mjs`). Sea stacks as jointed, stratified, leaning columns of rock, some split in two. Each has a field of teeth and boulders at its foot, black rock along the nearest shore, and sheets of surf drawn as long-exposure streaks round every rock. In a wind above 0.6 the sea breaks into white streaks and loses its mirror.
- **The marsh reed halls** (`walk/build/marsh.mjs`). The Marsh Arab mudhif, credited and transformed: arches of bound reed over a skin of woven mats, lattice screens at the ends with a door between two tall reed pillars, and inside, flat-woven rugs and cushions down both walls and a hearth with its coffee pots. Each hall stands on an island of packed reed with a long boat drawn up beside it.
- **Masses.** Instanced trees and grass round the walker (spruce sprays taper to a point and carry the crown's normal, every foliage card is eaten back from its edges by noise so no card outline shows, and a bare broadleaf understory of forked twigs stands under the fog forest's spruce), and placeholder architecture from `world.json` at three scales: houses and ring walls, monuments, megastructures.
- **Sky.** Sun, moon, stars, the Milky Way, a cloud layer with storm cells, a 22 degree halo, aurora and a comet.
- **Weather and time** (`weather.mjs`). A day weighted toward dusk, night and dawn, one signature weather for each region with gradient borders, and sky events by rule from the seed.

Stills and frame times come from `tools/shot.mjs`, which drives a headless browser on the CPU adapter by default.

```bash
node games/low-water/world/tools/shot.mjs --out stills --views all
```

## Play it

The walk page puts Lamb on the island: the player, built by the character forge (`characters/cast/lamb.mjs`), animated from the shared clips and gaits (`characters/anim/`), lit by the town's own lamps and carrying a lantern that lights the snow round it. Four cameras, switched with V, the gamepad's Y or the small control at the bottom right, each blending into the next over 0.9 s with no cut:

- **Follow** (the default). A spring arm over the right shoulder that leads the walk by a third of a second, gives way at once to walls, roofs, trunks and the ground and comes back slowly. In open country, with nothing standing within 16 m, it draws back over ten seconds to 15 m and a little higher, so the figure reads small in a large place; near walls it comes in again.
- **Eyes.** First person: the eye over the neck, the stride's rise and fall from the gait's own phase, the lantern brought up into the lower left of the view, the head and hat not drawn.
- **Plan.** The 2D game's fixed three-quarter angle (yaw 26, down 30, `design/CAMERA.md`), orthographic, a person about 134 px tall in a 1080-line view at zoom 1. The wheel zooms from 0.4 to 5 times; R turns the view a quarter. Whatever stands between the eye and the walker is cut away by an ordered dither (`cutaway` in `walk/common.wgsl`). The change into it is a dolly zoom: the field narrows to 3 degrees while the eye draws back, and the switch to a true orthographic view comes at the end.
- **Fly.** Free flight for exploring and building, faster the higher it goes, kept 1.5 m over the ground and out of anything built. F goes to it and back.

Keys: W A S D move, Shift runs, E reaches. A gamepad: the left stick moves, the right looks, the left stick's click or RT runs, A reaches. A phone: the left thumb is a stick wherever it lands, the right drags to look. `?cam=iso` starts in a camera, `?at=hoarstead-main-street` at a named viewpoint, `?play=0` gives the old free camera with no walker.

### The parts

The logic lives in `play/` and touches no browser or GPU (a test enforces it), so the native engine can run the same modules; `walk/player.mjs` and `walk/devices.mjs` are the browser's half.

| Module | Holds |
|---|---|
| `play/controller.mjs` | the body: walk 1.45 m/s and run 4.6 m/s, Tobler's rule on slopes, a wade from knee depth, turned back by chest-deep water and by slopes over 42 degrees, pushed out of walls and trunks |
| `play/animator.mjs` | idle, walk and run blended by speed, start and stop (the stride settles onto double support), turning on the spot in small steps, wading, leaning into slopes and curves, coat springs and wind on the coat, first-person arms (walk sway, the look, a reach); each foot locked to the ground while it bears weight, set on the ground's real height by two-bone IK (heel and toe both above it, so a foot on a stair stands on the step its toe reaches), a toe-off before the leg runs out of reach, and the hips dropped so the lower foot reaches |
| `play/camera.mjs` | the four cameras and the blend, in framing space (target, heading, pitch, distance, field) |
| `play/solids.mjs` | what cannot be passed: houses as walls and roof prisms, trunks, lamp posts and the works' vessels as cylinders, read lazily per 32 m cell; a signed distance, a sphere cast and a push-out |
| `play/input.mjs` | keys, mouse, gamepad and touch to one intent |
| `play/viewpoints.mjs` | named places to stand, worked out from the world (below) |
| `play/geocheck.mjs` | is an eye inside the drawn triangles: the check the camera tests use |

### Viewpoints

A still or a spawn names a viewpoint instead of carrying coordinates, so a change to the generator moves the view with the thing it looks at. Each is checked to stand half a metre clear of every solid and on dry ground.

| Name | Worked out from |
|---|---|
| `<town>-main-street` | the town's plan: a third of the way along its street, looking down it past at least four houses, at night |
| `<town>-lane` | the town's longest side lane, from near its mouth |
| `<town>-approach` | the road outside the town, looking in, at dusk |
| `works-across-water` | the bearing from the furnaces with the most open water between, on the shore |
| `works-yard` | the concrete 160 m from the furnaces, toward the island's middle |
| `fog-forest-road` | the road point in the fog forest with the most forest cover round it, looking along the road, at dawn |
| `fog-forest-under` | 30 m off that road among the trunks |

```bash
node games/low-water/world/tools/shot.mjs --out play --play "street=hoarstead-main-street,follow,20"
node games/low-water/world/tools/shot.mjs --out check --check "hoarstead-main-street,40;fog-forest-road,40"
```

`--play name=viewpoint,camera[,seconds[,run]]` writes a still and, with seconds, a walk at a steady 30 frames a second. `--check` walks the follow camera from each viewpoint, swung toward the walls every few seconds, and tests every eye against the triangles the page draws (not the solids the camera steers by); then the same walk with collision off and with a wall planted behind the walker. The runs with collision off must show frames in geometry, or the check proves nothing.

## The plate

```bash
node games/low-water/world/plate/plate.mjs --out plate.svg
```

The same files drawn as a hachured map: shadow hachures lit from the north-west, water-lining round the coast, rivers that widen to the sea, tree, reed and stipple signs by cover, the roads and the ferry in one accent colour, and every name lettered from the game's own stroke skeletons (`game/engine/ui/lettering`). The scale bar carries the measured day's walk between ring towns. `plate/low-water-20261118.png` is the plate of the canonical seed.

![The island of Low Water as a hachured plate](plate/low-water-20261118.png)

## How the island is made

1. **Tectonic sketch** (`tect.bld`). Five plates, each a handful of seeds moved by the world seed. Where two plates meet the ground lifts: the long north-south range stands on the boundary of the west foreland and the east block. The south-west plate sinks and becomes the delta. A city island stands across a strait from the bay.
2. **Erosion** (`erode.bld`, `flood.bld`). Thirty rounds of stream-power erosion against uplift. Each round floods the surface from the sea inward, which gives every cell a downhill way out, then cuts each cell toward its receiver in proportion to the square root of its drainage.
3. **Water** (`hydro.bld`). Four overdeepened valley reaches become long lakes. Kettle ponds open on the northern shield and pools in the marsh. A last flood finds every basin and its spill level.
4. **Climate** (`climate.bld`). Temperature falls to the north and with height. Rain arrives on a west wind and is spent on the climb, so the east block sits in a rain shadow.
5. **Cover and regions** (`climate.bld`, `stages.bld`). Cover follows temperature, rain, slope and height. Regions follow plate, height and shore.
6. **Settlements and roads** (`settle.bld`, `roads.bld`). One seat for each region that can hold one, then ring towns where the nearest is too far, villages, and lone houses on the high moor. Roads are least-time routes under Tobler's hiking function. In the walk (`walk/roads.mjs`) each road wanders and bends toward the low side of the land it crosses, from the overview heights so the bends never change as tiles arrive, and carries no snow except in town lanes.
7. **Landmarks** (`landmarks.bld`). Vernacular, monument and megastructure masses placed by rule, up to the 1,200 m Tower of the monument ground.

Every step uses integer hashing and the operations `+ - * / sqrt floor` only, the rule of `design/DETMATH.md`, so a seed gives the same bytes on any machine.

## Checks

```bash
BUILDC=buildc node --test games/low-water/world/tests/world.test.mjs
```

- **Determinism.** Two runs of one seed give byte-identical files. A second seed gives a different terrain.
- **Hydrology.** Along every river line the water surface never rises, and the line ends in the sea, in a lake or on another line that does. The control builds the same world with one river bed raised 40 m; the generator's own check and the file check must both fail on it.
- **Scale.** The test prints the walking time of every road between ring towns. For seed 20261118 the median is 5.9 hours over 29 km, the shortest 2.3 hours with the ferry and the longest 12.0 hours.
- **Regions.** All eleven exist, each with its seat and its landmark kinds.

## Language

The generator is BuildLang. The raster reader and the checks are JavaScript modules run by node, the form every other Low Water test takes. The debt: binary output from BuildLang, and the checks themselves, which could move once buildc can read a file of this size quickly.

The camera rig is also BuildLang: `play/native/` is a port of `play/camera.mjs` (all four cameras and the blends, with the ground as the thing to collide with), compiled by buildc's C backend to a native executable. Both use the DETMATH functions (`design/DETMATH.md`; `play/math.mjs` adds `dlog` by the same rules), and on a 900-frame walk through every camera the two give the same bits on every frame (`tests/camera-native.test.mjs`; the control, the lead changed from 0.35 s to 0.36 s in the BuildLang copy, differs on 702 frames). It is not yet wired into the native shell (`lw_game_view` in `games/low-water/runtime/game/main.bld`, superframe#132), and the solids and drawn meshes it steers by in the browser are not ported.

The rest of `play/` (the body, the animation, the solids, the input) is JavaScript with no browser or GPU inside it. The debt, measured on 2026-11-18: buildc 1.15.0's wasm target refuses `sqrt` ("no WASM runtime for `sqrt`"), so the browser page cannot call the BuildLang camera and keeps its JavaScript twin, held equal by the test above; and the animation reads the character modules (`characters/`), which are JavaScript too.
