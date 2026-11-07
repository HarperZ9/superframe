# cosmo

**Mission.** The core of the universe simulator: dark matter in an expanding periodic box, evolved under gravity from the early universe to today, with every piece scored against a known answer before any result is read from it.

`cosmolab` is a particle-mesh (PM) N-body solver. It lays particles on a lattice, displaces them with Zel'dovich initial conditions drawn from a linear power spectrum, and integrates them in comoving coordinates with kick-drift-kick steps in the scale factor. Gravity comes from a cloud-in-cell density on a mesh and an FFT Poisson solve. The same code runs on the CPU (numpy and scipy.fft, three threads) or on CUDA through torch.

## Run it now

```
python -m pytest -q packages/cosmo/tests
python packages/cosmo/study/run_pk.py --n 128 --box 256 --backend numpy          # CPU, about 5 minutes
python packages/cosmo/study/run_pk.py --n 256 --box 256 --deconvolve 2 --backend torch   # GPU, about 16 s
python packages/cosmo/study/plates.py out/cosmo/pk_n256_L256_torch-cuda_dc2_s55.npz --out out/cosmo
```

## What it does

| Module | Computes | Known answer it must reproduce |
|---|---|---|
| `background` | flat LambdaCDM E(a), linear growth D(a) by the Heath integral and by the growth ODE, f(a), kick and drift factors | the two D(a) routes agree to 2e-12; D = a in Einstein-de Sitter; f(1) within 1 percent of Omega_m^0.55; the factors equal their closed forms in Einstein-de Sitter |
| `linear` | Eisenstein and Hu (1998) transfer function with baryon oscillations, top-hat sigma(R), sigma8 normalisation | within 3.9 percent of CAMB's linear P(k) from 1e-3 to 10 h/Mpc; a baryon-free planted spectrum misses by over 10 percent |
| `halofit` | nonlinear P(k) with the Takahashi et al. (2012) coefficients | within 3e-4 of CAMB's halofit (version takahashi) at z = 0 and z = 1, fed CAMB's linear P(k) |
| `ewald` | the periodic force of a point mass with a neutralising background (Hernquist, Bouchet and Suto 1991) | zero force at the symmetry points; Newton at short range; independent of the splitting parameter to 1e-11 |
| `pm` | cloud-in-cell deposit, Poisson solve with a four-point finite-difference gradient, cloud-in-cell readback, kick-drift-kick | see the table below |
| `ic` | Zel'dovich displacements and momenta, fixed-amplitude option (Angulo and Pontzen 2016), the plane-wave pancake | the pancake's analytic positions |
| `power` | P(k) with window deconvolution and the cloud-in-cell shot noise of Jing (2005) | zero power for Poisson particles within 4 sigma |
| `backend` | numpy or torch-CUDA behind one interface | CUDA accelerations equal numpy's to 1e-4 (float32) |

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

## Limits

- PM resolves forces to about two mesh cells; inside that, halos are too soft, and P(k) falls below halofit past k of about 2 h/Mpc for this set-up.
- Full window deconvolution (`deconvolve=2`) is unstable at coarse mass resolution: 128^3 particles in 256 Mpc/h overshoot halofit by 5 to 67 percent. One window (`deconvolve=1`) keeps that run within 3 percent below k = 0.5 at z = 0, and plain PM (the default, 0) is stable but low at high k. The 256^3 numbers above use 2.
- On a 32^3 lattice under a 64^3 mesh, modes above a tenth of the particle Nyquist grow faster than linear theory (2.6 percent at k = 0.14 k_Ny over the full run, falling with particle number). This is lattice discreteness; the growth test reads only the two longest shells.
- Initial conditions are first order (Zel'dovich); no second-order Lagrangian term. Radiation and neutrinos are left out of the background.
- The linear spectrum is a fit, within 3.9 percent of CAMB. CAMB is used only to write `data/camb_reference.json` (study/make_camb_reference.py); nothing imports it at run time.
- No halo finder, no hydrodynamics, no lightcone.
