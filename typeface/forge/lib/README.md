# typeface/forge/lib

The type forge: it mints the Zain Mint face. Fixed skeletons hold the topology of each letter, a pen with weight, contrast and width traces them into outlines, and named legibility rules refuse a face that breaks them. `mint(params, seed)` returns the glyph outlines with a receipt, or the refusals by name. `setText` sets a line in a minted face as SVG.

## Run it now

From a clone of this repo, with Node 24 or later and no install step:

```
node --test typeface/forge/tests/*.test.mjs      # 5 tests
```

```js
import { mint, setText, DEFAULTS, RULES } from './typeface/forge/lib/forge.mjs';
```

`typeengine/lib/faces.mjs` reads this folder for the living type engine, and `packages/studio` turns a minted face into static and variable TrueType fonts. The forge test holds the font bytes to the SHA-256 of the fonts the Python forge wrote for the same parameters.

## Origin

The five files began under `system/type-forge/` on HarperZ9.github.io at commit 3ca6529, with the same file names; that code is itself a port of Flywheel's `harness/typeface_forge.py` and `typeface_skeletons.py`. They sat in the engine as a vendored snapshot until 2026-11-14 and are maintained here from that date. The test came from the site's `system/type-forge/forge.test.mjs`.

## Other implementations in this repo

The site has its own TrueType writer (`system/type-forge/ttf.mjs`); the engine's is `packages/studio/src/font/ttf.mjs`. The forge test here runs against the engine's writer and gets the same four font hashes.

## BuildLang port candidates

These files are JavaScript that moved; the folder holds no new feature code. None uses a browser API, so all five can move to BuildLang today, with the font hashes as the known answers.

| Module | Exports |
|---|---|
| `pyround.mjs` | `pyRound` |
| `geometry.mjs` | `superellipse`, `line`, `stroke`, `stem`, `diag`, `bar` |
| `skeletons.mjs` | `build` |
| `skeletons-caps.mjs` | `buildCaps` |
| `forge.mjs` | `mint`, `setText`, `DEFAULTS`, `RULES`, `EM`, `ENGINE` |
