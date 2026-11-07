# cosmo

**Mission.** The core of the universe simulator: dark matter in an expanding periodic box, evolved under gravity from the early universe to today, with every piece scored against a known answer before any result is read from it.

`cosmolab` is a particle-mesh (PM) N-body solver. It lays particles on a lattice, displaces them with Zel'dovich initial conditions drawn from a linear power spectrum, and integrates them in comoving coordinates with kick-drift-kick steps in the scale factor. Gravity comes from a cloud-in-cell density on a mesh and an FFT Poisson solve. The same code runs on the CPU (numpy and scipy.fft, three threads) or on CUDA through torch.

## Run it now

```
python -m pytest -q packages/cosmo/tests
python packages/cosmo/study/run_pk.py --n 128 --box 256 --backend numpy          # CPU, about 5 minutes
python packages/cosmo/study/run_pk.py --n 256 --box 256 --deconvolve 2 --backend torch   # GPU, about 16 s
python packages/cosmo/study/plates.py out/cosmo/pk_n256_L256_torch-cuda_dc2_s55.npz --out out/cosmo
python packages/cosmo/study/run_pk.py --n 256 --box 256 --deconvolve 2 --backend torch --order 2   # 2LPT start
python packages/cosmo/study/score_runs.py out/cosmo/*.npz      # bands against halofit and the emulator
```

## What it does

| Module | Computes | Known answer it must reproduce |
|---|---|---|
| `background` | flat LambdaCDM E(a), linear growth D(a) by the Heath integral and by the growth ODE, f(a), kick and drift factors | the two D(a) routes agree to 2e-12; D = a in Einstein-de Sitter; f(1) within 1 percent of Omega_m^0.55; the factors equal their closed forms in Einstein-de Sitter |
| `linear` | Eisenstein and Hu (1998) transfer function with baryon oscillations, top-hat sigma(R), sigma8 normalisation | within 3.9 percent of CAMB's linear P(k) from 1e-3 to 10 h/Mpc; a baryon-free planted spectrum misses by over 10 percent |
| `halofit` | nonlinear P(k) with the Takahashi et al. (2012) coefficients | within 3e-4 of CAMB's halofit (version takahashi) at z = 0 and z = 1, fed CAMB's linear P(k) |
| `ewald` | the periodic force of a point mass with a neutralising background (Hernquist, Bouchet and Suto 1991) | zero force at the symmetry points; Newton at short range; independent of the splitting parameter to 1e-11 |
| `pm` | cloud-in-cell deposit, Poisson solve with a four-point finite-difference gradient, cloud-in-cell readback, kick-drift-kick | see the table below |
| `ic` | Zel'dovich and second-order Lagrangian (2LPT) displacements and momenta, fixed-amplitude option (Angulo and Pontzen 2016), the plane-wave pancake | the pancake's analytic positions; the exact second-order displacement of a planted two-mode field, and its growth in the solver |
| `power` | P(k) with window deconvolution and the cloud-in-cell shot noise of Jing (2005) | zero power for Poisson particles within 4 sigma |
| `backend` | numpy or torch-CUDA behind one interface; the CUDA deposit sums 64-bit integers so runs repeat bit for bit | CUDA accelerations equal numpy's to 1e-4 (float32); three CUDA runs give one sha256 |
| `reference` | the Mira-Titan IV Cosmic Emu and CAMB tables in `data/`, and the k-band scoring | the emulator table within 3.7 percent of CAMB's halofit from k = 0.01 to 5 h/Mpc |
| `topology` | Laplacian eigenmodes of the flat 3-manifolds E1 to E6 with unequal sides, by grid and by COMPACT's selection rules | every eigenvalue and multiplicity of all six agree; four planted misidentifications fail |

## Solver checks (tests/test_pm_known_answers.py)

