# materials

**Mission.** One record per material, built from measurement, so a renderer and a
simulator read the same physics. Optics are spectral: n(λ) and k(λ) from 380 to 780 nm
are the truth, and RGB is only a render of them. Thermal, mechanical, electrical and
surface constants sit in the same record, because the properties interact: the free
electrons that carry current also make a metal a mirror (the Drude relation), and the
same electrons carry heat (Wiedemann-Franz). Every field names its source, licence and
confidence. A field nobody has measured openly stays null.

## What is in it

111 materials: 28 metals, 3 semiconductors, 15 dielectrics (glasses, crystals,
polymers), 13 liquids, 13 gases, 10 biological, 12 minerals, 12 pigments and inks,
5 woods. `data/materials.json` holds the records; `data/sources.json` lists every source
file with its sha256 and licence.

| Source | Feeds | Licence (checked on the source's own page, 2026-10-29) |
|---|---|---|
| refractiveindex.info database | n, k for 103 materials | CC0 1.0 |
| physicallybased.info API | roughness, density, viscosity, surface tension, RGB albedo for 3 tissue records | CC0 1.0 |
| Wikidata | density, heat capacity, conductivities, melting and boiling points, moduli | CC0 (structured data) |
| USDA FPL Wood Handbook, FPL-GTR-282 (2021) | woods | US Government work, 17 U.S.C. 105 |
| NLM Hazardous Substances Data Bank, through the PubChem PUG-View API | surface tension, viscosity, one static permittivity | US Government work (NLM web policy); only HSDB annotations are used |
| 13 open-access papers (DOI per value; licence read on the article page and in its Crossref record) | water contact angle for 26 materials | CC BY 4.0, attribution kept per value |
| CIE 1931 2° CMFs and CIE D65 (CIE CSV datasets) | colour | CC BY-SA 4.0 (see `data/cie/NOTICE.md`) |

Validation only, never shipped: NIST WebBook water properties (SRD 69, copyright under
the Standard Reference Data Act) and the tissue-light study's tabulations.

## Modules

| File | What it does |
|---|---|
| `materials/__init__.py` | `get(id)`, `by_class(cls)`, `all_materials()`, `shade(id, light, theta)` |
| `materials/optics.py` | Fresnel with complex N (metals and dielectrics alike), GGX microfacet lobe with Smith masking, body term (layer over white ground from k, or the diffusion dipole when scattering is known), `shade(material, light_spd, theta_view)` returning a spectrum |
| `materials/spectral.py` | 380-780 nm grid, CIE 1931 CMFs, D65, illuminant A from its CIE definition, a two-line low-pressure sodium model, XYZ, sRGB, CIELAB |
| `materials/drude.py` | plasma frequency, collision time from DC conductivity, ε(ω), n and k; the Drude-Lorentz model (free electrons plus interband oscillators) |
| `materials/schema.py` | record schema and a stdlib validator |
| `build/fit_drude_lorentz.py` | fits Drude-Lorentz oscillators to measured n, k of seven metals over 380-1000 nm (SciPy at build time only) and scores them against Drude and Rakic et al. 1998 |
| `build/lit_values.py`, `build/add_lit.py` | hand-entered contact angles and HSDB values, each with its source; the Maxwell relation for nonpolar gas permittivity |
| `build/` | fetch scripts, refractiveindex.info YAML evaluator (formulas 1-9 and tables), Wikidata selection with plausibility bounds, assembly, export, page |
| `materials.html` | self-contained gallery: spectral spheres under D65, A or sodium, class filters, property table with sources, cross-section plots of n, k and R |

## Use it

```
python -I -c "import sys; sys.path.insert(0, '.'); import materials as M; print(M.get('gold')['optics']['srgb_preview'])"
python -I -B -m pytest -q -p no:cacheprovider tests
```

The runtime needs only the standard library. The build needs PyYAML to read the
refractiveindex.info YAML once:

```
python -I build/fetch_ri.py <catalog-nk.yml> <study>/downloads/ri <study>/ri_manifest.json
python -I build/fetch_wd.py <study>/downloads/wikidata-3
python -I build/build.py <study>
python -I build/fit_drude_lorentz.py <study>   # then build.py again to attach the fits
python -I build/page.py
```

## Exports

`data/export/materials-export.json` gives each material's SI scalars, n, k and normal
reflectance on the grid, an sRGB preview, and the ids of the laws each property feeds in
the law catalogue (`fresnel_eq`, `drude`, `wiedemann_franz`, `young_laplace`, ...) and
in law space (`snell`, `beerlambert`, `ohm`, `fourier`, `navier`, ...).
`fluids-for-marbling.json` is the liquid slice for the brackish-marbling solver. Null
means unknown; a consumer must not substitute a default without saying so.

## Checks

17 known-answer tests: gold yellow, copper red-orange and redder than gold, silver
neutral (CIELAB windows stated in the test file); glass at n = 1.5 reflects 4.000% at
normal incidence and BK7 data gives 4.2%; Brewster zero; SCHOTT N-BK7 n_d = 1.5168 from
its Sellmeier formula; Drude k rises with conductivity at every wavelength tested and
meets the Hagen-Rubens limit; Drude k for silver within 25% of measured in the red;
water density, heat capacity and index against NIST and IAPWS values; every record
validates; every shipped file has a hash and an open licence; BRDF reciprocity; and
negative controls that must fail. Drude-Lorentz gold puts the reflectance edge (half-height
between 450 and 650 nm, measured 527.9 nm) within 5 nm and R within 0.03 from 450 to 650 nm,
and the best-fit pure Drude model must fail that same test. Drude-Lorentz beats pure Drude on k
for all seven fitted metals. Every contact angle carries a DOI and CC BY 4.0. The page re-derives every conductor's colour from
the spectra in JavaScript and compares it with the Python build.

## Drude-Lorentz

A pure Drude model misses gold and copper, whose colour is interband absorption. Over the
measured points from 380 to 1000 nm, the Drude-Lorentz fit (1 to 4 oscillators, count chosen by
two-fold holdout) brings the RMS relative error in k to 0.3-1.3% for Au, Cu, Ag, Al, Ni, Pt and
Fe, against 1.2-21% for the best-fit pure Drude model. CIELAB error of the gold colour drops
from 20.5 to 0.65. The parameters are effective values for that range, not physical constants;
`data/drude_lorentz.json` lists every error and each parameter that sits on a fit bound.

## Limits

Contact angles of metals are low confidence: a clean metal is wetted, and airborne
hydrocarbons raise the angle within minutes to weeks (13 to 103 deg on the same copper). Young's
modulus has no new open source yet (15 records). Platinum's fit rests on 9 measured points.
Scattering coefficients exist for one record. Woods carry no spectral optics. Most Wikidata
statements carry no reference, so their confidence is low unless a second source corroborates
them. Previews of pigments and tissue are absorption-only and miss the multiple scattering that
sets their real colour.

## Licence

Code: AGPL-3.0-only (`LICENSE`), as commons infrastructure. Each source file carries an SPDX
header; `REUSE.toml` maps the files that cannot. The CIE tables keep CC BY-SA 4.0 with their
NOTICE, and the gallery page credits them. Upstream data keeps its own terms, recorded per field
and per file: CC0 1.0 (refractiveindex.info, physicallybased.info, Wikidata), US Government works
(USDA FPL, NLM HSDB) and CC BY 4.0 (contact-angle papers). Licence texts are in `LICENSES/`.
