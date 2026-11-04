# quality

Checks a render, a page or a clip with numbers instead of a glance. Each check has a known answer in its tests: a quantised ramp must read as banded and the same ramp with TPDF dither must pass, aliased strokes must score as stairs, and a frame dropped from a 60 Hz record must be counted.

```
python -m pip install -r packages/requirements.txt
python -m pytest -q -p no:cacheprovider --import-mode=importlib packages/quality
```

| Module | Measures |
|---|---|
| `ssim` | SSIM between two images, worst tile as well as the mean; `check` compares against a golden image and never overwrites it unless asked |
| `banding` | gradient banding on smooth ramps: banded share, gap ratio, widest band |
| `edges` | anti-aliasing share and stair share over sampled strong edges |
| `grain` | surface grain: robust residual SD, correlation width, spectral centroid, chroma ratio, cell pitch |
| `pacing` | frame pacing from `pacing.js` rAF records (interval p95, dropped frames) and the unique-frame cadence of a video |
| `typemetrics` | type rules from `typemetrics.js` items: minimum size, line length, leading, tracking, WCAG 2.2 contrast, faux bold or italic, kerning |
| `static_check` | evidence in JS, CSS and HTML source for things a screenshot cannot show: device pixel ratio, dither, P3, fixed timestep, seeds, pixel tests |
| `imgio` | image loading shared by the checks |

Each analysis module also runs from the command line, for example `python -m quality.banding frame.png` from `packages/quality`.

## Browser checks

`typemetrics.collect` and the pacing recorder run inside a Playwright page. Their tests skip, and say why, when Playwright or a Chromium binary is missing. Set `PLAYWRIGHT_CHROMIUM` to use a specific browser binary.

## Limits

A pass means the measured number is inside its target. A good score does not make a page good to look at; the checks catch named defects only. The collector tests use the Hanken Grotesk face in `techniques/fonts`.