| Check | Result | Planted wrong input |
|---|---|---|
| Point-mass force against the Ewald sum, 64^3 mesh | rms error 0.92 percent at 4 to 8 cells, 0.21 percent at 8 to 16, 0.09 percent beyond 16 | open-space Newton misses the periodic answer by 21 percent beyond 16 cells |
| Zel'dovich pancake, 32^3 particles, 64^3 mesh, a = 0.1 to 0.9 (crossing at 1) | largest position error 0.73 percent of the largest displacement; momenta within 1.3 percent; zero motion across the wave | a Poisson source 10 percent too weak gives 9.0 percent |
| Total momentum after 30 steps | 1.2e-15 of the summed magnitudes (3.6e-17 with full deconvolution) | nearest-grid-point readback gives 2.9e-3 |
| Growth of the measured P(k) on the two longest shells, a = 0.02 to 1 | P1 / P0 / (D1 / D0)^2 = 1.006 and 1.026 at a = 1 (k = 0.005 and 0.009 h/Mpc) | Einstein-de Sitter growth is off by 37 to 38 percent |

## The matter power spectrum against halofit

Three 256^3 boxes, 256 Mpc/h, 512^3 mesh, both cloud-in-cell windows divided out of the Green's function, 55 steps from z = 49, fixed-amplitude initial conditions with three phase seeds, Planck 2015 cosmology. Ratio of our P(k) to halofit on the same linear spectrum, mode-weighted mean in each band, with the range across the three boxes:

| k (h/Mpc) | z = 1 | z = 0 |
|---|---|---|
| below 0.1 | 1.005 (0.995 to 1.018) | 0.990 (0.974 to 1.006) |
| 0.1 to 0.3 | 1.003 (0.997 to 1.006) | 0.968 (0.961 to 0.974) |
| 0.3 to 0.5 | 0.997 (0.992 to 1.005) | 0.966 (0.939 to 0.984) |
| 0.5 to 1 | 0.977 (0.968 to 0.983) | 0.948 (0.921 to 0.965) |
| 1 to 2 | 1.000 (0.991 to 1.005) | 0.915 (0.899 to 0.926) |

Takahashi et al. quote halofit as good to 5 percent below k = 1 h/Mpc and 10 percent from 1 to 10 h/Mpc. Every band but z = 0, 0.5 to 1 (mean 5.2 percent low) sits inside that, so inside it this comparison cannot separate our error from halofit's. The z = 0 deficit of 3 to 5 percent from k = 0.1 to 1 has the same sign in all three boxes; a 256 Mpc/h box lacks longer modes and that lowers P(k) there, but this run does not isolate the cause. Doubling the step count (145 steps) moves no band by more than 0.6 percent.

Wall time for 55 steps: 15.8 s on an RTX 4090 for 256^3 (torch, float32, peak 4.6 GB), 1.8 s for 128^3; 284 s for 128^3 on the CPU (numpy, 3 FFT threads). GPU energy from NVML's counter over the step loop: 3.8 kJ per 256^3 run, 350 J per 128^3 run.

## The z = 0 deficit, rescored against an emulator

Round one read the z = 0 power 5.2 percent below halofit at k = 0.5 to 1 h/Mpc. Halofit is a fit; the Mira-Titan IV Cosmic Emu (Moran et al. 2023, MNRAS 520, 3443) is trained on 111 simulations of (2.1 Gpc)^3 with 3200^3 particles, and its authors quote two to three percent accuracy. `study/make_cosmicemu_reference.py` transcribes the emulator's C code into numpy and reads its published coefficient file as data; the table is `data/cosmicemu_reference.json`. On our cosmology the emulator sits 2 to 3 percent below halofit from k = 0.2 to 2 h/Mpc at z = 0.

Mode-weighted band mean of P / emulator at z = 0, mean of three phase seeds (range across seeds):

| Configuration | 0.1 to 0.3 | 0.3 to 0.5 | 0.5 to 1 | 1 to 2 |
|---|---|---|---|---|
| Zel'dovich ICs, 256 Mpc/h, 256^3 (round one) | 0.988 (0.981 to 0.994) | 0.991 (0.963 to 1.009) | 0.972 (0.945 to 0.990) | 0.934 (0.918 to 0.944) |
| 2LPT ICs, same boxes and phases | 0.997 (0.990 to 1.003) | 1.007 (0.978 to 1.025) | 0.993 (0.966 to 1.010) | 0.951 (0.937 to 0.960) |
| Zel'dovich, 128 Mpc/h, 128^3 (same mass resolution, half the box) | 0.969 (0.932 to 0.998) | 0.960 (0.853 to 1.045) | 0.932 (0.839 to 1.020) | 0.911 (0.840 to 0.949) |
| Zel'dovich, 256 Mpc/h, 128^3, one window (coarse) | 1.007 (0.984 to 1.047) | 0.980 (0.962 to 1.012) | 0.924 (0.879 to 0.960) | 0.779 (0.748 to 0.800) |
| Zel'dovich, 512 Mpc/h, 256^3, one window (coarse, twice the box) | 0.995 (0.990 to 1.002) | 0.983 (0.973 to 0.990) | 0.939 (0.925 to 0.949) | 0.781 (0.772 to 0.792) |

