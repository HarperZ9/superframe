# latticechiral

**Mission.** Make the chiral-fermion problem of lattice gauge theory cheap to check, and test the newest way around it on a computer. Lattice fermions double (Nielsen-Ninomiya), and the cures trade away either locality or exact chiral symmetry. The 2026 proposal of Craig, Hsu and Witten keeps fermions in the continuum and puts only the gauge field on the lattice. This package carries the classic theorems as exact checks and a small two-dimensional version of that construction.

## What it does

| Module | Computes | Known answer it must reproduce |
|---|---|---|
| `free` | naive, Wilson and overlap operators in momentum space; zero counting; Ginsparg-Wilson residual; the SLAC kernel | 2^d naive zeros (d = 1 to 4), one Wilson zero; chiralities summing to 0; GW to 1e-15; overlap D = 2 at every doubler; SLAC kernel falling as 1/x |
| `u1` | 2D compact U(1) fields on an L x L torus, instanton backgrounds, Wilson-Dirac and overlap matrices, index and zero modes, spectral flow of H(m), admissible Metropolis | overlap index = geometric charge Q on admissible fields; exactly abs(Q) zero modes of one chirality; spectral flow = Q; gauge invariance |
| `chiral` | gauge-covariant continuum interpolation of lattice U(1) fields; continuum Weyl determinants on the torus by Fourier truncation; the phase and its gauge dependence; Weyl spectral flow on a circle | a unit left mover's phase moves by -(1/4 pi) int chi F under a gauge transformation; the move scales as sum_L q^2 - sum_R q^2 and cancels in the 3-4-5 model; vector-like products are real; q levels flow per flux quantum |
| `overlap_nn` | the Narayanan-Neuberger overlap chiral determinant (Wigner-Brillouin phase, or the vacuum carried by parallel transport along a path: the adiabatic form of the eta-invariant phase) on a fine lattice built from a continuum field; the eta-invariant side of Witten's formula, after Kaplan and Schmaltz | determinant 1 at zero field; equal-charge left and right movers multiply to a nearly real number; constant fields give exact links |
| `u1_4d` | 4D U(1) with constant fluxes in two planes; Wilson and overlap operators; topological charge from plaquettes | overlap index = Q12 Q34 with a spectral gap |
| `nonabelian` | continuum SU(2) Weyl fermions on smooth su(2) fields (no lattice interpolation yet); the non-abelian consistent anomaly | generators close; Dynkin indices 1/2, 2, 5; triplet / doublet anomaly = 4 |
| `su2lattice` | SU(2) link fields on a 2D lattice (quaternions), path-ordered links from a continuum field, interpolation back to the continuum by link logarithms and Fourier interpolation, lattice and continuum gauge transformations, covariant smoothing, the largest plaquette angle as the admissibility measure | reconstruction and gauge covariance converge as a^2; triplet / doublet anomaly = 4 on interpolated fields | U(1) links alongside (`u1_links_from_continuum`, `u1_interpolate`, `u1_gauge_lattice`); `nonabelian.logdet` takes a hypercharge Y and a U(1) field for SU(2) x U(1).
| `eta3d` | a direct spectral eta invariant on the mapping torus T^2 x S^1 for loops of flat U(1) connections, regulated by exp(-(lambda / Lambda)^2) | pi eta equals minus the Berry holonomy q^2 L^2 S / (2 pi) of the 2D Weyl determinant in the adiabatic limit | Also loops of curved fields A = cos(theta) B1 + sin(theta) B2 (`eta_field`) against the local holonomy (q^2 / 2) int B1 x B2 (`holonomy_field`).

## Run it now

```
python -m pytest -q packages/latticechiral/tests
```

## Limits

- `u1` uses dense matrices, so lattices stay near L = 12 and below; `u1_4d` stays at L = 4.
- `chiral` is abelian and two-dimensional. The continuum fermions are truncated plane waves with a symmetric square cutoff, and the modulus is taken in Coulomb gauge. The phase is not compared with an Atiyah-Patodi-Singer eta-invariant, the definition Witten uses.
- The interpolation matches the lattice links only approximately (band-limited), while staying exactly gauge covariant.
