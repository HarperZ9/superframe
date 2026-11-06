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
| `cosmicstrings` | the gravitational-wave background of a cosmic-string or superstring network: LambdaCDM with Standard Model degrees of freedom, the VOS long-string network, the loop number density, and the sum over loop harmonics; intercommutation probability P scales the loop density | VOS scaling xi = 0.271, v = 0.662 (radiation); loop density 0.17 against the simulated 0.18; the radiation plateau (128 pi / 9) B sqrt(G mu / Gamma); I_k(f) = I_1(f/k) |
| `pta` | a spectrum against pulsar-timing data by refitting a published free spectrum, plus the LVK O3 flat-spectrum limit; credible intervals, highest-density limits and the K ratio | the rho conventions of the power-law and Omega routes agree; a Gaussian free spectrum gives its own Gaussian likelihood |
| `curvature` | the Chern connection and curvature of a Kahler metric by finite differences, the top Chern form, and the Euler number by Monte Carlo; the quintic in fixed charts | chi(CP^1, CP^2, CP^3) = 2, 3, 4 to 1e-6; a sign-flipped curvature gives -4; chi(quintic) = -200 within Monte Carlo error from the Fubini-Study metric |
| `stringbursts` | the LIGO-Virgo-KAGRA burst recipe: cusps, kinks and kink-kink collisions on BOS (model A) loops, the decay constant Gamma_d(N_k) and Omega_gw summed over bursts | in pure radiation the burst sum meets the energy bound (128 pi / 9) 0.18 sqrt(G mu / Gamma_d) to 2e-3 for N_k = 0, 1, 100 |
| `lvk` | a spectrum against a published LIGO-Virgo cross-correlation spectrum C(f), sigma(f): Gaussian likelihood with optional calibration marginalisation, log-log projection, power-law and G mu upper limits | zero signal gives ln L = 0; the noise-only power-law limit matches direct quadrature |
| `kkcircle` | one periodic dimension: the Kaluza-Klein mass ladder, the charge ladder from seam changes, field-strength invariance, and the closed string's w = 0 sector via `tduality` | R = 2 l_P / sqrt(alpha) = 23.4 Planck lengths and first rung 5.21e17 GeV (Behiel's numbers, Bailin and Love); masses n / R with double rungs; charge n exactly; F unchanged by seam changes |
| `surfaces` | one graph drawn on the plane, cylinder, Moebius strip, torus and Klein bottle (identified squares as deck groups), crossing counts, an annealing search | Euler bounds reject K5 and K3,3 in the plane; explicit crossing-free K5 on the torus and K3,3 on the Moebius strip; the same drawing on the unflipped cylinder crosses |

## Run it now

```
python -m pytest -q packages/strings/tests
python -c "import sys; sys.path.insert(0, 'packages/strings'); from stringlab import zeropoint; print(zeropoint.critical_dimensions()['D_bosonic'])"
python -c "import sys; sys.path.insert(0, 'packages/strings'); from stringlab import fock; print(fock.central_charge(fock.SYSTEMS['bc_lambda2'], 3))"
```

The second line prints 26 to about ten digits; the third prints -26 exactly.

## Known-answer tests

`tests/test_known_answers.py`, `tests/test_cosmic_and_curvature.py` and `tests/test_bursts_and_lvk.py` hold the known-answer tests. Each asserts a closed form or a theorem, and the planted wrong inputs must fail: the unregulated partial sum gives no critical dimension, a sign-flipped fermion generator breaks the Virasoro algebra, a radius 0.1 percent off the dual radius breaks the spectrum match, a 1 percent radius change moves the partition function.

## Limits

- The critical dimension comes from the light-cone intercept and from the central charge. Neither route is a test of string theory against nature; both are consistency conditions the theory must meet.
- `classical` works in conformal and light-cone gauge, where the equations are linear. It does not integrate the Nambu-Goto equations in static gauge.
- `hagedorn` fits the growth of degeneracies; it does not compute a thermal partition function with interactions.
- `calabiyau` is tested on the Fermat quintic only; the Dwork deformation psi reaches the sampler and the tangent frame but has no test yet. Monte Carlo error sets the floor of sigma_k at a given point count. The Euler number comes from Chern-class algebra in `calabiyau` and from the curvature integral in `curvature`.
- `cosmicstrings` uses one loop-production model (VOS with F = 0.1, alpha_L = 0.37, Gamma = 50) and a pure power-law emission spectrum per loop; superstrings enter only through a P^-beta rescaling, the convention of the NANOGrav analysis, since no superstring network simulation exists to calibrate it.
- `stringbursts` follows the LVK text; its g1 for kinks is the closed form 0.2565 unless the caller passes the 0.29 the LVK text quotes, and the radiation-era loop density can be taken in t-form or in the z-form printed in the Supplemental Material.
- `pta` refits published per-bin densities; it is not a full pulsar-timing likelihood, and the LVK comparison uses the flat-spectrum limit at 25 Hz only.
- `extradim` treats the KK modes as point-mass Yukawa terms between point masses on the brane. Real experiments need the attractor geometry; the exclusion curve itself is data and is not shipped here.
