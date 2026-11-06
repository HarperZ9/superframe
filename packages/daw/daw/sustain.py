# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Sustained excitation: a bowed string and a reed on an air column, as waveguides with a nonlinear junction.

Bow (McIntyre, Schumacher and Woodhouse 1983; Smith 1986): the string is two delay lines meeting at the bow,
a fraction beta of the length from the bridge. The bow moves at v_b; the string's velocity at the bow is the
sum of the two incoming waves; the friction junction reflects the velocity difference by a curve that is near
1 when the difference is small (sticking) and falls when it is large (slipping), here
r(dv) = min(1, (|dv| s + 0.75)^-4) with s set by bow force. Driven above threshold the string settles into
Helmholtz motion: it sticks to the bow for a fraction 1 - beta of each period and slips for beta, at the
string's own frequency.
Reed (McIntyre, Schumacher and Woodhouse 1983; Cook 1992): a cylindrical bore closed at the reed and open at
the bell is a delay loop of 2L / c with an inverting, slightly lossy bell reflection, so it sounds at
c / 4L with mostly odd harmonics. The reed passes a fraction of the pressure difference across it,
clip(0.7 - 0.3 dp, -1, 1); below a threshold mouth pressure the loop decays and no tone forms.
"""
import math

import numpy as np


def _rd(buf, i):
    return buf[i % len(buf)]


def bowed(f0, seconds, fs, beta=0.127, bow_velocity=0.2, force=3.0, loss=0.995):
    """Bowed string; returns (bridge velocity output, sticking flags at the bow)."""
    total = int(round(fs / f0))                       # one period: a wave's round trip over the whole string
    n_bridge = max(2, int(round(beta * total)))       # round trip bow -> bridge -> bow
    n_nut = max(2, total - n_bridge - 1)              # round trip bow -> nut -> bow, less the bridge filter
    bridge = np.zeros(n_bridge)                        # waves travelling bow -> bridge -> bow
    nut = np.zeros(n_nut)                              # waves travelling bow -> nut -> bow
    m = int(seconds * fs)
    out, stick = np.zeros(m), np.zeros(m, bool)
    lp = 0.0
    for i in range(m):
        from_bridge = -loss * _rd(bridge, i)           # reflection at the bridge (inverting, lossy)
        lp = 0.5 * (lp + from_bridge)                  # the bridge's loss is stronger at high frequencies
        from_nut = -_rd(nut, i)
        dv = bow_velocity - (lp + from_nut)
        r = min(1.0, (abs(dv) * force + 0.75) ** -4)
        new = dv * r
        stick[i] = r >= 1.0
        bridge[i % n_bridge] = from_nut + new
        nut[i % n_nut] = lp + new
        out[i] = lp
    return out, stick


def reed(length, sound_speed, seconds, fs, breath=0.6, bell=0.95):
    """Clarinet-like reed on a closed-open bore of `length` metres; returns the bore pressure."""
    n = max(2, int(round(2 * length / sound_speed * fs)) - 1)   # less one sample for the bell filter
    bore = np.zeros(n)
    m = int(seconds * fs)
    out = np.zeros(m)
    lp = 0.0
    ramp = max(1, int(0.02 * fs))
    for i in range(m):
        p = breath * min(1.0, i / ramp)
        back = _rd(bore, i)
        lp = 0.5 * (lp + back)
        refl = -bell * lp
        dp = refl - p
        r = min(1.0, max(-1.0, 0.7 - 0.3 * dp))
        bore[i % n] = p + dp * r
        out[i] = bore[i % n]
    return out


def odd_even(y, fs, f0):
    """Levels (dB) of harmonics 1 to 4 of a tone at f0, from one long FFT."""
    sp = np.abs(np.fft.rfft(y * np.hanning(len(y))))
    fr = np.fft.rfftfreq(len(y), 1 / fs)
    return [20 * math.log10(sp[np.argmin(np.abs(fr - k * f0))] + 1e-12) for k in (1, 2, 3, 4)]
