"""Signed-distance primitives, operators and noise, vectorised over (N, 3) numpy arrays.

Art-direction R&D tool for Low Water (design/art). Own code, no third-party geometry or shaders.
Distances are in metres. Every primitive takes points P of shape (N, 3) and returns (N,).
"""
import numpy as np

# ---------------------------------------------------------------- helpers

def length(v):
    return np.sqrt(np.einsum('ij,ij->i', v, v))


def rot_x(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_z(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


class Frame:
    """A rigid frame: world = R @ local + o. to_local maps world points into the frame."""

    def __init__(self, o=(0, 0, 0), R=None):
        self.o = np.asarray(o, float)
        self.R = np.eye(3) if R is None else np.asarray(R, float)

    def to_local(self, P):
        return (P - self.o) @ self.R

    def to_world(self, p):
        return np.asarray(p, float) @ self.R.T + self.o

    def child(self, o=(0, 0, 0), R=None):
        R2 = np.eye(3) if R is None else np.asarray(R, float)
        return Frame(self.to_world(o), self.R @ R2)


# ---------------------------------------------------------------- primitives

def sphere(P, c, r):
    return length(P - np.asarray(c, float)) - r


def ellipsoid(P, c, r):
    """Quilez's bound for an ellipsoid with radii r."""
    q = (P - np.asarray(c, float))
    r = np.asarray(r, float)
    k0 = length(q / r)
    k1 = length(q / (r * r))
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def box(P, c, b, rr=0.0):
    q = np.abs(P - np.asarray(c, float)) - (np.asarray(b, float) - rr)
    out = length(np.maximum(q, 0.0))
    inside = np.minimum(np.max(q, axis=1), 0.0)
    return out + inside - rr


def capsule(P, a, b, r):
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    pa = P - a
    ba = b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0.0, 1.0)
    return length(pa - h[:, None] * ba) - r


def round_cone(P, a, b, r1, r2):
    """Capsule with radius r1 at a and r2 at b (Quilez, arbitrary orientation)."""
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    ba = b - a
    l2 = ba @ ba
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = P - a
    y = pa @ ba
    z = y - l2
    xv = pa * l2 - y[:, None] * ba
    x2 = np.einsum('ij,ij->i', xv, xv)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d = np.empty(len(P))
    m1 = np.sign(z) * a2 * z2 > k
    m2 = (~m1) & (np.sign(y) * a2 * y2 < k)
    m3 = ~(m1 | m2)
    d[m1] = np.sqrt(x2[m1] + z2[m1]) * il2 - r2
    d[m2] = np.sqrt(x2[m2] + y2[m2]) * il2 - r1
    d[m3] = (np.sqrt(x2[m3] * a2 * il2) + y[m3] * rr) * il2 - r1
    return d


def cyl_y(P, c, r, h):
    """Vertical capped cylinder, centre c, radius r, half-height h."""
    q = P - np.asarray(c, float)
    dx = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2) - r
    dy = np.abs(q[:, 1]) - h
    out = np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2)
    return out + np.minimum(np.maximum(dx, dy), 0.0)


def cone_y(P, c, r0, r1, h):
    """Vertical capped cone (frustum), base radius r0 at c.y - h, top radius r1 at c.y + h."""
    q = P - np.asarray(c, float)
    qx = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2)
    qy = q[:, 1]
    k1 = np.array([r1, h])
    k2 = np.array([r1 - r0, 2.0 * h])
    cax = qx - np.minimum(qx, np.where(qy < 0, r0, r1))
    cay = np.abs(qy) - h
    t = np.clip(((k1[0] - qx) * k2[0] + (k1[1] - qy) * k2[1]) / (k2 @ k2), 0, 1)
    cbx = qx - k1[0] + k2[0] * t
    cby = qy - k1[1] + k2[1] * t
    s = np.where((cbx < 0) & (cay < 0), -1.0, 1.0)
    return s * np.sqrt(np.minimum(cax * cax + cay * cay, cbx * cbx + cby * cby))


def torus_y(P, c, R, r):
    q = P - np.asarray(c, float)
    qx = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2) - R
    return np.sqrt(qx * qx + q[:, 1] ** 2) - r


def plane_y(P, h):
    return P[:, 1] - h


# ---------------------------------------------------------------- operators

def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1.0 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def onion(d, t):
    return np.abs(d) - t


# ---------------------------------------------------------------- noise

def _hash3(ix, iy, iz):
    h = (ix.astype(np.int64) * 374761393 + iy.astype(np.int64) * 668265263
         + iz.astype(np.int64) * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFF).astype(np.float64) / 65535.0


def vnoise(P, freq=1.0, seed=0):
    """Smooth 3D value noise in [0, 1]."""
    Q = P * freq + seed * 17.13
    i = np.floor(Q)
    f = Q - i
    u = f * f * (3 - 2 * f)
    ix, iy, iz = i[:, 0], i[:, 1], i[:, 2]
    out = 0.0
    for dx in (0, 1):
        wx = u[:, 0] if dx else 1 - u[:, 0]
        for dy in (0, 1):
            wy = u[:, 1] if dy else 1 - u[:, 1]
            for dz in (0, 1):
                wz = u[:, 2] if dz else 1 - u[:, 2]
                out = out + wx * wy * wz * _hash3(ix + dx, iy + dy, iz + dz)
    return out


def fbm(P, freq=1.0, octaves=4, seed=0, gain=0.5):
    amp, tot, norm = 1.0, 0.0, 0.0
    for o in range(octaves):
        tot = tot + amp * vnoise(P, freq * (2.03 ** o), seed + o * 7)
        norm += amp
        amp *= gain
    return tot / norm


def ridged(P, freq=1.0, octaves=3, seed=0):
    amp, tot, norm = 1.0, 0.0, 0.0
    for o in range(octaves):
        n = 1.0 - np.abs(vnoise(P, freq * (2.1 ** o), seed + o * 5) * 2 - 1)
        tot = tot + amp * n * n
        norm += amp
        amp *= 0.55
    return tot / norm
