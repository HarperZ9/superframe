# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""cosmolab: a particle-mesh cosmological N-body solver with known-answer checks.

  background  flat LambdaCDM expansion, linear growth D(a) and f(a), kick and drift factors
  linear      Eisenstein-Hu 1998 linear power spectrum normalised to sigma8
  halofit     nonlinear power by halofit (Takahashi et al. 2012 coefficients)
  backend     numpy on the CPU or torch on CUDA, one interface
  pm          cloud-in-cell deposit, FFT Poisson solve, kick-drift-kick in the scale factor
  ic          Zel'dovich and 2LPT initial conditions and the plane-wave pancake
  power       P(k) of particles with window deconvolution and shot-noise removal
  ewald       the periodic point-mass force by Ewald summation
  reference   the Cosmic Emu and CAMB tables and k-band scoring
  topology    Laplacian eigenmodes of the flat 3-manifolds E1 to E6
"""
__all__ = ["background", "linear", "halofit", "backend", "pm", "ic", "power", "ewald", "reference", "topology"]
