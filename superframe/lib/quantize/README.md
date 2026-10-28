<!-- writing-profile: research -->
# Era quantizer

Batch E candidate A, the bridge called codebook plus blur: a good colour reduction is a metamer of its source at viewing distance. This folder reduces an image to a period codebook with ordered dither, error diffusion, posterize, halftone, duotone or two-ink overprint, and then measures how far the result sits from its source once both pass through a model of the eye at a stated viewing distance.

## PREREG (written 2026-10-28, before any code in this folder)

Fixed before the data. Results go in the dated RESULTS section below, and a prediction that fails stays failed.

**Instrument under test.**
- CIEDE2000 is written here (`ciede.mjs`), because `lib/study/cmath.mjs` has CIE76 only.
- The eye model is a reduced S-CIELAB (Zhang and Wandell 1996). It works in Poirson-Wandell opponent channels, with Gaussian sums per channel in degrees. The spreads and weights come from memory, at moderate confidence. The 7 degree negative luminance lobe is dropped and the weights renormalised; that is a stated simplification.
- Viewing distance enters as pixels per degree (ppd). The binding checks use 60 ppd, where one pixel subtends one arcminute.
- Dither runs in linear light. Photons add, so a blurred mix of codebook colours equals their mean in linear RGB. That is physics. Each codebook and each preset is an authored convention and is labelled as one.

**P1. CIEDE2000 matches published pairs.**
- Planted answer: ten pairs from Sharma, Wu and Dalal (2005), typed from memory: 1, 2, 3, 7, 8, 17, 19, 25, 26 and 34.
- Prediction: every pair matches within 1e-4.
- Control that must fail: CIE76 on the same pairs is off by more than 0.5 on at least half of them.
- If a pair misses, either my memory of the table or the code is wrong. I report which one I believe and why.

**P2. Dither is a metamer at 60 ppd; nearest mapping is not.**
- Codebook: 4 levels per channel, sRGB codes 0, 85, 170 and 255, so 64 colours.
- Planted inputs: three smooth ramps at 512 by 128 (grey, a red-to-cyan hue ramp, and a dark ramp from 0 to 64), then the two renders `out/refraction/bow-3840.png` and `out/rings/rings-3840.png`, area-reduced to 960 by 540.
- Prediction: linear-light Floyd-Steinberg and linear-light 4 by 4 Bayer each score a mean ΔE00 under 3 on every input.
- Control that must fail: nearest mapping with no dither scores above 6 on each planted ramp and on the bow.
- Expectation written before measuring, from the image alone: the rings ground looks close to the 170 code, so on rings I expect nearest to score between 2 and 6. Rings is therefore no binding control, and I report it either way.

**P3. Banding.**
- Measure: the banding ratio. Take the row-averaged, eye-filtered L* along the grey ramp. Divide the largest step between adjacent columns by the source's mean step.
- Prediction: nearest scores above 10, and both dithers score under 3.

**P4. Duotone lies on one line.**
- Prediction: on both renders, the float output's largest distance from its best-fit line in linear RGB is under 1e-9. After 8-bit encoding, it is under 0.004 (linear units).
- Control that must fail: a three-stop gradient map with an off-line middle stop scores above 0.05.

**P5. Two-ink overlap is a product of transmittances.**
- Paper times T1 times T2, per channel, in linear RGB. This is Beer-Lambert for stacked transparent inks.
- Prediction: every solid-overlap pixel matches the product within 2/255 in 8-bit sRGB.
- Control that must fail: 50% alpha blending of the two inks gives the midpoint. It must miss by more than 20/255 on at least one channel for the inks used (a cyan and a warm red).

**P6. Halftone keeps area.**
- Planted answer: flat patches at reflectance tones 0.1, 0.2, up to 0.9, at an 8 px cell and 45 degrees.
- Prediction: the ink area fraction is within 0.5% of the target, and the eye-filtered mean matches the target within ΔE00 1. The distance is 187 ppd: newsprint at 85 lines per inch read at 40 cm is about 23 cycles per degree, and 23 times 8 px gives 187.
- Control that must fail: thresholding the cosine spot function directly, with no area table, misses area by more than 2% at some tone.

**Exploratory, not binding:**
- E1: dither in sRGB code space rather than linear light raises the mean ΔE00.
- E2: for each preset, the lowest ppd at which the renders fall under ΔE00 3. This is the preset's metamer distance.

## Files

