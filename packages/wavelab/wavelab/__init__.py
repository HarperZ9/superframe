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
"""
__all__ = ["consts", "burgers", "bubble", "earth", "atmosphere", "finesse", "timerev", "reservoir", "otherworld"]
