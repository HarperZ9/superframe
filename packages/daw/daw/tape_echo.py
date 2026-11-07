# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A tape echo as a physical tape loop: erase, record and three playback heads on one endless loop.

The tape moves at speed v(t). A sample written at the record head at time t_w passes playback head k when the
tape has travelled that head's spacing s_k past the record head, so the read time solves X(t) - X(t_w) = s_k
with X the integral of v. Wow and flutter are speed changes of the transport: the capstan (motor shaft) and
the pinch roller each add a sinusoidal speed term at their own rotation rate v0 / (pi d), with relative depth
set by their eccentricity e / r; a slow wow term covers the rest of the transport. Because one tape speed
both writes and reads, a speed wobble at rate f_w changes the read pitch by v(t) / v(t_w), and the pitch
modulation depth is the speed depth times 2 |sin(pi f_w D)|, where D is the head delay. Echoes never pass the
erase head, so nothing older than one pass of the record-to-head path is heard.

Record path: the input plus the feedback (intensity) from the selected heads, through the tape's
anhysteretic saturation, magnetised onto the tape. Read path: the playback head's gap loss
sinc(pi g f / v) and the head-to-tape spacing loss exp(-2 pi d f / v) (Wallace), then hiss at the stated
signal-to-noise ratio. A spring tank of three dispersive springs follows, as on the unit.

