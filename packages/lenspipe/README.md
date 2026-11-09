# lenspipe

Takes an open lens design file and returns its checked performance, manufacturability, tolerance budget, physical limits, an as-built fit and interchange files. Runtime needs numpy and scipy only.

```
python -m pip install -r packages/requirements.txt
python -m pytest -q -p no:cacheprovider --import-mode=importlib packages/lenspipe
```

| Module | Does |
|---|---|
| `design` | the `lenspipe.design/1` file: surfaces, materials, tolerances and intent; validation and conversion to a lens |
| `trace` | vector ray trace through spheres and even aspheres with tilt and decentre; paraxial values and the entrance pupil |
| `optics` | performance from real rays: spot, distortion, relative illumination, vignetting, wavefront, Strehl, MTF, best focus |
| `glass` | indices and internal transmittance from `data/glass_catalog.json`, or a model glass from nd and Vd |
| `optimise` | damped least squares on a stated goal, kept inside the manufacturability rules, with a cost ledger |
| `tolerance` | Monte Carlo tolerance runs with refocus, yield with a Wilson interval, and sensitivities |
| `rules`, `rules_shop` | manufacturability rules with their origin, graded BLOCK, FLAG or INFO |
| `limits` | each design against the physical bound for its job, with a Fisher-information reading of the pupil |
| `asbuilt` | fits a perturbed model to measurements and says whether the built part meets its standard |
| `cadout` | STEP AP214 solids, binary glTF and an ISO 10110 style element drawing as SVG and text |
| `interchange` | Zemax ZMX, CODE V .seq and Lens Room JSON, written and read back |
| `pipeline` | runs the whole chain on one design and returns a verdict and every output file |

The ISO 10110 notation follows public tutorials, and no optical shop has reviewed the drawings. The ZMX and SEQ keywords come from public open-source parsers and documentation.

## Data

- `data/designs/`: three double Gauss prescriptions from US patent 2,784,643 (Examples 1 and 2, scaled to f = 100 mm) and the same design as tabulated in a COMSOL Ray Optics tutorial after Smith, *Modern Lens Design*. Each file names its source.
- `data/glass_catalog.json`: optical glass dispersion rows taken from the refractiveindex.info database, CC0 1.0. Vendor catalogue snapshots there date mostly from 2017 to 2019, so a row does not show that a glass is still sold.

## Tests

`tests/test_ka.py` runs 23 known-answer cases, each with its margin stated in the test: paraxial focal length and back focus of the patent design, energy and ray checks, tolerance and rules behaviour, drawing codes and interchange round trips. The newer rules each come with a planted fault they must refuse.

## Reading the verdict

The pipeline prints one line with two readings. `Manufacturability` is the rules, stated goals and tolerance yield: `QUOTABLE` means no rule fired, and says nothing on image quality. `Optical performance` is the class of the nominal design at best focus: `DIFFRACTION-LIMITED` needs a Strehl ratio of 0.8 or more at every field, and anything lower reads `ABERRATION-LIMITED` with the worst Strehl ratio and the worst spot beside it. The shipped double Gauss reads `QUOTABLE WITH NOTES` and `ABERRATION-LIMITED`.

A surface may carry `mech_semi`, the mechanical semi-diameter. Without it each drawing sets the outer diameter equal to the clear aperture and the rules flag the missing rim. With it the rules flag a clear aperture over 90 percent of the outer diameter (my figure, no source read) and block a rim where the two faces cross. The drawing prints each radius with the tolerance its power fringes allow over the clear aperture.