What survives:

- The reference explains most of it. Against the emulator the round-one deficit at 0.5 to 1 is 2.8 percent, inside the emulator's quoted accuracy.
- Second-order ICs remove about 2 percent more from k = 0.1 to 2 h/Mpc: the Zel'dovich start at z = 49 leaves a transient that has not decayed by z = 0. With 2LPT every band to k = 1 is within 0.7 percent of the emulator on the seed mean.
- Box size is a small effect here. At fixed coarse resolution, doubling the box raises the 0.5 to 1 band by 1.5 percent, inside the smaller box's seed range. The 512 Mpc/h box at the primary resolution (512^3 particles, 1024^3 mesh) needs about 10 GB and was not run on the shared GPU. The half-size box at the primary resolution points the same way, with a seed range too wide to measure it.
- Above k = 1 the shortfall is force resolution: coarse boxes lose 22 percent at 1 to 2, fine boxes 5 to 7.

At z = 1 every band to k = 1 sits within 1.5 percent of the emulator for both IC orders; with 2LPT the 1 to 2 band reads 2.9 percent high, where full window deconvolution overshoots. Dividing out each code's own linear spectrum instead (P / P_lin(Eisenstein-Hu) over emulator / P_lin(CAMB), `emu-boost` in `score_runs.py`) moves bands by up to 2 percent. The emulator's own large-scale P(k) sits 1.4 percent below CAMB's linear one, so that route carries a percent-level offset of its own.

## Second-order initial conditions (tests/test_lpt2_determinism.py)

For delta = A cos(k1 x) + A cos(k2 y) the second-order potential is known in closed form; the code's grad phi2 matches it to 1e-15 relative, and a single plane wave gets none. In the solver, a 32^3 box started at a = 0.2 with A = 0.2 and run to a = 1 carries the second-order displacement pattern with coefficient 1.008 D2(a). A Zel'dovich start gives 0.66 (the transient decays only as a_i / a), and a planted sign flip gives 0.30. The coefficient rises as A^2 (1.003 at A = 0.1, 1.032 at 0.4): fourth-order terms.

## Bitwise repeat runs

CUDA float atomics add in a different order each run. Five 64^3 runs with them gave five sha256 hashes of the final positions and momenta; with the integer deposit, three runs give one, and two 256^3 2LPT runs of 55 steps give the same hash. The integer path costs nothing measurable: 16.3 to 16.7 s per 256^3 run against 18.9 s for the float run, on a shared GPU, so that comparison is loose. Zel'dovich bands with the integer deposit equal round one's to three decimals.

## Topology: E1 to E6 (tests/test_topology.py)

A flat universe can close up on itself in six orientable ways: the 3-torus E1, and five twisted versions where crossing one face turns space by a half (E2), quarter (E3), third (E4) or sixth (E5) turn, or the Hantzsche-Wendt space E6 with three half turns. `topology` builds each from its generators alone: a finite-difference Laplacian on the covering torus, restricted to the functions the group leaves unchanged. Its spectrum is compared with COMPACT's allowed modes (Eskilt et al. 2024, JCAP 03, 036) passed through the same stencil, on boxes with unequal sides.

- All six agree in every eigenvalue (to 1e-8) and every multiplicity, 28 to 137 modes each.
- Planted misidentifications fail: E2 read as its covering torus, E3 as E2, E4 as E5, E6 as its covering torus.
- The continuum limit holds: E6's lowest ten eigenvalues miss |k|^2 by 10.9 percent on a (10, 12, 8) grid and 3.2 percent on (20, 24, 16).
- COMPACT's eq. 4.62, as printed in the arXiv text, lists n and -n separately for E6's axis modes (n1 in 2Z, n1 not 0). The two give the same eigenfunction, and the grid carries one: 38 modes below the cut where the printed sets give 42. The collaboration's CMBtopology code loops over positive even n only, which agrees with the grid.