Values and their sources (the maker's documents were read as technical reference; nothing is copied):
- Tape speed range 0.12 to 0.40 m/s: the service notes' reference data ("approx").
- Twelve mode selector positions: the selector table on the echo board schematic (repeat modes 1 to 4,
  reverb with echo 5 to 11, reverb only 12); MODES below.
- Three springs in the reverb tank, signal-to-noise 60 dB A-weighted: operator's manual and service notes.
- Bias oscillator near 60 kHz: service notes schematic. Bias is not simulated; its effect is taken as the
  linearised anhysteretic curve below.
- Head spacing, capstan and pinch roller diameters, eccentricities, gap length and spacing loss: NOT in the
  documents read. They are free parameters with labelled defaults (FREE below), not claims about the unit.
"""
import math
from dataclasses import dataclass

import numpy as np

# repeat modes 1-4, reverb + echo 5-11, reverb only 12 (service notes, echo board selector table)
MODES = {1: ((1,), False), 2: ((2,), False), 3: ((3,), False), 4: ((2, 3), False),
         5: ((1,), True), 6: ((2,), True), 7: ((3,), True), 8: ((1, 2), True), 9: ((2, 3), True),
         10: ((1, 3), True), 11: ((1, 2, 3), True), 12: ((), True)}
SPEED_RANGE = (0.12, 0.40)   # m/s, service notes reference data
SNR_DB = 60.0                # A-weighted, service notes specifications
FREE = ("head_spacing", "capstan_d", "capstan_ecc", "roller_d", "roller_ecc", "wow_hz", "wow_depth",
        "gap", "spacing")


@dataclass
class TapeEcho:
    speed: float = 0.20                          # m/s, inside SPEED_RANGE
    mode: int = 1
    intensity: float = 0.5                       # feedback gain into the record path
    head_spacing: tuple = (0.025, 0.050, 0.075)  # m from the record head: FREE
    capstan_d: float = 0.004                     # m: FREE
    capstan_ecc: float = 0.0                     # m of eccentricity: FREE
    roller_d: float = 0.020                      # m: FREE
    roller_ecc: float = 0.0                      # FREE
    wow_hz: float = 0.0                          # FREE
    wow_depth: float = 0.0                       # relative speed amplitude: FREE
    gap: float = 3e-6                            # playback gap, m: FREE
    spacing: float = 0.5e-6                      # head-to-tape spacing, m: FREE
    drive: float = 1.0                           # record level into the saturation curve
    hiss: bool = False
    echo_mix: float = 1.0
    reverb_mix: float = 0.3
    seed: int = 0

    def __post_init__(self):
        lo, hi = SPEED_RANGE
        if not lo - 1e-9 <= self.speed <= hi + 1e-9:
            raise ValueError(f"tape speed {self.speed} m/s is outside the documented {lo} to {hi} m/s")
        if self.mode not in MODES:
            raise ValueError("mode selector has positions 1 to 12")

    def head_delays(self):
        """Nominal delay of each playback head, s_k / v (seconds)."""
        return tuple(s / self.speed for s in self.head_spacing)

    def flutter_terms(self):
        """(rate Hz, relative speed depth) for each transport term: capstan, pinch roller, wow."""
        out = []
        for d, e in ((self.capstan_d, self.capstan_ecc), (self.roller_d, self.roller_ecc)):
            if e > 0:
                out.append((self.speed / (math.pi * d), e / (d / 2)))
        if self.wow_depth > 0:
            out.append((self.wow_hz, self.wow_depth))
        return out

    def tape_position(self, n, fs):
        t = np.arange(n) / fs
        rel = np.ones(n)
        for k, (f, a) in enumerate(self.flutter_terms()):
            rel += a * np.sin(2 * math.pi * f * t + 0.7 * k)
        return np.concatenate([[0.0], np.cumsum(self.speed * rel[:-1] / fs)])

    def read_loss(self, fs, taps=63):
        """Linear-phase FIR of the gap loss times the spacing loss at the nominal speed."""
        n = 4096
        f = np.fft.rfftfreq(n, 1 / fs)
        h = np.sinc(self.gap * f / self.speed) * np.exp(-2 * math.pi * self.spacing * f / self.speed)
        ir = np.fft.irfft(h, n)
        ir = np.roll(ir, taps // 2)[:taps] * np.hanning(taps + 2)[1:-1]
        return ir / ir.sum() * h[0]

    def saturate(self, x):
        """Anhysteretic magnetisation, linearised by bias: tanh, unity slope at zero."""
        return np.tanh(self.drive * x) / self.drive

    def process(self, x, fs):
        """Return (wet echo, record-path signal) for mono input x. The tape holds the record signal after
        the read loss, applied once per pass. Blocks are shorter than the shortest head delay less the
        filter's half length, so every read lands on tape already written."""
        heads, _ = MODES[self.mode]
        n = len(x)
        X = self.tape_position(n, fs)
        t = np.arange(n) / fs
        loss = self.read_loss(fs)
        half = len(loss) // 2
        dmin = min(self.head_spacing) / (self.speed * (1 + sum(a for _, a in self.flutter_terms())))
        block = int(dmin * fs) - half - 2
        if block < 1:
            raise ValueError("shortest head delay is shorter than the read-loss filter")
        recp, tape, wet = np.zeros(n + 2 * half), np.zeros(n + 1), np.zeros(n)
        tw = {k: np.interp(X - self.head_spacing[k - 1], X, t, left=-1.0) for k in heads}
        done = 0
        for a in range(0, n, block):
            b = min(n, a + block)
            for k in heads:   # read the tape where this head now sits, written at time tw
                w = tw[k][a:b] * fs
                ok = w >= 0
                i0 = np.floor(w[ok]).astype(int)
                fr = w[ok] - i0
                r = np.zeros(b - a)
                r[ok] = tape[i0] * (1 - fr) + tape[i0 + 1] * fr
                wet[a:b] += r
            recp[a + half:b + half] = self.saturate(x[a:b] + self.intensity * wet[a:b])
            hi = b - half if b < n else n
            if hi > done:
                tape[done:hi] = np.convolve(recp[done:hi + 2 * half], loss, mode="valid")
                done = hi
        return wet + self._hiss(n, fs), recp[half:n + half]

    def _hiss(self, n, fs):
        if not self.hiss:
            return np.zeros(n)
        g = np.random.default_rng(self.seed).standard_normal(n)
        return np.convolve(g, self.read_loss(fs), mode="same") * 10 ** (-SNR_DB / 20) * 0.5

    def render(self, x, fs, dry=1.0):
        """Dry plus echo, plus the spring tank when the mode includes reverb."""
        wet, _ = self.process(x, fs)
        _, rev = MODES[self.mode]
        y = dry * x + (self.echo_mix * wet if MODES[self.mode][0] else 0)
        if rev:
            y = y + self.reverb_mix * spring_tank(x + wet, fs, seed=self.seed)
        return y


def spring_tank(x, fs, lengths=(0.033, 0.037, 0.041), decay_s=2.0, chirp=12, a=0.6, seed=0):
    """Three dispersive springs in parallel. Each is a delay loop whose round trip passes a cascade of
    first-order allpasses, so high frequencies arrive later than low ones and each echo is a chirp, the
    sound of a spring. Round-trip times and the allpass coefficient are free parameters; the unit's three
    springs are documented, their lengths and wire are not."""
    n = len(x)
    out = np.zeros(n)
    for j, L in enumerate(lengths):
        d = int(L * fs)
        g = 10 ** (-3 * L / decay_s)        # -60 dB after decay_s seconds
        y = np.zeros(n)
        buf = x.copy()
        for _ in range(int(decay_s / L) + 1):   # each pass: delay, disperse, attenuate
            buf = np.concatenate([np.zeros(d), buf[:n - d]]) * g
            for _ in range(chirp):
                buf = _allpass(buf, a)
            if np.max(np.abs(buf)) < 1e-6:
                break
            y += buf
        out += y * (1 if j % 2 == 0 else -1)
    return out / len(lengths)


def _allpass(x, a):
    from scipy.signal import lfilter
    return lfilter([-a, 1.0], [1.0, -a], x)
