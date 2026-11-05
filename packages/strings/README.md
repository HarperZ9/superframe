# strings

**Mission.** Make string theory cheap to check. No experiment at reachable energies has tested string theory, so this package runs the experiments a computer can run: its consistency conditions computed from scratch and scored against known answers, the geometry it needs for compactification, and the extensions that do meet data, such as large extra dimensions against torsion-balance limits on the inverse-square law.

## What it does

| Module | Computes | Known answer it must reproduce |
|---|---|---|
| `zeropoint` | regulated zero-point sums, extrapolated to zero regulator, with two different regulators | zeta(-1) = -1/12, zeta(-1, 1/2) = 1/24, critical dimension 26 (bosonic) and 10 (NS superstring), Ramond zero-point energy 0 |
| `fock` | a sparse Fock-space engine in exact rational arithmetic; Virasoro generators of free bosons, NS fermions, bc and beta-gamma ghosts | central charges 1, 1/2, -26, -2, 1 and 11; the full Virasoro algebra closes on every test state; total c = 0 gives D = 26 and D = 10 |
| `classical` | the classical open string: lattice normal modes, mass and spin from the fields, leapfrog evolution | frequencies n; M^2 from fields equals the mode sum; the rotating rod has J = alpha' M^2 and every other solution has J < alpha' M^2 |
| `tduality` | closed-string spectrum on a circle, the compact-boson partition function in Hamiltonian and Lagrangian form | spectrum at R equals spectrum at alpha'/R; Poisson resummation; modular invariance; 100 extra massless states at the self-dual radius |
| `hagedorn` | exact level degeneracies as big integers and a growth fit | beta_H = 4 pi sqrt(alpha') (bosonic) and 2 pi sqrt(2 alpha') (superstring) |
| `calabiyau` | line-intersection points on the Fermat quintic, Donaldson's T-operator, the balanced metric and its Monge-Ampere error sigma_k; Chern-class and Jacobian-ring algebra | sigma_k falls with k as in Douglas et al. 2006; the Kahler volume stays fixed; chi = -200, h^{2,1} = 101 |
| `extradim` | the Kaluza-Klein tower of n toroidal extra dimensions summed exactly, and again as an image sum; exclusion-curve arithmetic | alpha = 2n (scalar) and 8n/3 (graviton) at lambda = R; 1/r^{1+n} at short range; AHN 2003's M* > 1.7 TeV from their 130 um |

## Run it now

```
python -m pytest -q packages/strings/tests
python -c "import sys; sys.path.insert(0, 'packages/strings'); from stringlab import zeropoint; print(zeropoint.critical_dimensions()['D_bosonic'])"
python -c "import sys; sys.path.insert(0, 'packages/strings'); from stringlab import fock; print(fock.central_charge(fock.SYSTEMS['bc_lambda2'], 3))"
```

The second line prints 26 to about ten digits; the third prints -26 exactly.

## Known-answer tests

`tests/test_known_answers.py` holds 40 tests. Each asserts a closed form or a theorem, and the planted wrong inputs must fail: the unregulated partial sum gives no critical dimension, a sign-flipped fermion generator breaks the Virasoro algebra, a radius 0.1 percent off the dual radius breaks the spectrum match, a 1 percent radius change moves the partition function.

## Limits

- The critical dimension comes from the light-cone intercept and from the central charge. Neither route is a test of string theory against nature; both are consistency conditions the theory must meet.
- `classical` works in conformal and light-cone gauge, where the equations are linear. It does not integrate the Nambu-Goto equations in static gauge.
- `hagedorn` fits the growth of degeneracies; it does not compute a thermal partition function with interactions.
- `calabiyau` is tested on the Fermat quintic only; the Dwork deformation psi reaches the sampler and the tangent frame but has no test yet. Monte Carlo error sets the floor of sigma_k at a given point count. The Euler number comes from Chern-class algebra; a curvature integral over the balanced metric would be the independent numeric route, and it is not written yet.
- `extradim` treats the KK modes as point-mass Yukawa terms between point masses on the brane. Real experiments need the attractor geometry; the exclusion curve itself is data and is not shipped here.