This is a capability test. Nothing here says which topology our universe has. Luminet et al. (2003, Nature 425, 593) proposed the spherical Poincare dodecahedral space, which is not one of these flat cases and is not built here.

## Limits

- PM resolves forces to about two mesh cells; inside that, halos are too soft, and P(k) falls below halofit past k of about 2 h/Mpc for this set-up.
- Full window deconvolution (`deconvolve=2`) is unstable at coarse mass resolution: 128^3 particles in 256 Mpc/h overshoot halofit by 5 to 67 percent. One window (`deconvolve=1`) keeps that run within 3 percent below k = 0.5 at z = 0, and plain PM (the default, 0) is stable but low at high k. The 256^3 numbers above use 2.
- On a 32^3 lattice under a 64^3 mesh, modes above a tenth of the particle Nyquist grow faster than linear theory (2.6 percent at k = 0.14 k_Ny over the full run, falling with particle number). This is lattice discreteness; the growth test reads only the two longest shells.
- Radiation and neutrinos are left out of the background. The 2LPT growth factors use the Bouchet et al. (1995) fits.
- The emulator and CAMB tables cover the default cosmology only. Topology runs on eigenmodes; the N-body box itself is still a cubic E1.
- The linear spectrum is a fit, within 3.9 percent of CAMB. CAMB is used only to write `data/camb_reference.json` (study/make_camb_reference.py); nothing imports it at run time.
- No halo finder, no hydrodynamics, no lightcone.
- Block-step and 512^3 runs need CUDA; the CPU engine (`stepping.NumpyEngine`) is for tests at 16^3 to 32^3.

## Round three: short-range force, CAMB input, gravity in twisted boxes

```
python packages/cosmo/study/run_pk.py --n 256 --box 256 --backend torch --order 2 --p3m --steps-late 360 --steps-log 60
python packages/cosmo/study/run_pk.py --n 256 --box 256 --backend torch --order 2 --p3m --steps-late 360 --steps-log 60 --linear camb
python packages/cosmo/study/run_twisted.py --out out/cosmo/twisted
python packages/cosmo/study/plates_round3.py --runs LABEL=a.npz,b.npz,c.npz --camb EH=a.npz,b.npz CAMB=c.npz,d.npz --twisted out/cosmo/twisted/twisted_e3.npz
```

### P3M

`pm.P3MSolver` splits gravity with a Gaussian of scale r_s (Springel 2005, MNRAS 364, 1105). The mesh carries the long-range part, Phi_k times exp(-k^2 r_s^2), with both cloud-in-cell windows divided out and a spectral gradient. `shortrange` adds the pair force -G m d / r^3 [erfc(u) + 2u/sqrt(pi) exp(-u^2)], u = r / 2 r_s, inside r_cut. Defaults follow Gadget-2's split: r_s = 1.25 mesh cells, r_cut = 4.5 r_s. Plummer softening (1/30 of the particle spacing in the runs) enters potential and force through rho = sqrt(r^2 + eps^2), so the force stays the gradient of the potential.

Why P3M and not a tree: the short-range sum is exact inside r_cut, with no opening-angle error, so the split can be scored against Ewald with nothing else in the way; and a chaining mesh maps onto one GPU thread per particle. Its cost grows with clustering. At 256^3 particles it stayed under 3 minutes per run.

The CUDA pair kernel is our own CUDA C. It is compiled at run time by the nvrtc library that torch's CUDA wheels already ship and launched through the driver API with ctypes (`cudajit`), so no compiler or extra package is needed. Each thread owns one particle and adds its neighbours in a fixed order with no atomics, so runs repeat bit for bit. The CPU path uses scipy's periodic k-d tree, and the CI tests run it.

| Check (tests/test_p3m.py) | Result | Planted wrong input |
|---|---|---|
| Two-body force, mesh plus pair, against Ewald, 64^3 mesh, rms by separation | 0.003 / 0.10 / 0.55 / 1.3 / 0.9 / 0.23 / 0.06 percent at 0-0.5 / 0.5-1 / 1-2 / 2-4 / 4-8 / 8-16 / 16+ cells; largest single error 2.7 percent | pair side with r_s 30 percent too large: 19 percent rms at 2-4 cells |
| Layzer-Irvine: a(K + W) plus the integral of K da stays constant, 16^3 particles, z = 19 to 0, 160 steps | largest drift 1.9 percent of a W (24^3 prototype: 1.1 percent with 240 steps, 3.2 percent with 120) | dynamics without the pair force, energy with it: 37 percent |
| Pair sum antisymmetry, 3000 particles | net force under 1e-13 of the summed magnitudes | |
| CUDA kernel against the CPU sum, clumped particles | 6.5e-6 relative (float32); two calls bitwise equal | |

