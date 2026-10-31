# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Prose for the working layer of perceive.html."""

PRO = """
<h3>One operator</h3>
<p>A window is a range [lo, hi] on some axis with a scale s (linear, log, mel, or CIE equal steps). It sends a value
x to a position u in [0, 1]. A bridge composes a source window with a target window through u, so it is a
bijection between the two ranges and its inverse is the same composition run backward.</p>
<span class="math">u(x) = (s(x) - s(lo)) / (s(hi) - s(lo))      bridge(x) = s_t^-1( s_t(lo_t) + u(x) (s_t(hi_t) - s_t(lo_t)) )
log: s = ln x     mel: s = 2595 log10(1 + f / 700)     CIE: s = cumulative u'v' distance along the spectral locus</span>
<p>Sight takes 380 to 750 nm. Sound takes 20 Hz to 20 kHz (the spectral views use 60 Hz to 6 kHz, where hearing is
most even). A flip reverses the order when the source axis runs the other way, for example wavelength into pitch.</p>
<h3>What a view loses</h3>
<p>For a map f from a discrete source X to Y = f(X), the bits lost are H(X) - H(Y) = H(X | Y): what a receiver
can no longer recover from what they sensed. The source is quantised at a stated step (0.1% of wavelength, 0.01 of
a z-score, 0.1 degrees Celsius) and the output at a stated just-noticeable difference: 2 nm of wavelength, 0.5% of
pitch, one step of CIE lightness, 10 ms of pulse. The number holds for that sample and those steps. It is a lower
bound on what a careless view loses, and it does not measure what a person notices in practice; that is the queued
study below.</p>
<p>Knobs a wave carries: amplitude, frequency, phase and polarisation. Each view names the ones it keeps. A spectrum
keeps amplitude against frequency and drops phase and polarisation; the Poincare sphere keeps polarisation and drops
the absolute phase; a heterodyne keeps timing and loudness and folds frequency about the tuning.</p>
<h3>Bridges built on other tools</h3>
<p>Extra dimensions run on ndim (packages/ndim): its polytopes, plane rotations, face lattice and hyperplane
slices are loaded from its own source, never copied. The law chords read ndim's 8D embedding of the law table.</p>
<h3>Queued study</h3>
<p>Can people find hidden structure in a band faster or more accurately through the bridge than from a table of
numbers? Planted structures (a weak line, a periodic dip, a trend, a 1-bit corner collision) in synthetic bands;
three arms (table, bridge sight only, bridge sight and sound); time to answer and accuracy. Kill: the bridge arms
are no faster and no more accurate than the table at the preregistered sample size. Not run on people yet.</p>
"""

MISSING = """
<h3>Not done yet</h3>
<ul>
<li>Time expansion and frequency division, the other two bat-detector methods; only the heterodyne is built.</li>
<li>Real recordings: the bat calls and spectra are synthetic or tabulated, not measured sound or a measured sky.</li>
<li>Line-integral convolution for the magnetic field: streamlines are drawn instead.</li>
<li>Electric current is shown as drifting charges in the field, not as a current in a circuit.</li>
<li>Polarisation angle in the picture uses an HSL hue, not a measured colour scale.</li>
<li>Touch is a single vibration pattern per change; there is no continuous haptic texture, and many desktops have no motor.</li>
<li>The bits-lost figures use textbook JNDs, not JNDs measured on the people using the page.</li>
<li>Orbital angular momentum of light, gravitational waves, and seismic records are not bridged yet.</li>
</ul>
"""
