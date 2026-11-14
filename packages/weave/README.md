# weave

Loom drafts as arithmetic. A draft is a threading, a tie-up and a treadling; `computeDraft` multiplies them into the drawdown, the grid that says where warp shows over weft. `STRUCTURES` holds the named weaves, and `draftToWIF` and `wifToDraft` write and read WIF 1.1, the interchange file weaving software shares.

## Run it now

From a clone of this repo, with Node 24 or later and no install step:

```
node --test packages/weave/tests/*.test.mjs      # 10 tests
```

```js
import { STRUCTURES, computeDraft, draftToWIF, wifToDraft } from './packages/weave/src/weave-engine.js';
```

The engine's weave node in `superframe/adapters/site.mjs` renders a draft as a raster through this package.

## Origin

`src/weave-engine.js` began as `system/weave-engine.js` on HarperZ9.github.io at commit 3ca6529. It sat in the engine as a vendored snapshot until 2026-11-14 and is maintained here from that date. The test file came from the site's `system/weave-engine.test.mjs`.

## BuildLang port candidates

This package is JavaScript that moved; it holds no new feature code. The module below is queued for a BuildLang port, with the tests here as the known answers the port must reproduce.

| Module | Exports | Notes for the port |
|---|---|---|
| `src/weave-engine.js` | `STRUCTURES`, `computeDraft`, `weftPaletteFor`, `draftToWIF`, `wifToDraft` | integer grids and text output; no browser API |