| File | What it does |
|---|---|
| `ciede.mjs` | CIEDE2000, CIE76 for the control, and Lab per pixel |
| `eye.mjs` | opponent transform, Gaussian sums by box cascade, eye-filtered ΔE00 map and mean, banding ratio, ppd from geometry |
| `codebook.mjs` | codebooks (levels per channel, bit depth, lists, ramps) and nearest lookup in linear light |
| `dither.mjs` | Bayer of any power-of-two size, the PS1 4 by 4 offsets, ordered dither, error diffusion (Floyd-Steinberg, Atkinson, Jarvis-Judice-Ninke, serpentine), posterize |
| `print.mjs` | area-true halftone, duotone, two-ink separation and overprint, and the alpha control |
| `presets.mjs` | period presets, each with its provenance and its authored viewing distance |
| `index.mjs` | one entry: `quantize(img, preset)` and `measure(src, out, ppd)` |

## RESULTS (measured 2026-10-28, after the PREREG above)

`node --test tests/quantize*.test.mjs` gives 17 tests, all passing. The tests encode the measured outcome, including the misses, so a later change that moves any of these numbers is caught. "First build" is the code as first written. "Final" is after two instrument fixes, both found by these checks and both listed under Post-hoc changes.

| # | Prediction | Measured (final) | Verdict |
|---|---|---|---|
| P1 | CIEDE2000 matches 10 Sharma pairs within 1e-4 | worst error 4.2e-5 | held |
| P1 control | CIE76 misses by over 0.5 on at least half | misses on 7 of 10 | held (the control failed, as it must) |
| P2 | FS and Bayer under 3 at 60 ppd | FS: grey 0.17, red-cyan 0.13, dark 0.23, bow 0.22, rings 0.27. Bayer: 0.35, 0.28, 0.61, 0.58, 1.17 | held |
| P2 control | nearest over 6 on the ramps and the bow | grey 6.15, dark 6.67, bow 15.67; red-cyan **5.68** | **failed on red-cyan**, held on the rest |
| P2 rings | nearest between 2 and 6 (not binding) | 3.10 | as expected |
| P3 | banding ratio: nearest over 10, both dithers under 3 | nearest 28.1, FS 1.68, Bayer 4x4 **5.14** | **failed for Bayer**, held for the rest |
| P4 | duotone float residual under 1e-9 | 4.6e-13 (bow), 1.5e-12 (rings); first build **4.3e-8** | first build failed; final holds |
| P4 | duotone 8-bit residual under 0.004 | **0.0059** (bow), **0.0054** (rings), renders reduced 4x; the test reduces 8x and reads 0.0050 and 0.0054 | **failed** |
| P4 control | tritone residual over 0.05 | 0.26, 0.21 | held |
| P5 | solid overlap equals P x T1 x T2 within 2/255 | exact; overlap (28, 45, 39) | held |
| P5 control | alpha midpoint misses by over 20/255 | midpoint (166, 127, 149), off by 138 on red | held |
| P6 | screen area within 0.5% | worst 0.14% (256 px patches, tones 0.1 to 0.9) | held |
| P6 | eye-filtered dE00 under 1 at 187 ppd | worst 0.073 (builder); a verifier rerun of the test's method (192 px, centre 96 px, all nine tones) gives worst 0.059 at tone 0.9; first build **1.33, 2.20, 3.08** at tones 0.7, 0.8, 0.9 | first build failed; final holds |
| P6 control | raw spot threshold misses over 2% | 3.1% at tone 0.1, 6.4% at 0.7 | held |
| E1 | sRGB-space dither raises mean dE00 | FS grey 0.17 to 2.44, dark 0.23 to 4.91, bow 0.22 to 2.93 | held, exploratory |

**Why each miss happened:**
- **P2, red-cyan.** Nearest mapping onto the 64 colours lands closer on this hue ramp than on the grey one: mean 5.68 against the 6 I predicted. The control still separates it from dither (5.68 against 0.13), but it missed the stated line, so it stands as a miss.
- **P3, Bayer.** A 4 by 4 matrix gives 17 tones between two adjacent levels, so its local mean is a fine staircase, and the banding ratio reads that staircase. Post-hoc measurement: an 8 by 8 matrix (65 tones) gives 3.76, still above 3. Floyd-Steinberg gives 1.68.
- **P4, 8-bit residual.** I derived the bound wrongly. Half a code at the bright end of sRGB is about 0.0045 in linear units per channel, which allows up to about 0.008 across three channels. The data agree with that corrected bound. The prediction as written failed.

