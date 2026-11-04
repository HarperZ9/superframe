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

`tests/test_ka.py` runs 19 known-answer cases, each with its margin stated in the test: paraxial focal length and back focus of the patent design, energy and ray checks, tolerance and rules behaviour, drawing codes and interchange round trips.
