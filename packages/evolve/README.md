# evolve

A small genetic-algorithm engine that treats evolution as a running series of experiments, with every
signal-chain word mapped to a real evolutionary parameter.

## Mission

Life writes a hypothesis (a variant) and runs the experiment (selection) on itself, over and over. This
library makes that loop small enough to measure. Each knob is a parameter a population geneticist would
recognise, each measured quantity has a stated estimator, and the engine has to reproduce two known laws
before any knob result counts: Eigen's error threshold and Kimura's fixation probability.

## Ideals

- **Known answers first.** `tests/test_evolve.py` checks the error threshold, fixation of a new allele,
  the landscapes and the estimators against values fixed in advance.
- **Measured, never set.** Entropy (diversity) and signal (bits about the optimum) are read from the
  population, never dialled in.
- **The true optimum is known.** Landscapes up to 20 sites are searched exhaustively, so "stuck on a local
  optimum" is a fact about each run, not a guess.
- **The limit sits beside the claim.** A toy Wright-Fisher GA on 20 sites is not a real population.

## Knobs

| Word | Parameter | `Config` field |
|---|---|---|
| temperature | mutation rate per site; selection temperature `T_sel = 1 / beta` | `mu`, `beta` |
| gain | selection strength `beta` in `w ~ exp(beta z)` | `beta` |
| loss | drift through population size; extinction events (90% die) at rate `cull` | `N`, `cull` |
| attack | ramp-in time for a new mutant's fitness change | `attack` |
| reverb | elite archive echoed back at share `echo`, decay time `tau` | `tau`, `echo` |
| weight | fitness | `Landscape` |
| geometry | NK ruggedness K, smooth, deceptive trap | `landscapes.make` |
| static / dynamic | XOR-mask drift: random walk or seasonal | `drift.Drift` |
| analog / digital | real-valued genome with Gaussian mutation, or bits | `genome`, `sigma` |
| forecasting | ridge surrogate pre-screens offspring; additive, so keep it to additive landscapes (F101 H3) | `surrogate` |
| entropy, signal | measured by `info.diversity`, `info.signal` | |

## Use

```python
import numpy as np
from evolve import engine, landscapes, drift

rng = np.random.default_rng(1)
land = landscapes.make("nk4", 20, rng)
cfg = engine.Config(mu=2 / 20, beta=2.0, target=land.quantile_value(0.9999))
r = engine.run(land, cfg, rng, drift.Drift(20, "random", period=10, rng=rng))
print(r["T"], r["offline"], r["entropy"], r["signal"])
```

Tests: `python -I -B -m pytest -p no:cacheprovider tests`

## Measured results

The 2026-10-29 preregistered study that uses this engine is in
`the private study 2026-10-29-evolution-engine` (PREREG.txt, result.json, desk.html).
