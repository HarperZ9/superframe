<!-- writing-profile: research -->
# Fluid Room: a Navier-Stokes solver and view in the engine

Date: 2026-10-31.

The author's picture: a toilet bowl's vortex, origami, scrunching, marbling and Navier-Stokes as one thing seen in the right dimensions. This package holds the solver that lets that be looked at and measured.

## What is here

`solvers/fluid/` runs in Node and the browser with no dependency. `Spectral2` is the 2D vorticity solver with passive dyes. `Spectral3` is 3D velocity in rotational form with projection. Both are periodic and pseudospectral, with 2/3 dealiasing and viscosity integrated exactly. Readouts are vorticity, Q-criterion (Okubo-Weiss in 2D), helicity, enstrophy and the shell spectrum. `views/fluid-room/` is the live page: a GPU step for 2D and a worker running the CPU reference for 3D.

## Boundaries, stated

The solver is periodic. Walls are a Brinkman penalty: a volume force toward the wall's velocity with strength 1/eta. That is a soft wall, first order in sqrt(nu eta), and it rings at the grid scale when that thickness falls under one cell. The penalty target must also reach zero before the box edge, since a jump in it rings across the whole grid: I found that in the bowl's vorticity view. A channel needs the k = 0 velocity, which vorticity can't hold, so `dynamicMean` carries it separately.

The bowl is a 2D model. Its drain is a fixed potential flow from a sink disc to a source ring just inside the wall. Inside the disc the plane sees divergence -a, which is the same term as axial strain a in 3D, and the core obeys the Burgers equation for vertical vorticity. That test passes. Not modelled: free surface, air core, gravity, curved floor, floor boundary layer, 3D instability.

## Two tiers

The CPU reference is the physics of record and CI tests it. The GPU view repeats the same scheme in single precision. An integrating-factor Heun step, which the view used first, grew at the cut-off wavenumber under weak viscosity and blew up within 200 steps at 512 squared. SSP RK3, stable to 1.73 on the imaginary axis, replaced it on both tiers. The view shrinks its step to keep the advective limit and stops with a plain message if the numbers stop being finite.

Marbling's dye on the GPU is a semi-Lagrangian display transport with its own numerical blur, on a finer grid than the flow. It is not the reference. The CPU dye is pseudospectral and carries diffusion explicitly.

## Verified

| Known answer | Checked by | Result | Planted failure |
|---|---|---|---|
| Inviscid Taylor-Green enstrophy, Brachet et al. 1983 table 3 | `Spectral3` at 32 cubed, t = 1 | 0.416909 against 0.41691 | wrong row, added viscosity |
| 2D Taylor-Green decay | closed form | within 1e-12 | double viscosity |
| Poiseuille | penalised walls, body force | peak error under 5 percent | double viscosity |
| Kolmogorov threshold | Galerkin matrix, then solver growth rates at Re 1.2 and 4, alpha 0.25 | within 0.003 of sqrt 2 at alpha 0.02; growth within 2e-3 of the matrix; sign flips | threshold 2.5 |
| Burgers vortex | budget, and the plane's drain marched to steady | peak within 5 percent; circulation within 10 percent | wrong width, wrong strain |
| Rankine, Lamb-Oseen | spectral inversion, viscous spread | u within 0.015; peak within 1 percent | wrong circulation, wrong viscosity |
| Stokes reversal | Couette through penalised walls, and Taylor's map at the null-space study's sizes | profile within 0.04; half recovery near Peclet 2.8e6 | half-turn kick, wrong wall speed, diffusion |
| Divergence | 3D, ten steps | under 1e-12 of the largest mode | projection off |
| Energy and helicity, truncated Euler | 16 cubed | drift under 1e-7 | tampered nonlinear term |
| Beltrami decay and H = 2E | ABC flow | exact | wrong rate |
| 2D cascade direction | inviscid, 64 squared | energy centroid falls 15 percent or more | nonlinearity off |
| Moffatt helicity on a Hopf link | tubes at 32 cubed | within 3 percent of 2 Gamma^2, mirror flips sign | unlinked rings |

Aliasing was tried as the planted failure for helicity and did not serve: in rotational form the drift was only six times larger without dealiasing. A tampered nonlinear term is the plant now.

The GPU tier, run in the built-in browser on this workstation through `window.fluidChecks()` at 64 squared: start 1.3e-8 of the largest mode; after 100 steps 1.2e-5 from the CPU reference in the same scheme; the bowl's wall and drain terms on, 5.6e-5; planted viscosity ten times larger, 0.097. Step time at 512 squared was 1.7 ms with the bowl's terms off and 3.5 ms with them on, on one GPU.

Heavier cases and locked studies live in the working notes. A numpy twin there agrees with these classes to 1e-15 on 32 cubed and 64 squared.

## Design rule gaps

The page uses the same shell as the other rooms: Hanken Grotesk and JetBrains Mono, one instrument column. It does not use the shared site kit, the dynamic type engine or a generative field in its chrome, which the design rules ask of every page. The flow itself is the only motion. The port is pending for all the rooms together. Pointer stir has no keyboard equivalent yet. Reduced motion starts the page paused.

## Limits

No 3D view runs on the GPU; the worker holds 32 cubed at a few steps per second. Reversal in the view flips omega and any fixed flow; viscosity doesn't reverse, which is why the stripes don't quite come back.
