# wavelab

**Mission.** Find what waves do when they are pushed hard and when they are timed well. Brute force is amplitude: nonlinearity, shocks, cavitation, energy squeezed into a point. Finesse is timing: resonance, phase, interference, many small pushes adding up. Each module reproduces a published or closed-form answer, with a planted wrong case that must fail, before anything new is read from it. Simulation only; nothing here specifies a physical source.

## What it does

| Module | Computes | Known answer it must reproduce | Planted error that must fail |
|---|---|---|---|
| `burgers` | plane-wave steepening by a pseudo-spectral Burgers solver | Fubini harmonics before the shock, steepness 1/(1 - sigma), shock at sigma = 1, the Fay sawtooth and its saturation ceiling | beta = 1 instead of 1.2 moves the shock by 20 percent |
| `bubble` | Rayleigh-Plesset and Keller-Miksis bubbles in NIST water | Rayleigh collapse time 0.914681 R0 sqrt(rho / dp), Minnaert frequency (3.29 kHz for 1 mm) | inertia coefficient 1 instead of 3/2; an isothermal gas |
| `earth` | PREM free oscillations by radial shooting: radial, self-gravitating spheroidal, toroidal | 0S2 309.28 uHz (53.9 min), 0T2 379.17 uHz (44 min), 0S0, 0S3, 0T3 against Masters and Widmer | the Cowling approximation; undispersed 1 s moduli |
| `atmosphere` | the Lamb mode of a stratified atmosphere as a generalised eigenproblem | isothermal speed sqrt(gamma R T / M) exactly; 1976 atmosphere near the 308 m/s measured for the Hunga wave | none (the isothermal case is the check) |
| `finesse` | Mathieu Floquet multipliers, pumped damped oscillators, phased point sources | first Mathieu tongue series, threshold h = 4 lambda / omega, Faraday half frequency, gain N^2 and N | pumping at omega instead of 2 omega; reversed phases |
| `timerev` | 2D FDTD in a chaotic cavity, record and re-emit | refocusing at the source from one receiver, spot near half a wavelength | randomly delayed re-emission |
| `reservoir` | a mass-spring chain as a reservoir computer | linear chain: no products, memory independent of drive | taps-only features; shuffled targets |
| `resonator` | a resonator in 16 cos modes with quadratic coupling and thermoviscous damping; overtones harmonic or detuned | the linear steady amplitude F / (2 g), the weak-drive second-mode amplitude, the projection of u^2 | the nonlinearity switched off must not saturate |
| `media_graph` | chains and square membranes of masses and springs with several input sites; NARMA-10 | odd spring laws cannot form XOR on any graph | shuffled training targets give NRMSE near 1 |
| `cavity` | bubble shape modes 2 to 5 in the boundary-layer approximation (Floquet and Rayleigh-Taylor), and adiabatic collapse with Saha ionisation of argon (NIST ASD levels) | Lamb's capillary frequency for a static bubble; the no-ionisation limit equals the polytropic peak | dropping the ionisation energy while keeping the extra particles must run hotter |
| `otherworld` | relaxing-gas sound speeds, the acoustic horizon, octave scaling, Brune spectra | Perseverance's two Mars sound speeds; ray peel rate equals kappa; exact ratios under 2^n | none (NIST and Mars data are the checks) |

Constants come from `packages/measured`: CODATA 2022 through `generated/constants.py` and `data/codata2022.json`, media through `data/wave_media.json` (PREM, Masters and Widmer Table 1, NIST fluid states, Perseverance and Hunga values, the 1976 standard atmosphere), each with its source and sha256.

## Run it now

```
python -m pytest -q packages/wavelab/tests
python -c "import sys; sys.path.insert(0, 'packages/wavelab'); from wavelab import earth; print(earth.find_mode('S', 2, 250e-6, 360e-6) * 1e6)"
python -c "import sys; sys.path.insert(0, 'packages/wavelab'); from wavelab import atmosphere as a; print(a.lamb_speed(a.profile(a.ussa_temperature))['c'])"
```

