<!-- writing-profile: research -->
# Lens Room view against the source page

Date: 2026-10-31. Source page sha256 `403142c0057ccd045364e2c69efb3464b97c4e07b1229a99eca1c5b830c1542b`. Run on this workstation in the built-in browser, WebGL 2 through ANGLE.

## Result

The generated view rendered the same floats as the source page in all 42 cases: 0 of 57,600 colour values differed in every case, so the difference is 0 and the hashes are equal. Each case is 160 by 120, 16 frames on the fixed frame sequence, read back as 32-bit floats through the page's own `renderMean`, with the page's frame loop halted. The cases are 27 shapes, 7 worlds, and 8 switches: no path tracing, two lenses, polariser, scattering, water material, embedded spheres, the pattern scene, mirror.

## Verified

| What | How | Result |
|---|---|---|
| Pixels | two iframes, same settings, float compare | 0 differing in 42 of 42 cases |
| Comparator catches a change | torus against globe, planted | 38,218 of 57,600 values differ, max 4.50 |
| Render repeats | same case twice on one page | 0 differ, so a pass is not chance alignment |
| Shader text | `tests/golden.test.mjs`, in CI | 56 shapes, 26 feature and scene programs, train and world, hash equal |
| Code | AST of each top-level statement | 252 of 260 identical; the 8 changed are listed below; HTML shell identical |
| Page's GPU checks | Snell, repeats, globe, Luneburg, Beer-Lambert, diffusion, clear medium, apodiser, metamers, moire, on both pages | JSON of the results byte equal between pages |
| Page loads | screenshot and console | Default view draws; no console errors |

**Compile time.** One lens program took 0.6 to 2.0 s on the source page (worst 1990 ms, shape 16). The view then showed 7 to 22 ms for the same programs, because ANGLE's program cache hit on identical source text. That confirms the text matches, and it is not a separate cold measurement of the view. Since the source text is equal, its cold time equals the page's.

## The eight changed statements

| Statement | Change |
|---|---|
| `MAT`, `G`, `ewCurv`, `ILL` | numbers read from provenance rows; values hash equal to the page's |
| `worldFS`, `setWorld`, `gravityRows` | the shader generator takes `St` and no longer reads a page global |
| `fCompile` | trims the left side, which fixes `g = 0` written with a space |

## GPU and CPU readings agree

| Check | GPU, view | CPU reference | Known answer |
|---|---|---|---|
| Snell window, n 1.5 | 41.805 degrees | see the test | 41.8 |
| Snell window, n 1.333 | 48.604 degrees | see the test | 48.6 |
| Luneburg exit, RMS | 0.103 degrees | 0.059 degrees | 0 |
| Diffusion slope | -1.04 | within 0.2 of -1 | -1 |
| Metamer dE under D65, A, LED | 0.010, 12.8, 7.3 | under 1e-6, over 0.5, over 0.5 | match, then split |
| Focal lengths: Cooke, Hubble, Keck, Wolter | 50.0197, 57.5984, 17.4872, 10.0515 | 50.0197, 57.5999, 17.4872, 10.0516 | 50, 57.6, 17.487, 10.05 |
| Moire period | -0.20 percent | within 2 percent | p / (2 sin(a/2)) |

## Limits

This compares one GPU and one driver. It covers the 42 cases and the code identity behind them; other cases rest on the statement-level AST check. The comparison is not in CI, which has no WebGL.

The view is the same page, so it does not yet use the site kit, and it needs that before going public. Files stay long where the page's functions are long; see `DESIGN.md`.
