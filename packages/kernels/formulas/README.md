# formulas

Small scalar formulas held to one contract: an f-number, an Airy radius, a Wilson interval. Each one has a
stable id, units on every input and output, a stated valid range with a refusal outside it, a stated loss
(what the formula ignores), a slow reference, a BuildLang body that must give the same bytes, a known
answer from a source that was opened, a property test and planted-bad controls that the checks must catch.

```
from formulas import call
call("optics.airy_radius/1", wavelength=(550e-9, "m"), f_number=(2.0, "1"))
# {"radius": (1.3416368803931549e-06, "m")}
call("optics.f_number/1", focal_length=(0.05, "m"), aperture_diameter=(None, "m"))
# Refusal(input="aperture_diameter", value=None, range="required, finite and > 0, in m")
```

A kernel never returns a default, a NaN or a clipped value in place of an answer. A missing input, a wrong
unit or a value outside the range returns a `Refusal` that names the input, the value and the range.

## Run the checks

```
python -B kernels.py formulas            # from packages/kernels: every check, and kernels.json updated
python -B -m formulas.check              # the same checks, nothing written
FORMULAS_REQUIRE_NATIVE=1 python -m pytest packages/kernels/tests/test_formulas.py
```

The BuildLang bodies are built with `buildc` (the `BUILDC` variable, else `buildc` on `PATH`) and a C
compiler (`CC`, else `gcc`, `cc` or `clang`), with floating-point contraction off, and called through
ctypes. Where no compiler is present the tests of the compiled bodies skip with the reason; with
`FORMULAS_REQUIRE_NATIVE` set they fail instead. CI sets it, at the pinned buildlang commit.

## Layout

| Path | What it holds |
|---|---|
| `core.py` | the refusal, the range tests, the unit-checked `call` and bit comparison |
| `check.py` | runs each kernel's checks on the reference, on every planted-bad control and on the BuildLang body; compares the body with the reference on a grid of good and bad inputs |
| `native.py` | builds every `kernel.bld` into one shared library and wraps each export |
| `<field>_<name>/reference.py` | `SPEC`, the reference, `GRID`, `checks()` and `PLANTED` |
| `<field>_<name>/kernel.bld` | the BuildLang body; absent where a compiler feature is missing, and then `SPEC["bld_pending"]` names it |

## Kernels

| Id | Registry row | Formula | Mode |
|---|---|---|---|
| `optics.f_number/1` | OPT-007 | N = abs(f) / D | bit-identical |
| `optics.airy_radius/1` | OPT-008 | r = (j(1,1) / pi) lambda N | bit-identical |
| `physics.beverloo_rate/1` | PHY-006 | W = C rho_b sqrt(g) (D - k d)^(5/2) | bit-identical |
| `colour.srgb_transfer/1` | COL-001 | IEC 61966-2-1 curve, decode and encode | bit-identical |
| `colour.xyz_to_cielab/1` | COL-003 | CIE 1976 L*a*b* with e = 216/24389, K = 24389/27 | bit-identical |
| `stats.wilson_interval/1` | STA-001 | Wilson score interval, exact at k 0 and k n | bit-identical |
| `stats.benjamini_hochberg/1` | STA-002 | adjusted p = running min of p (m / rank); reject at adjusted <= q | bit-identical |
| `stats.spearman/1` | STA-008 | Pearson correlation of mid-ranks | bit-identical |
| `stats.auroc/1` | STA-007 | Mann-Whitney AUC, ties count one half | bit-identical |
| `chron.radiocarbon_calibrate/1` | CHR-001 | normal likelihood of the age about the interpolated curve, errors in quadrature; density and highest-density regions on a stated grid | bit-identical |

`kernels.json`, section `formulas`, holds one entry per kernel with its units, ranges, loss, known
answers, properties, controls, provenance and the last check result. A test fails when that section and
the specs in this folder disagree.

## Radiocarbon calibration and its curve

`chron.radiocarbon_calibrate/1` takes the curve as three arrays, so the kernel never holds a curve of its own.
`calibrate(age, error, curve="intcal20")` in `chron_radiocarbon_calibrate/reference.py` loads a curve by id,
checks its SHA-256 against `curves.py`, builds a 1-year grid around the age and returns the density, the 68.3
and 95.4 percent regions as intervals, and the curve's hash:

```
python packages/kernels/formulas/chron_radiocarbon_calibrate/curves.py fetch intcal20
from formulas.chron_radiocarbon_calibrate.reference import calibrate
calibrate(7505, 93, levels=(0.682, 0.954))["outer"]
# [(8515.0, 8500.0, 0.008...), (8457.0, 8162.0, 0.897...), (8137.0, 8116.0, 0.010...), (8102.0, 8039.0, 0.039...)]
```

intcal.org states no terms of use for its curve files, so the file is fetched and hash-checked, not stored
here (`curves/` is ignored by git). CI fetches it before the tests. An age outside the 14C ages the curve spans
is refused, as is a grid whose ends still carry density.

## Export shape

Every export takes its inputs in the order the spec lists them, then a pointer to the outputs, and returns
0 when it accepted the call or the 1-based index of the refused input. A scalar input is an f64. An input
named in `SPEC["array_inputs"]` is a pointer to f64 and an i64 length. Outputs are laid end to end. An output
named in `SPEC["array_outputs"]` has the length of the array input it names, and comes back as a tuple. A refused call writes no
output. The wrapper in `native.py` checks both rules on every call.
