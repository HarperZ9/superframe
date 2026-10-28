<!-- writing-profile: research -->
# Refraction and dispersion: pre-registration

Written 2026-10-28, before the library or the study ran. Low Water's engine has no refraction code yet. Changes after the run go in a dated section at the end.

## Materials (measured data, checked before writing this)

Each index uses the Sellmeier form n² − 1 = Σ Bᵢ λ² / (λ² − Cᵢ), with λ in µm.

| Material | Source | Check against the catalogue |
|---|---|---|
| Water, 20 °C | Daimon and Masumura 2007, four terms (refractiveindex.info). The page dropped C4's exponent; C4 = 10.69792721 µm² was confirmed below. | n_D 1.333349 against vacuum. Divided by air's 1.000277 this is 1.33298, against the handbook's 1.33299 relative to air. V_d 55.76. |
| N-BK7 glass | Schott catalogue coefficients | n_d 1.516800 (catalogue 1.51680); V_d 64.167 (64.17) |
| Fused silica | Malitson 1965 | n_d 1.458464 (1.45846); V_d 67.82 (67.8) |
| Air | Ciddor 1996, the two-term dispersion form | n − 1 = 2.77e-4 at 589 nm |

The water index is against vacuum and is used relative to air. The glasses are catalogue values relative to air.

## Library (fixed now): superframe `lib/medium/refraction.mjs`

| Function | What it does |
|---|---|
| `index(material, nm)` | the index n(λ) |
| `snell(n1, n2, cos_i)` | the refracted direction, or total internal reflection |
| `fresnel(n1, n2, cos_i)` | the reflectance and transmittance for s and p polarisation |
| `sphereExit(n, k, b)` | the deviation of a ray with impact parameter b through a sphere, with k internal reflections, and its Fresnel weight |
| `bow(material, nm, k)` | the rainbow histogram from many rays |
| `descartes(n, k)` | the analytic bow angle: cos θᵢ = sqrt((n² − 1) / (k (k + 2))) |
| `lens(...)` | a real two-surface lens traced exactly for its focal length per wavelength |

## Predictions

- **P1, materials.**
  - The library reproduces the catalogue values above.
  - BK7: n_d within 1e-5 and V within 0.05.
  - Silica: n_d within 1e-4.
  - Water relative to air: n_D within 1e-4 of 1.33299.
- **P2, interface identities.**
  - R + T = 1 for both polarisations, within 1e-12, at every angle.
  - R_p = 0 at Brewster's angle, tan θ = n2/n1, within 1e-12.
  - Total internal reflection beyond the critical angle.
- **P3, rainbow from a ray trace** (2 million rays per wavelength, Fresnel-weighted, water relative to air).
  - The histogram peak (the caustic) of the primary bow (k = 1) lies within 0.1° of Descartes' angle at each wavelength. The same holds for the secondary bow (k = 2).
  - Measured as angle from the antisolar point: primary between 40° and 42.5°, red outside; secondary between 50° and 54°, red inside.
  - Alexander's dark band: Fresnel-weighted light between the bows is below 20% of the level just inside the primary.
  - The primary's colour width (400 to 700 nm) is between 1.5° and 2.2°.
- **P4, lens chromatic focus.**
  - For a symmetric biconvex lens, f = 100 mm at the d line, thickness 4 mm, traced exactly at small aperture: the focal shift f_C − f_F equals f_d / V within 2%, for BK7 and for silica.
  - The fringe ratio between the two glasses follows the inverse ratio of their V numbers within 3%.

## Controls (must fail)

- **C1, no dispersion.** n held at its d-line value at every wavelength: the bow's colour width is 0, below 0.01°, and the lens's focal shift is 0.
- **C2, no Fresnel weights.** Every ray is given equal weight. Alexander's dark band must lose its contrast: the band-to-inside ratio rises above the weighted case by at least a factor 1.5. This tests that the band's darkness comes from where rays exit, weighted by physics.
- **C3, wrong sign.** n below 1, as if the drop were a bubble in water: there is no primary bow between 40° and 42.5°.

## Ways this could mislead

