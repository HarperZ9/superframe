# colour

Colour science libraries. One today.

| Folder | What it does | Licence | From |
|---|---|---|---|
| `build-color/` | Colour math for Python with a command line and an optional desktop workbench: sRGB, Oklab, CIELAB, JzAzBz, ICtCp and wide-gamut RGB conversions, PQ and HLG, twelve tone-mapping operators, CIECAM02 and CAM16, seven Delta E metrics, nine chromatic adaptations, ICC display profiles, `.cube` and CLF LUT files. Needs NumPy only. | MIT | `HarperZ9/build-color@b67fd02a`, version 1.0.2 |

```
python -m pip install -r packages/requirements.txt
python -m pytest -q -p no:cacheprovider --import-mode=importlib packages/colour
```

477 tests. They run with the rest under `npm run test:py`.

## Why a `colour` folder, and why `colourmix` is still beside it

`packages/colourmix` holds three historical colour-mixing systems as BuildLang kernels, each held to a Python reference. `build-color` is a general colour library in Python with its own packaging, command and PyPI project. Putting it inside `colourmix` would have mixed two build systems and two test setups under one name, and `colourmix` runs in CI with a rule that its BuildLang kernels must be present.

So `build-color` sits in a family folder, `packages/colour/`, with its folder name, package name (`build-color`) and import name (`build_color`) unchanged. `colourmix` can move in here later. That is a rename of a package path that CI, the manifest and the BuildLang build name, so it waits for a rename plan.

The two overlap in one place: RGB primaries and transfer curves (`colourmix/bld/rgbspace.bld`, `transfer.bld` against `build_color/spaces.py`). They have not been compared value for value.

## Release

`build-color` is published on PyPI. This move made no release. The PyPI project's links and its trusted publisher still name the old repository and its `publish-pypi.yml` workflow, which did not move. A release from here needs a publish workflow in this repository and the PyPI publisher setting changed to match.

## BuildLang port candidates

`build-color/README.md` lists each module. The numeric core (`spaces`, `adaptation`, `appearance`, `difference`, `tonemap`, `gamut`, `spectral`) comes first: plain array functions with known-answer tests.