The second line prints Earth's gravest mode, about 309.3 uHz; the third the Lamb-wave speed of the 1976 atmosphere, about 311.6 m/s.

## Results

| Check | Ours | Reference |
|---|---|---|
| 0S2 | 309.32 uHz (53.88 min) | PREM 309.28, observed 309.45 +- 0.15 |
| 0T2 | 378.62 uHz (44.02 min) | PREM 379.17, observed 377.30 +- 0.80 |
| 0S0 | 813.97 uHz | PREM 814.31, observed 814.39 +- 0.01 |
| Lamb wave, 1976 atmosphere | 311.6 m/s | Hunga: 308.0 +- 0.6 m/s (POLA), about 310 m/s |
| Mars, below and above 240 Hz at 236 K | 242.8 and 249.8 m/s | Ingenuity 237.7 +- 3; laser sparks 246 to 257 |
| Single-bubble collapse (4.5 um, 1.35 bar, 26.5 kHz) | Rmax 37.8 um, Rmin 0.72 um, adiabatic peak 15400 K | sonoluminescence regime; temperature and light are model estimates |
| Acoustic saturation (alpha x = 0.1) | 1000 times the source, 71 times the received fundamental | Fay ceiling to 1.3e-4 |
| Bubble with gas diffusion (argon, c_inf / c0 = 0.004) | stable only from 1.3 to 1.4 bar (26.5 and 40 kHz); peak 13,200 K | without diffusion the model reaches 2e5 K, pressed against its van der Waals core |
| Detuned overtones on a 1.2x drive grid | saturation ceiling postponed 1.51, 2.10, 2.51, 2.80, 3.15 times for d = 0.05 to 0.3 | grid offset moves the harmonic ceiling by 0.02 percent |
| Bubble against the SBSL literature (Brenner, Hilgenfeldt and Lohse 2002) | 4.6 R0 expansion at 1.2 atm; peaks 521, 5491, 13394 K at 1.1, 1.2, 1.3 atm; the 4.5 um, 1.2 atm bubble shape-unstable | nearly 10 R0; 20000, 52000, 118000 K (Vuong and Szeri 1996); that bubble is the standard stable case. The model does not reproduce SBSL dynamics |
| Detuned overtones (d = 0.2) at the top drive | peak 1.9 times the harmonic resonator's, steepness 0.70 times, fundamental 1.05 times | the ceiling moves by about one drive step (2.2 times), not 3 |
| XOR from a vibrating chain (24 masses, linear readout) | r2 0.002 linear, 0.004 odd springs, 0.997 even springs at high damping | a linear medium cannot form products; odd springs keep the response odd |

## Limits

- `burgers` is one-dimensional with thermoviscous loss only: no relaxation, no diffraction.
- `bubble` does not reproduce the SBSL literature at its standard conditions (see Results): it expands about half as far, reaches peaks 4 to 40 times lower, and calls the standard stable bubble shape-unstable. Treat its temperatures and maps as model-relative.
- `bubble` has diffusion only as the quasi-static R^4-weighted balance, no shape instability and no chemistry; near the van der Waals core the peak temperature is set by the core model; its peak temperature is an adiabatic estimate and its light a black body, both approximate.
- `earth` is spherical, non-rotating and isotropic: the anisotropic upper mantle enters as its Voigt average, which leaves toroidal modes about 0.15 percent low. No ocean layer.
- `atmosphere` is flat and windless with a rigid lid; above 86 km the profile is isothermal.
- `reservoir` is one chain with one input site and a linear readout.
- `otherworld` treats CO2 as an ideal gas with Einstein vibrational modes (wavenumbers from memory, Fermi resonance ignored); the horizon is a 1D ray model. The Titan conditions in the media table are from memory.
