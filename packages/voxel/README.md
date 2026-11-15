# voxel

Voxel art from a field or a seed. `voxelizeSdf` samples a signed-distance function on a cubic grid and `voxelizeHeightGrid` stacks a column for each cell of a luminance grid, so any picture becomes relief voxels. `buildVoxelScene` makes a whole sheet from a seed in four studies (relic, monument, terrain, growth), with materials, a seeded palette and ambient occlusion for each face. The scene leaves as an OBJ of the exposed faces only, a JSON schematic, or a MagicaVoxel `.vox` file whose bytes are the same on every run.

## Run it now

From a clone of this repo, with Node 24 or later and no install step:

```
node --test packages/voxel/tests/*.test.mjs      # 15 tests
```

```js
import { voxelizeHeightGrid, voxelObj, voxelSchematic } from './packages/voxel/src/voxel.js';
import { buildVoxelScene, toVoxFile } from './packages/voxel/src/voxel-forge.js';

const scene = buildVoxelScene('first', { study: 'terrain', res: 48 });
const voxBytes = toVoxFile(scene);          // Uint8Array, VOX 150
const shell = voxelObj(scene.vox);          // OBJ text, hidden faces removed
const plan = voxelSchematic(scene.vox);     // JSON text: size and the solid cells
```

`renderVoxelScene(ctx, scene, W, H)` paints the scene in isometric view on any object with the 2D canvas drawing calls. This repo carries no canvas for Node, so the painter runs in a browser.

## Limits

The `.vox` format holds 256 cells on each axis and 255 colours; `toVoxFile` throws past the axis limit. The terrain study reads its elevation from `plot-maps.js`, which is still in the vendored site snapshot under `superframe/upstream/`; the import moves when that file does.

## Origin

`src/voxel.js` and `src/voxel-forge.js` began as `system/voxel.js` and `system/voxel-forge.js` on HarperZ9.github.io and were carried here from commit c8866cc4 on 2026-11-14, with the site's two test files. Two import paths changed in `voxel-forge.js`; nothing else did. The method sources are named at the top of `voxel-forge.js`: the signed-distance primitives and CSG catalogue of Inigo Quilez, baked ambient occlusion for voxel worlds from 0fps, and the MagicaVoxel `.vox` format description by ephtracy.

## BuildLang port candidates

This package is JavaScript that moved; it holds no new feature code. Both modules are queued for a BuildLang port, with the tests here as the known answers the port must reproduce.

| Module | Exports | Notes for the port |
|---|---|---|
| `src/voxel.js` | `voxelizeSdf`, `voxelizeHeightGrid`, `occAt`, `voxelCount`, `voxelObj`, `voxelSchematic`, `isoOrder` | dense byte grids and text output; no browser API |
| `src/voxel-forge.js` | `VOXEL_STUDIES`, `buildVoxelScene`, `assignMaterials`, `seededPalette`, `rotateScene`, `encodePick`, `decodePick`, `applyVoxelEdit`, `faceAO`, `toVoxFile`, `renderVoxelScene` | `toVoxFile` is a byte writer and ports first; `renderVoxelScene` draws through a 2D canvas context and waits for a BuildLang raster target |