- **Geometric optics only.** Supernumerary arcs, the glory and the exact bow width under real drop sizes need wave optics: Airy theory or exact Mie, the next rung in `WEATHER-WORLD.md`. A geometric bow is the large-drop limit.
- **The sun is a point here.** A real bow is smeared by the sun's 0.53° disk.
- **No spectral rendering in this test.** The bow's colours as seen are not rendered here; that joins with the spectral model next.

## Result, 2026-10-28 (after the run)

Run: `node tools/refraction-study.mjs`, output in `out/refraction/result.json`, 10 s.

| Prediction | Stated | Measured | Verdict |
|---|---|---|---|
| P1, BK7 n_d | within 1e-5 | 3.5e-8 | holds |
| P1, BK7 V | within 0.05 | 0.003 (64.167) | holds |
| P1, silica n_d | within 1e-4 | 3.7e-6 | holds |
| P1, water n_D relative to air | within 1e-4 of 1.33299 | 1.0e-5 (1.332980) | holds |
| P2, R + T = 1 | within 1e-12 | 0 | holds |
| P2, R_p at Brewster | within 1e-12 | 4e-32 | holds |
| P2, total internal reflection | past the critical angle | yes | holds |
| P3, primary peak against Descartes | within 0.1° | max 0.016° | holds |
| P3, secondary peak against Descartes | within 0.1° | max 0.016° | holds |
| P3, primary range | 40° to 42.5°, red outside | 40.62° to 42.49°, red outside | holds |
| P3, secondary range | 50° to 54°, red inside | 50.14° to 53.52°, red inside | holds |
| P3, Alexander dark band | below 20% of inside | 4.6% at most | holds |
| P3, primary colour width | 1.5° to 2.2° | 1.87° | holds |
| P4, lens shift = f/V | within 2% | 1.03% (BK7), 1.03% (silica) | holds |
| P4, shift ratio = V ratio | within 3% | 1.05692 against 1.05695 | holds |
| C1, no dispersion | colour width 0, lens shift 0 | 0, 0 | holds (fails as required) |
| C2, no Fresnel weights | band ratio up at least 1.5× | 2.73× | holds (fails as required) |
| C3, n below 1 | no primary bow in 40° to 42.5° | **ratio 0.97 of the mean, peak at 42.33°** | **inconclusive as stated** |

- **C3.** At n = 0.75, the k = 1 path still sends light into that band. It is not a caustic, which needs n > 1, but my measure (the highest bin in the window) cannot tell a caustic from a smooth slope. The light there is 0.97 of the mean, against a caustic peak many times the mean. So the stated test does not discriminate, and the control is recorded as inconclusive rather than passed.
- **P4.** f_C − f_F is about 1% below f_d/V. The thin-lens relation is the approximation; the exact trace is the reference.

**Already in the workspace.** `glass/lib/optics.js` already had dispersion: a Cauchy fit through catalogue n_d and V_d at three wavelengths, with values written from memory. Against the measured Sellmeier data it is off by up to 3.4e-4 in index for water at 400 nm and by 2.6e-4 for silica. That is acceptable for three-channel glass, but not for a spectral bow. The new library does not replace it yet. Consolidation item: the glass module should take its indices from `refraction.mjs`.

**Rendered.** The node `optics.bow` traces 16 wavelengths, smears each by the sun's 0.53° disk, and turns them to colour through the CIE matching functions under D65. It was checked by eye at 960 × 540 and rendered at 3840 × 2160 (`out/refraction/bow-3840.png`). It shows:
- the primary, red outside;
- the brighter sky inside it;
- the dark band;
- the secondary, red inside.

The first render used five hand-picked colour bands and a point sun. It came out grey with hairline bows, and was rejected on sight before the spectral version.

**Newton.** This rung reproduces Newton's account of the rainbow's colours (*Opticks*, 1704, Book I, Part II): each wavelength refracts by its own amount, so each colour has its own Descartes angle. Colour comes from dispersion, which Descartes' geometry alone could not explain.

**Does not prove.**
- Geometric optics only. Supernumerary arcs, the glory, and bow width under real drop sizes need wave optics (exact Mie, the next rung).
- The rendering's sky is a flat colour, not a modelled sky.
