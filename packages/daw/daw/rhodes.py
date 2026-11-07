# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Electric piano: tine and tone bar as an asymmetric tuning fork, a neoprene hammer, a magnetic pickup.

Tine: a steel cantilever of round wire, clamped at the tone bar block, with a sliding tuning spring as a
point mass. Its modes follow the cantilever roots (1.8751, 4.6941, 7.8548), so the first overtone sits at
6.267 times the fundamental before the spring shifts it; the spring lowers each mode by the Rayleigh ratio
1 / sqrt(1 + m_s phi(x_s)^2 / m), more the nearer it sits to the tip.
Fork: the tine (tip-referred mass m1) and the tone bar (m2, much heavier) stand on one block of mass M,
held to the harp by a lossy mount (K, C). Tuned together, the two roots push the block in opposite
directions and little force reaches the mount; detuned, the tine drags the block and loses energy into the
mount. The decay of the tine mode comes from the eigenvalues of this three-mass system.
Hammer: a neoprene tip against the tine at the striking point, Hertz contact F = K delta^1.5 with
K = (4/3) E* sqrt(R), E* = E / (1 - nu^2), nu = 0.5 for rubber; E from the tip's Shore A durometer by
Gent's relation. The contact is integrated in the tine's modal coordinates until the hammer leaves.
Pickup: the tine tip moves across the pole face at an axial gap g. The flux through the coil is taken as
Phi(y) = (g^2 / (g^2 + (y - y0)^2))^(3/2), a point-dipole falloff (a model assumption), and the coil
voltage is dPhi/dt. Phi is even about the pole centre, so a tine centred on the pole gives no fundamental,
only even harmonics; offsetting it brings the fundamental up.

From the service manual (read as technical reference; nothing copied): wire diameter 0.075 in (1.905 mm)
in the original tine; replacement tine 4-3/8 in (111.1 mm); pickup gap 1/16 to 1/8 in, 0.020 in allowed
mid and treble since 1972; tip hardness grades Shore A 30, 50, 70, 90 and a wrapped tip, bass to treble;
escapement 1/32 to 1/4 in; the tine set slightly above the pole centre; the tine tuned F to A around a G
bar "without appreciable loss of support" (qualitative). Steel E, rho and loss factor come from
packages/measured. Tone bar mass, block, mount, hammer mass, tip radius and spring mass are not in the
manual: FREE, with labelled defaults.
"""
import math
from dataclasses import dataclass

import numpy as np

from . import materials as M
from .shapes_1d import clamped_free_roots

INCH = 0.0254
WIRE_D = 0.075 * INCH            # manual: original tine wire
REPLACEMENT_L = 4.375 * INCH     # manual: replacement tine length
PICKUP_GAP = (INCH / 16, INCH / 8)
TIP_SHORE_A = (30, 50, 70, 90)   # manual: tip grades bass to treble (the fifth is wrapped, extra hard)
FREE = ("bar_ratio", "block_ratio", "mount_hz", "mount_q", "hammer_mass", "tip_radius", "spring_mass")
HERTZ_TC = 2.9432                # contact time = 2.9432 delta_max / v for F = K delta^1.5 (Johnson)


def gent_modulus(shore_a):
    """Young's modulus (Pa) of rubber from Shore A hardness, Gent (1958)."""
    return 1e6 * 0.0981 * (56 + 7.62336 * shore_a) / (0.137505 * (254 - 2.54 * shore_a))


def hertz_stiffness(shore_a, radius):
    e_star = gent_modulus(shore_a) / (1 - 0.5 ** 2)
    return 4.0 / 3.0 * e_star * math.sqrt(radius)


def contact_time_closed(mass, k, v):
    """Hertz impact on a rigid wall: delta_max = (5 m v^2 / 4K)^(2/5), contact time 2.9432 delta_max / v."""
    return HERTZ_TC * (5 * mass * v * v / (4 * k)) ** 0.4 / v


def cantilever_shape(beta, xi):
    """Cantilever mode shape at xi = x / L, scaled so its mean square over the length is 1 (tip = +-2)."""
    s = (math.cosh(beta) + math.cos(beta)) / (math.sinh(beta) + math.sin(beta))
    bx = beta * np.asarray(xi, float)
    return np.cosh(bx) - np.cos(bx) - s * (np.sinh(bx) - np.sin(bx))


