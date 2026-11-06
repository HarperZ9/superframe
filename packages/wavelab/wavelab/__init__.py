# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""wavelab: waves pushed hard (amplitude) and waves timed well (phase), each checked against a known answer.

  consts      CODATA and media read from packages/measured (PREM, NIST fluids, Mars, Hunga, 1976 atmosphere)
  burgers     steepening to a shock, Fubini and Fay solutions, acoustic saturation
  bubble      Rayleigh collapse, Minnaert frequency, Keller-Miksis cavitation and its energy concentration
  earth       free oscillations of PREM: radial, spheroidal (self-gravitating) and toroidal modes
  atmosphere  the Lamb wave of a stratified atmosphere
  finesse     Mathieu tongues, parametric threshold, Faraday half-frequency, phased focusing
  timerev     time reversal in a reverberant cavity
  reservoir   a vibrating chain as a reservoir computer: memory, quadratic capacity, XOR
  otherworld  sound on Mars, Titan and Venus; the acoustic horizon; planetary frequency scaling
  resonator   resonant macrosonic synthesis in a modal model: harmonic against detuned overtones
  media_graph mass-spring graphs (chains, membranes) with several input sites, and the NARMA-10 task
  cavity      bubble shape stability (parametric, Rayleigh-Taylor) and a Saha ionisation energy sink
  thermal     a bubble whose gas exchanges heat with the water (isothermal when slow, adiabatic when fast)
  conduction  a bubble with a radially resolved gas temperature (homobaric, Lagrangian shells)
"""
__all__ = ["consts", "burgers", "bubble", "earth", "atmosphere", "finesse", "timerev", "reservoir", "otherworld", "resonator", "media_graph", "cavity", "thermal", "conduction"]
