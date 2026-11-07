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