@dataclass
class Tine:
    length: float
    diameter: float = WIRE_D
    spring_mass: float = 3e-4      # kg: FREE
    spring_at: float = 0.8         # x / L
    material: str = "steel_mild"

    @property
    def mat(self):
        return M.material(self.material)

    @property
    def mass(self):
        return self.mat.rho * math.pi * self.diameter ** 2 / 4 * self.length

    def bare_hz(self, n=3):
        beta = clamped_free_roots(n)
        c = self.mat.c_bar * self.diameter / 4          # sqrt(E I / rho A) for a round wire
        return beta ** 2 * c / (2 * math.pi * self.length ** 2)

    def modes_hz(self, n=3):
        beta = clamped_free_roots(n)
        phi = np.array([cantilever_shape(b, self.spring_at) for b in beta])
        return self.bare_hz(n) / np.sqrt(1 + self.spring_mass * phi ** 2 / self.mass)

    def tip_mass(self):
        """Mass of mode 1 referred to the tip (tip shape value 2), spring included."""
        phi = cantilever_shape(clamped_free_roots(1)[0], self.spring_at)
        return (self.mass + self.spring_mass * phi ** 2) / 4.0


def tine_for(f_hz, **kw):
    """The tine length that sounds f_hz with its spring in place (bisection on length)."""
    lo, hi = 0.005, 0.5
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if Tine(mid, **kw).modes_hz(1)[0] > f_hz:
            lo = mid
        else:
            hi = mid
    return Tine(0.5 * (lo + hi), **kw)


@dataclass
class Fork:
    tine: Tine
    bar_hz: float
    bar_ratio: float = 12.0       # m2 / m1: FREE
    block_ratio: float = 1.0      # M / m2: FREE
    mount_hz: float = 40.0        # block-on-mount resonance: FREE
    mount_q: float = 2.0          # FREE
    bar_eta: float | None = None  # brass loss factor from the table (from memory there)

    def matrices(self):
        m1 = self.tine.tip_mass()
        w1 = 2 * math.pi * self.tine.modes_hz(1)[0]
        m2 = self.bar_ratio * m1
        w2 = 2 * math.pi * self.bar_hz
        mb = self.block_ratio * m2
        k1, k2 = m1 * w1 ** 2, m2 * w2 ** 2
        wm = 2 * math.pi * self.mount_hz
        km, cm = mb * wm ** 2, mb * wm / self.mount_q
        eta2 = M.material("brass").eta if self.bar_eta is None else self.bar_eta
        c1, c2 = self.tine.mat.eta * m1 * w1, eta2 * m2 * w2
        Mm = np.diag([m1, m2, mb])
        K = np.array([[k1, 0, -k1], [0, k2, -k2], [-k1, -k2, k1 + k2 + km]])
        C = np.array([[c1, 0, -c1], [0, c2, -c2], [-c1, -c2, c1 + c2 + cm]])
        return Mm, K, C

    def state_matrix(self):
        Mm, K, C = self.matrices()
        Mi = np.linalg.inv(Mm)
        return np.block([[np.zeros((3, 3)), np.eye(3)], [-Mi @ K, -Mi @ C]])

    def tine_mode(self):
        """(frequency Hz, T60 s, eigenvalue, eigenvector) of the mode with the most tine motion."""
        lam, V = np.linalg.eig(self.state_matrix())
        best = None
        for i in range(6):
            if lam[i].imag <= 0:
                continue
            v = V[:3, i]
            share = abs(v[0]) ** 2 / np.sum(np.abs(v) ** 2)
            if best is None or share > best[0]:
                best = (share, i)
        i = best[1]
        return lam[i].imag / (2 * math.pi), 6.9078 / -lam[i].real, lam[i], V[:, i]

    def free_response(self, x0, v0, fs, seconds):
        """Displacements (tine tip, bar, block) from initial state, by the eigen solution of the linear system."""
        lam, V = np.linalg.eig(self.state_matrix())
        a = np.linalg.solve(V, np.concatenate([x0, v0]).astype(complex))
        t = np.arange(int(fs * seconds)) / fs
        return np.real((V[:3] * a) @ np.exp(np.outer(lam, t)))