**Post-hoc changes (both instrument fixes, both found by a failing check, made after the first measurement):**
1. **Mirrored edges.** The eye blur first extended the edge pixels. On a halftone, that repeats one row of the screen into every wide kernel near the border, which biased the wide chroma lobes and caused the P6 failure at dark tones. The fix is mirrored edges, which keep the texture's statistics. I first suspected box-cascade sidelobes; a direct Gaussian left the numbers unchanged, so I reverted it.
2. **Float64 duotone.** The duotone stored its floats as Float32, whose 6e-8 rounding was the first-build P4 residual.

The P2 and P3 numbers moved by under 0.2 between the first build and the final, and every verdict stayed the same.

**E2, metamer distance.** This is the lowest ppd on the ladder 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360 at which the mean dE00 falls under 3. Tiles are at plate scale. The full table is in `out/quantize/plate.json`.

| Preset | Bow | Rings |
|---|---|---|
| PS1 15-bit dithered, 15-bit no dither, 16-bit Bayer | 10 | 10 |
| 64 colours, FS | 20 | 20 |
| 64 colours, nearest | none up to 360 | 30 |
| 1-bit Atkinson | none | 60 |
| Two-ink overprint | none (3.16 at 184) | none (5.49 at 184) |
| 4 greens, newsprint, duotone | none: these hold one axis, so they are scored on L* | |

One-axis lightness error at each preset's own distance: newsprint dL* 0.09 (bow) and 0.13 (rings). The 4 greens give 1.72 and 1.29. Atkinson gives 6.86 and 4.37. Duotone gives 5.77 and 8.25, because its two inks are not black and white, which compresses lightness by design.

## Spec sheet

**Range:**
- Any 8-bit RGB image, any size.
- Codebooks: channel levels and bit depths (1 to 8 bits a channel), explicit palettes, and one-axis ramps.
- Viewing distance: any ppd. The eye model has been checked from 10 to 360 ppd.
- Halftone cells of 4 px or more at any angle, with one or two inks.

**Resolution:**
- CIEDE2000 is exact in double precision.
- The eye filter tells apart an ordered-dither pattern visible at 15 ppd (grey ramp: Bayer 10.58, FS 10.60) from the same pattern hidden at 30 ppd (0.91, 0.66).
- The metamer distance is only as fine as the ppd ladder steps.

**Accuracy on planted answers:**
- CIEDE2000: within 4.2e-5 on 10 Sharma pairs.
- Halftone area: within 0.14% at 9 tones.
- Two-ink solid overlap: exact against the Beer-Lambert product.
- Duotone line: 4.6e-13 in float, about 0.006 after 8-bit encoding.

**Noise floor:**
- A flat field on a codebook colour comes back bit-identical, with dE00 exactly 0.
- A flat field off the codebook dithered with FS: mean dE00 0.08, p95 0.20, max 1.13.
- A planted wrong answer (every code +12) scores 3.50, so the metric rejects it after the same blur.

**Calibration:**
- Sharma pairs typed from memory. They matched my implementation to 4e-5, which corroborates both, but it is not independent of me.
- S-CIELAB constants from memory, at moderate confidence. Recheck against the published table before relying on absolute numbers.

**Known blind spots:**
- The 7 degree negative luminance lobe is dropped, so very low-frequency error is under-penalised.
- No Yule-Nielsen optical dot gain, no ink trapping, and no paper fluorescence. Real halftones print darker than Murray-Davies predicts.
- Ordered dither handles channel codebooks and one-axis ramps only. Arbitrary palettes need error diffusion. Yliluoma-style ordered dither is not built.
- The PS1 dither table and the late-1990s 16-bit Bayer claim are from memory.
- The CRT itself is not modelled: no beam spread, no composite-video chroma blur, no scanlines. Real PS1 dither on a TV was softer than these numbers.
- The banding ratio reads one ramp direction only.
- Nearest mapping for palettes uses CIE76 in Lab rather than CIEDE2000.

## Demo

`node tools/quantize-plate.mjs` takes about a minute and writes three files:
- `out/quantize/plate-compare.png` (3840 x 2264): both renders through all ten presets, each tile labelled with its measured score.
- `out/quantize/plate-detail.png` (3840 x 3102): 76 px crops at 8x, so dither and screen structure can be read.
- `out/quantize/plate.json`: every number printed on the plates.
