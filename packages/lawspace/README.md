# lawspace

**Mission.** Make it cheap to change a law of physics by a knob and see, with a check you can rerun, where behaviour changes. Every law sits at epsilon = 0 with its known result reproduced first. Changing the law finds the mathematics of that rule-space. It says something about our world only when a result predicts a measurement here, and that claim needs its own test.

## What it does

- **Registry** (`lawspace/registry.py`): each law is a knob with a continuous deformation epsilon, its units, its anchor, the grade of the source (FETCHED, SNIPPET or MEMORY) and the expected behaviour. Covered: force exponent, dimension (Gauss line), Lenia mu and sigma, the temperature of water's density maximum, ice density, the diffusion exponent, the Ising coupling, body size against the capillary length, Kleiber's exponent (recorded only), the energy leak, reversal noise, the demon bias, ground-state degeneracy, and the logistic map as a calibration wall.
- **Wall finder** (`lawspace/walls.py`): give it a law, a bracket and a yes/no observable. It bisects on replicate majorities, samples around the estimate, fits a logistic curve and returns epsilon*, a 95% interval and the transition width.
- **Solvers**: `orbits` (apsidal angle by quadrature, stability, leapfrog with leak and noise), `lenia` (batched FFT, conserved-mass option), `lake` (enthalpy column with switchable equation of state), `diffusion` (CTRW, Brownian, Levy walk, polarization transplant), `scaling` (fGn, binomial cascade, MFDFA, self-affine surfaces, dynamic exponent, square-cube, Bond and Reynolds numbers), `ising_rg` (Swendsen-Wang and block spins), `thermo` (three bodies, reversible soft-disk gas, Szilard ledger, Maxwell's demon, two-level and Einstein solids), `logistic`.

## Run it now

```
cd packages/lawspace
python -m pytest -q tests
python -c "from lawspace import registry, walls; import numpy as np; L = registry.BY_NAME['dimension']; print(walls.find_wall(L.observe, *L.bracket, np.random.default_rng(0), reps=1, tol=5e-4))"
```

The second line finds Ehrenfest's wall: circular orbits under the d-dimensional Gauss-law force lose stability at d = 4.

## Known-answer tests

`tests/test_known_answers.py` checks closed forms and theorems: the near-circular apsidal angle pi / sqrt(3 - n), Bertrand's closure at n = 2 and -1, the stability boundary at n = 3, the logistic doubling at r = 3, a planted logistic wall, the Lenia kernel and growth peak, floating against sinking ice, Stefan's law, Brownian MSD and Gaussian kurtosis, the binomial cascade spectrum width, fGn's Hurst exponent and narrow spectrum, per-direction Hurst exponents of a self-affine surface, the capillary length, the Ising fixed point near Onsager's Kc, the zeroth law and its transitivity, Szilard's kT ln 2, the third-law closed forms against level sums and residual entropy ln g, Loschmidt return without noise and its failure with noise, and the demon's record paying for its entropy drop.

## Limits

- One body in a central force moves in a plane, so dimension enters orbits only through the force exponent.
- The lake omits snow, solar penetration, salinity and wind, and uses one reference density for heat capacity.
- Lenia creatures here are grown from random sparse soups; the published Orbium cell pattern is not bundled.
- On a square lattice the self-affine estimate reads high in the rougher direction, and breaks down past an exponent ratio near 1.7.
- The demon's record entropy is an i.i.d. estimate from the decision frequencies.
