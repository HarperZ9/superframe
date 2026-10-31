# crt: a cathode-ray tube as a physical simulation

**Mission.** Make a CRT on screen by simulating the tube rather than imitating its picture: the beam
in time, the grille, the phosphors with their measured spectra and decays, the faceplate glass. Then
every effect people know from real tubes, the trails, the flicker a camera catches, the bright lines
that swell, follows from the physics with nothing tuned to look right. The answer stays checkable:
every constant carries its source and a grade, and known-answer tests guard each stage.

## Model, in evaluation order

1. **Raster timing.** NTSC 240p: line rate 4.5 MHz / 286 = 15 734.27 Hz (63.5556 us), 262 lines a
   field (60.054 Hz), 240 active lines from line 21, active line 52.8556 us starting 9.2 us after the
   sync edge (ITU-R BT.1700 Table 2: datum to end of blanking 9.2 us, front porch 1.5 us). Each beam
   sample (line j, face position x) has a landing time t.
2. **Guns.** Cathode current I = I_max g_c V^2.4 for signal V (the triode law that BT.1886
   describes); gains g_c set equal full drive to D65, as a service setup does. Energy per sample
   E = V_anode I dx / v (25 kV, beam speed v = raster width / active time).
3. **Spot.** Gaussian, sigma = line spacing x (0.20 + 0.22 (I / I_max)^0.5): the spot grows with
   current (space charge and lens aberration). The constants are raw-native's slot-tv preset, fitted,
   not derived. Spread over face cells by the exact gaussian mass (Abramowitz-Stegun erf),
   renormalised over the taps so the scatter conserves energy to rounding.
4. **Grille.** Aperture grille, triad pitch 0.60 mm, one face cell per stripe. Each gun's energy over
   a triad lands on that gun's stripe, times the grille transmission (0.22, low grade).
5. **Phosphors (P22).** Red is Eu3+ lines on one of two real P22 hosts: Y2O2S:Eu (626, 616, 595, 586,
   704, 538 nm; default) or Y2O3:Eu (611 nm main line; `red_host`). Line weights are low grade until
   a measured spectrum exists. ZnS:Cu,Al green and ZnS:Ag blue are bands gaussian in photon energy;
   energy efficiency 0.13, 0.17, 0.21. Decay presets: `kuhn2002` (default; Kuhn 2002 eqs. 8-10, one
   measured P22 monitor: red a sum of exponentials with a 0.442 ms slow term, green and blue power laws
   with n = 1.10 and 1.11 plus exponentials, cut at 10 ms, the measured span; data in
   tools/measured/data/p22_kuhn2002.json), `patent` (US 5,825,124, time to 1/100: 1.9, 7.5, 7.0 ms,
   Becquerel n = 2), `ast` (10% times 850, 35, 80 us, scintillator context), `raw-native` (its
   two-exponential fits). The light of a sample inside a window [a, b] is eta E (F(b - t) - F(a - t)),
   summed over the fields that matter.
6. **Faceplate.** Soda-lime glass n(lambda) from tools/materials, 12 mm, body transmission 0.56.
   Exit fraction X(lambda) integrates Lambertian light against unpolarised Fresnel and total internal
   reflection. The reflected part returns as a ring at 2 t tan(theta) and the phosphor (albedo 0.5)
   re-emits it; the series is summed to all orders as X / (1 - rho K1^) by FFT.
7. **Output.** Per cell, three phosphor-light coefficients whose spectra are known: the spectral
   frame without loss (`colour.expand` writes the 81-band cube). XYZ through the CIE 1931 functions
   of tools/materials at 683 lm/W, luminance in cd/m^2 for a Lambertian cell, then linear sRGB and the
   sRGB encode.

## Cost (14 inch tube, 1 517 274 cells, 8 fields of persistence)

numpy CPU 7.2 to 11.3 s per eye frame; torch CUDA float64 1.3 to 2.5 s (RTX 4090, shared), agreeing to
3.5e-16 relative. Three runs on 2026-10-30; another job held the GPU during one.
The GPU time is mostly kernel launches (2 x 361 adds per gun); a fused kernel would remove them.

Decay weights are cached (`beam.weights`, 2026-10-31). The fraction of each sample's light inside a
window depends on beam timing, the decay law, the window and the field list, never on the picture, so
`beam.CACHE_WEIGHTS` keys it on those and returns a read-only array. On the torch path one field went
from a median 2.86 s to 1.34 s (five fields each, same machine, one warm field first); the beam stage
from 2.34 s to 0.35 s. The cached frame equals the uncached one bit for bit (18 cases over four decay
presets, both red hosts, static and moving scenes, numpy and CUDA; a perturbed cache entry is caught).
Computing the weights on the GPU instead takes 0.10 s a field and differs from numpy by 8e-16
relative, so the cache wins. The first field of a new timing still pays the full cost.

## Tests (`python -B tests/test_crt.py [out.json]`)

line rate and field rate; beam arrival time of a single pixel; decay t10 and t1% against the
inputs and through the full frame path; the Kuhn preset against RCA 1961 ZnS 10% times; grille pitch from the FFT of a white row; energy (scatter,
steady state over 600 fields, halation series, exit fraction against 1/n^2); spot sigma against the
law at seven drive levels; D65 white; determinism; and controls that must fail (a 1% decay error,
a 0.62 mm grille, a Becquerel n = 2 green against the RCA time).

## Lineage

CRT-Royale (TroggleMonkey), Timothy Lottes' crt-lottes, cgwg's crt-geom, Hyllian's crt-hyllian,
and raw-native style_crt (its halo derivation and spot law are reused here, credited in the code).

## Port note

Python with numpy; torch only for the optional CUDA path. Nothing here blocks a BuildLang or
D3D12 port except the scatter's per-line row adds, which map to one compute dispatch per tap pair
or one fused dispatch per line.