Step count matters far more than for PM. For 128^3 particles in 128 Mpc/h at z = 0, the k = 3-5 band reads 0.61 of the emulator with 55 steps, 0.92 with 210, 0.937 with 420 and 0.939 with 840. Runs use 420 steps (60 in ln a to a = 0.1, then 360 linear in a). Doubling to 840 in a 256^3, 128 Mpc/h box moves no band by more than 0.8 percent.

Mode-weighted P / Cosmic Emu at z = 0, 2LPT ICs, mean of three phase seeds (range):

| Configuration | 0.1-0.3 | 0.3-0.5 | 0.5-1 | 1-2 | 2-3 | 3-5 |
|---|---|---|---|---|---|---|
| PM, round two, 256^3, 256 Mpc/h | 0.997 (0.990-1.003) | 1.007 (0.978-1.025) | 0.993 (0.966-1.010) | 0.951 (0.937-0.960) | 0.855 (0.846-0.860) | 0.674 (0.666-0.678) |
| P3M, 256^3, 256 Mpc/h | 0.995 (0.985-1.002) | 1.002 (0.971-1.025) | 0.986 (0.957-1.004) | 0.975 (0.956-0.988) | 0.945 (0.935-0.956) | 0.916 (0.911-0.925) |
| P3M, 256^3, 128 Mpc/h | 0.951 (0.920-0.970) | 0.912 (0.873-0.967) | 0.920 (0.857-0.992) | 0.937 (0.876-1.005) | 0.961 (0.902-1.022) | 0.954 (0.913-1.005) |

- The short-range force lifts 1-2 h/Mpc from 4.9 to 2.5 percent low, inside the emulator's quoted 2-3 percent on the seed mean, and 2-3 h/Mpc from 14.5 to 5.5 percent low.
- k = 3-5 lies past the particle Nyquist frequency (pi h/Mpc) of the 256 Mpc/h box. The 128 Mpc/h box has eight times the mass resolution (Nyquist 2 pi) and reads 4.6 percent low there, but every band of that box sits 4 to 9 percent low, the longest included, with seed ranges up to 13 percent. A 128 Mpc/h box lacks the long modes, and its few long modes set each seed's nonlinear power; round two's 128 Mpc/h PM boxes showed the same deficit. Above k = 3 this round has no measurement inside the emulator's accuracy.
- z = 1 reads low at high k: P3M in 256 Mpc/h gives 0.954 at 0.5-1 and 0.935 at 1-2, where round two's PM gave 1.012 and 1.029 (full window deconvolution overshoots). The 128 Mpc/h box gives 0.957 and 0.955. Mass resolution is the candidate cause; not tested.

Wall time per 420-step run on the RTX 4090 (shared GPU, peak 4.9 GB): 2.6 min and 42.6 kJ GPU (NVML counter) for 256 Mpc/h; 2.9 min and 52.9 kJ for 128 Mpc/h. Three 128^3 P3M runs give one sha256 of final positions.

### CAMB linear P(k) as the IC input

`linear.camb_power(cosmo)` reads CAMB 2.0.5's z = 0 linear spectrum from `data/camb_reference.json` (sigma8 normalised, default cosmology only; `live=True` runs CAMB for any cosmology) and scales it by this package's D(a). Same phases, P3M, 256 Mpc/h, measured P_CAMB / P_EH at z = 0 (input linear ratio in brackets): 0.986 below k = 0.1 (0.982); 0.996 to 1.002 from 0.1 to 1 (1.006 to 1.017); 1.006 at 1-2 (1.009); 1.012 at 3-5 (0.995). Nonlinear growth smears the fit's wiggle error, so its up-to-3.9 percent linear error shrinks to under 1.5 percent in every z = 0 band. Against the emulator the CAMB start reads 0.994 / 0.991 / 1.001 / 0.987 / 0.980 in bands below 0.1 / 0.1-0.3 / 0.3-0.5 / 0.5-1 / 1-2; at z = 1 below k = 0.1 it reads 1.007, where the fit gave 1.023.