def strike(tine, shore_a=50, v=2.0, hammer_mass=0.006, tip_radius=0.006, at=0.12, fs=48000, n_modes=3):
    """Hammer against the tine at x / L = at. Returns (modal velocities at release, contact time s, peak
    force N). The modal masses are the tine's (mean-square shape 1); the tine's coupling to its bar is
    left out for the few milliseconds of contact."""
    beta = clamped_free_roots(n_modes)
    phi_h = np.array([cantilever_shape(b, at) for b in beta])
    phi_s = np.array([cantilever_shape(b, tine.spring_at) for b in beta])
    m = tine.mass + tine.spring_mass * phi_s ** 2
    w = 2 * math.pi * tine.modes_hz(n_modes)
    k = hertz_stiffness(shore_a, tip_radius)
    dt = 1.0 / (fs * 64)
    q, qd = np.zeros(n_modes), np.zeros(n_modes)
    xh, vh, t, fmax, touching = 0.0, v, 0.0, 0.0, False
    for _ in range(int(0.05 / dt)):
        d = xh - float(phi_h @ q)
        f = k * d ** 1.5 if d > 0 else 0.0
        if f > 0:
            touching = True
        elif touching:
            break
        fmax = max(fmax, f)
        vh -= f / hammer_mass * dt                     # semi-implicit Euler
        qd += (f * phi_h - m * w ** 2 * q) / m * dt
        xh += vh * dt
        q += qd * dt
        t += dt
    return q, qd, t, fmax


def contact_rigid(shore_a, v, hammer_mass, tip_radius, fs=48000):
    """The same integrator against a rigid wall, for the Hertz closed form check."""
    k = hertz_stiffness(shore_a, tip_radius)
    dt = 1.0 / (fs * 256)
    x, vv, t = 0.0, v, 0.0
    while True:
        f = k * x ** 1.5 if x > 0 else 0.0
        vv -= f / hammer_mass * dt
        x += vv * dt
        t += dt
        if x <= 0 and t > dt:
            return t


def pickup_flux(y, gap, offset=0.0):
    return (gap ** 2 / (gap ** 2 + (y - offset) ** 2)) ** 1.5


def pickup(y, fs, gap=PICKUP_GAP[0], offset=0.0):
    """Coil voltage, dPhi/dt, for tine tip displacement y (m)."""
    return np.gradient(pickup_flux(y, gap, offset)) * fs


def harmonics(v, fs, f0, count=4):
    """Amplitudes of harmonics 1..count of a steady signal by a windowed projection."""
    t = np.arange(len(v)) / fs
    w = np.hanning(len(v))
    return np.array([abs(np.sum(v * w * np.exp(-2j * math.pi * h * f0 * t))) for h in range(1, count + 1)])


def note(f_hz, fs=48000, seconds=3.0, velocity=2.0, shore_a=50, offset=0.25, gap=PICKUP_GAP[0],
         bar_detune=0.0, upper_eta=3e-3, release=None, **fork_kw):
    """One note: strike, the fork's free ring for mode 1, the tine's upper modes decaying on their own
    (loss factor upper_eta: FREE), the tip motion through the pickup. offset is in units of the gap.
    bar_detune shifts the tone bar in semitones from the tine. release: seconds to the damper, after which
    every mode decays with a 0.1 s T60. Returns (voltage normalised to peak 1, tip displacement m)."""
    tine = tine_for(f_hz)
    q, qd, _, _ = strike(tine, shore_a=shore_a, v=velocity, fs=fs)
    beta = clamped_free_roots(3)
    tip = np.array([cantilever_shape(b, 1.0) for b in beta])
    fork = Fork(tine, f_hz * 2 ** (bar_detune / 12), **fork_kw)
    y = fork.free_response([q[0] * tip[0], 0, 0], [qd[0] * tip[0], 0, 0], fs, seconds)[0]
    t = np.arange(len(y)) / fs
    for n in (1, 2):
        w = 2 * math.pi * tine.modes_hz(3)[n]
        a = math.pi * w / (2 * math.pi) * (tine.mat.eta + upper_eta)
        y = y + tip[n] * np.exp(-a * t) * (q[n] * np.cos(w * t) + (qd[n] + a * q[n]) / w * np.sin(w * t))
    if release is not None:
        i = int(release * fs)
        y[i:] *= np.exp(-6.9078 / 0.1 * (t[i:] - t[i]))
    v = pickup(y, fs, gap, offset * gap)
    return v / np.max(np.abs(v)), y
