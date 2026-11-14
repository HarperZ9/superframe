# fractal

A small language for fractal formulas, and the renderers that run it. Write an iteration such as `z^2 + c` and `parseFormula` turns it into a syntax tree; `compileJS` and `compileGLSL` turn the tree into a CPU function or a fragment program, and `derivative` differentiates it symbolically for distance estimates and Newton fractals. `renderFormulaCPU` and `renderLyapunovCPU` draw a view on the CPU with the shared colour recipe: OKLab ramps, orbit traps and relief shading.

## Run it now

From a clone of this repo, with Node 24 or later and no install step:

```
node --test packages/fractal/tests/*.test.mjs    # 14 tests
```

```js
import { parseFormula, compileJS, compileGLSL, derivative } from './packages/fractal/src/fractal-formula.js';
import { formulaSpec, CATALOG } from './packages/fractal/src/fractal-formulas.js';
import { renderFormulaCPU, renderLyapunovCPU } from './packages/fractal/src/fractal-formula-cpu.js';
```

The engine's fractal node in `superframe/adapters/site.mjs` calls `renderFormulaCPU`. The GLSL modules build shader source as strings and touch no GL context, so their tests run in Node.

The colour conversions come from `packages/superstack/superstack.mjs`.

## Origin

The eight files in `src/` began under `system/` on HarperZ9.github.io at commit 3ca6529, with the same file names. They sat in the engine as a vendored snapshot until 2026-11-14 and are maintained here from that date.

The tests came from the site's `system/fractal-formula.test.mjs` and `system/fractal-color.test.mjs`. Eleven site tests stayed behind because they need site modules this package does not hold: the Buddhabrot accumulation test (`fractal-buddhabrot.js`) and ten palette, ramp and shader-text tests (`fractal.js`, `fractal-gl.js`, `fractal-glsl.js`). They come over when those modules do.

## Other implementations in this repo

`native/` has its own fractal code (Mandelbulb and Mandelbox). It is a separate implementation and has not been compared with this package.

## BuildLang port candidates

This package is JavaScript that moved; it holds no new feature code. Each module below is queued for a BuildLang port, with the tests here as the known answers the port must reproduce.

| Module | Exports | Notes for the port |
|---|---|---|
| `src/fractal-formula.js` | `parseFormula`, `compileJS`, `compileGLSL`, `derivative`, `usesOf`, `FormulaError` | the parser and the symbolic derivative are plain data; `compileJS` builds a function from text and needs a BuildLang evaluator in its place |
| `src/fractal-formulas.js` | `CATALOG`, `FORMULA_TYPES`, `formulaSpec`, `iterateSpec`, `cpuFunction`, `degreeOf` | catalogue table and the CPU iteration |
| `src/fractal-formula-cpu.js` | `renderFormulaCPU`, `renderLyapunovCPU` | offline raster; first candidate |
| `src/fractal-color.js` | `preparePalette`, `rampLinear`, `relief`, `reliefDir`, `trapWeight`, `holdGamut`, `encodeChannel`, `ditherOffset` | float arithmetic |
| `src/fractal-colouring.js` | `COLOUR_MODES`, `MODE_INDEX`, `fullOrbit`, `orbitSource`, `colourSettings`, GLSL blocks | mostly shader text |
| `src/fractal-glsl-lib.js`, `src/fractal-glsl-formula.js`, `src/fractal-glsl-lyapunov.js` | shader libraries, `buildFormulaFragment`, `buildLyapunovFragment`, `rootColour`, `lyapunovExponent`, `lyapunovSequence` | GLSL stays GLSL; the string assembly and the two CPU helpers move |