### Gravity on E2 to E6

`twisted.TwistedPoisson` deposits each particle and its images under the group G = Gamma / T on the covering torus, with the mesh laid along the torus's own lattice vectors (hexagonal for E4 and E5), and solves Poisson there. `twisted.eigen_potential` is the independent route: the Green's function as a sum over the manifold's eigenmodes from COMPACT's selection rules, each eigenfunction the orbit sum of plane waves.

| Check (tests/test_twisted.py) | Result | Planted wrong input |
|---|---|---|
| Potential of a smoothed point mass against the eigenmode sum, h = 0.015 | max error 0.10 / 0.33 / 0.11 / 0.09 / 0.29 / 0.22 percent of max abs(Phi) for E1 / E2 / E3 / E4 / E5 / E6; it falls 3 to 9 times when h halves | untwisted torus (no images): 69 to 125 percent |
| Group order, and the force at an image equals the rotated force | E2, E3, E6 to rounding; E4, E5 within 1.5 percent at h = 0.02 (skewed cloud-in-cell cells are not turn symmetric) | |
| E3 run of N particles against a plain PM run of all 4N images on the cover | equal to 1e-8 | E3 run without images: off by over 0.1 Mpc/h |

E3 study run (`study/run_twisted.py`): sides 128 x 128 x 32 Mpc/h with a cubic 128 Mpc/h cover, 65536 particles of E3 (262144 images), 128^3 mesh, Zel'dovich ICs at z = 49 from a fixed-amplitude field averaged over G, 55 steps. At the start the images of E3's particles land on the cover's other particles to 5e-14 Mpc/h. The run matches the plain PM run of all images to 6.7e-12 Mpc/h in position and 2e-14 in P(k), in 30 s against 44 s for the cover run (CPU). This tests the machinery; it is no claim about the topology of our universe.

## Round four: block time steps and 512^3 particles on one shared GPU

```
python packages/cosmo/study/run_block.py --n 256 --box 128 --steps-log 20 --steps-late 90 --levels 3 --eta 0.05
python packages/cosmo/study/run_block.py --n 512 --box 256 --eps 0.0333 --match-n 256 --linear camb --steps-log 20 --steps-late 90 --levels 3 --eta 0.05
python packages/cosmo/study/score_steps.py ref420.npz ref840.npz candidate.npz     # pass or fail by band
```

### Block time steps (`stepping`)

The mesh force runs on global steps; the pair force runs on power-of-two sub-steps chosen per particle by Gadget's softening criterion, d tau = sqrt(2 eta eps / (a |g|)), with tau the drift time. A particle may shorten its step at any of its boundaries and lengthen it only where the longer step begins. Every particle drifts on every sub-step, so positions are always synchronised.

Few global steps lose linear growth with plain kick and drift integrals: 55 global steps put k < 0.1 one percent low at z = 1. The mesh kicks and the summed drift of each global step therefore use the FastPM factors (Feng et al. 2016), which keep the linear growing mode exact for any step count. With them, 55 global steps read 1.0000 of the 420-step run below k = 0.1.

| Check (tests/test_block_steps.py) | Result | Planted wrong input |
|---|---|---|
| Plane wave, a = 0.1 to 1, four global steps, against 64 | 0.7 percent | plain integrals: 6 percent low |
| 16^3 particles: 40 global steps with three levels against 210 plain global steps, P(k) below k = 2 | within 0.25 percent, 89 pair sums per particle instead of 210 | step rule 64 times too lenient: 15 percent low at k = 1-2 |
| Level rule; sum over active particles against the full pair sum | exact; 1e-16 | |
| CUDA engine against the CPU engine; repeat runs | mesh kick 7e-7, pair kick 9e-5 (float32), the same levels; three runs, including one with slab deposit and offloaded momenta, give one sha256 | |

Study test: 256^3 particles in 128 Mpc/h, 2LPT, the round-three initial conditions, scored band by band against the 420-step run (`score_steps.py`). A band passes when it sits within the change that doubling to 840 steps makes, plus 0.2 percent.

