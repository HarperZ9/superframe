# formulas

Small formulas that beat the version they replace on held-out data, each with its tests.

## Mission

Keep a formula only after it has earned its place. Each one here was preregistered against the version
it replaces, chosen on development data, and scored once on data it was not tuned on. The ones that
failed stay in the record (FINDINGS.md, round 1) and do not appear here.

## Ideals

- **Held out or it does not count.** A gain measured on the data that chose the formula is not a gain.
- **Name the old version.** Each module says what it replaces and by how much, on which benchmark.
- **The limit sits beside the claim.** Every benchmark below is our own simulated or archived data, so a
  pass is an improvement for that benchmark only.

## Contents

| Module | Replaces | Held-out result (round 1, 2026-10-29) |
|---|---|---|
| `bounds.violations` | F79's per-test Wald rule for "an arm beat its bound" | Wald flagged any test in 81% of all-null families on average (up to 100%). Exact binomial p with Holm: at most 5.2% across 45 configurations (tolerance 6.0%), 4.0% in a 756-test family; mean power 0.85 for exceedances 5 SE above the bound |
| `twolines_guard.two_lines_guarded` | goldilocks `twolines.two_lines` (F49) | false U on a fall to an exact floor: 37.7% to 0.0% (continuous), 36.0% to 0.0% (binary); linear, concave and log-trap rates unchanged (0.2% to 1.2%); planted U power 1.00 in both |
| `shareability.shareability` | Fano bound on the exact lens overlap (F79) | MAE to learned referential accuracy on 168 fresh lens pairs: 0.155 to 0.035 (gain 0.121, 95% CI 0.104 to 0.139), from 400 sampled objects and no lens model |

Read the shareability row with its limit: a straight line fitted to the Fano bound on the development
pairs reached MAE 0.029 on the same test pairs, and the exact overlap ranks learned accuracy slightly
better (Spearman 0.966 against 0.933). The estimator wins where the lens definitions are not available.

## Use

```python
from formulas.bounds import violations
flags, p = violations(k=[1082, 1300], n=4000, bound=[0.25, 0.25])          # Holm by default

from formulas.twolines_guard import two_lines_guarded
res = two_lines_guarded(x, y)          # res["u"], res["robin_hood"], res["guard"]

from formulas.shareability import shareability
acc = shareability(cells_a, cells_b, K=4)   # (n, dA) and (n, dB) integer cells of the same n objects
```

Tests (about 10 s): `python -B -m pytest -q -p no:cacheprovider tests`

## Provenance

- `formulas/units/twolines.py` is the goldilocks unit copied verbatim (sha256 9875b29f...1c61e5); a test
  checks the hash against the copy and the source.
- Study, preregistration and result: the formula-round1 study of 2026-10-29 (author's study records) (PREREG sha256
  e86e7bdf...4f35, run 20261030T025631Z). A patch proposing `bounds` as a studyrun unit is
  `studyrun-bounds.patch` there; studyrun itself is unchanged.

## Does not prove

That these formulas improve anything outside these benchmarks. Shareability was tested only on F79's
toy lenses with independent uniform features. The two-lines guard was tested on shapes we planted. The
bound rule's calibration assumes independent binomial trials.