| Scheme | Largest band difference from 420 steps | Pair sums per particle | Wall time | GPU energy |
|---|---|---|---|---|
| Round-three code, 420 global steps (rerun under the same load) | reference | 420 | 177 s | 53.9 kJ |
| Lean engine, 420 global steps | 0.09 percent | 421 | 81 s | 30.6 kJ |
| Block steps, 110 global, 3 levels, eta 0.05 | 0.34 percent (z = 1, k 3-5; 840 steps move it 0.86) | 198 | 58 s | 22.2 kJ |
| Block steps, 110 global, 2 levels, eta 0.05 | 0.37 percent | 178 | 42 s | 16.7 kJ |
| Planted: 3 levels, eta 3.2 | fails 8 of 14 bands; 12.5 percent low at z = 1, k 3-5 | 111 | 30 s | 11.3 kJ |

Every band of both block runs passes. Against the round-three code the 3-level run takes a third of the time and saves 31.7 kJ (59 percent); against the lean engine on 420 steps it saves 23 s and 8.4 kJ (27 percent). The GPU was shared with other jobs throughout, so times carry that load. Two block runs give one sha256. In the 256 Mpc/h box no 840-step run exists; there the block runs sit 0.3 to 1.1 percent below the round-three 420-step runs at z = 0, k 2-5, in three seeds.

### The lean CUDA engine (`lean`)

Particles live in six float32 columns and a one-byte level: no (N, 3) force array exists, because each kernel adds its force to the momenta as it sums it. The deposit accumulates 64-bit integers one slab of the mesh at a time. During the mesh FFTs the momenta wait in pinned host memory. A chunked counting sort by chaining cell (cells of half the cut-off, searched two deep) keeps the pair kernel's memory reads local, and the list is rebuilt only when particles may have moved past the skin. 512^3 particles with a 512^3 mesh peak at 5.3 GB.

### Mass resolution and the z = 1 deficit

Three seeds of 512^3 particles in 256 Mpc/h against 256^3 in the same box: same phases on every mode both lattices hold (`ic.linear_delta_k(match_n=256)`), same mesh, same softening (0.0333 Mpc/h), CAMB linear input, the same block steps. So the runs differ in particle mass and in the initial modes between the two Nyquist frequencies.

P / Cosmic Emu, mean of three seeds (range):

| Run | z | 0.5-1 | 1-2 | 2-3 | 3-5 |
|---|---|---|---|---|---|
| 256^3 | 1 | 0.964 (0.956-0.974) | 0.948 (0.935-0.959) | 0.926 (0.913-0.937) | 0.909 (0.899-0.920) |
| 512^3 | 1 | 0.983 (0.975-0.992) | 0.988 (0.974-0.999) | 0.983 (0.969-0.994) | 0.968 (0.959-0.978) |
| 256^3 | 0 | 0.986 (0.958-1.004) | 0.978 (0.960-0.990) | 0.949 (0.940-0.959) | 0.919 (0.912-0.928) |
| 512^3 | 0 | 0.993 (0.964-1.011) | 0.990 (0.971-1.003) | 0.967 (0.957-0.977) | 0.947 (0.942-0.954) |

512^3 over 256^3 on the same phases: z = 1, 1.020 / 1.042 / 1.061 / 1.065 in the four bands, seed ranges under 0.004; z = 0, 1.007 / 1.013 / 1.019 / 1.031.

- Mass resolution is most of the z = 1 high-k deficit. At 1-2 h/Mpc it falls from 5.2 to 1.2 percent, at 2-3 from 7.4 to 1.7 percent.
- Inside the emulator's quoted 3 percent on the seed mean: z = 1 to k = 3, and z = 0 to k = 2. Still outside: z = 1, 3-5 (3.2 percent low); z = 0, 2-3 (3.3 percent) and 3-5 (5.3 percent).
- What is left at z = 0 has three candidates, none tested here: more mass resolution (the 512/256 step is still 3 percent at 3-5), force resolution (fixed mesh split and softening), and the block-step deficit of up to 1.1 percent seen in the 256 Mpc/h box.

Cost per 512^3 run on the shared RTX 4090: 9.6 to 9.9 minutes and 258 to 267 kJ GPU (NVML counter), 159 pair sums per particle, peak 5.3 GB; initial conditions 70 s on three CPU threads. A 256^3 run in the same box: 28 s and 10 kJ.
