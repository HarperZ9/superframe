# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Vector ray trace: spheres, even aspheres, surface tilt and decentre. Works on real or complex inputs.

Direction cosines (L, M, N); z runs along the axis; mm. Optical path counts from the launch plane normal to the ray bundle.
Rejects: missed surface, total internal reflection, and any backward segment after the launch (the F180 bug). Aperture
clipping is reported apart from geometric validity, so a merit can see it either way.
"""
import numpy as np


def _safe_sqrt(v, ok):
    bad = v.real <= 0
    ok &= ~bad
    return np.sqrt(np.where(bad, 1.0 + 0 * v, v)), ok


def sag_grad(c, k, a, x, y, ok):
    """Returns sag, d sag/dx, d sag/dy, ok."""
    r2 = x * x + y * y
    root, ok = _safe_sqrt(1 - (1 + k) * c * c * r2, ok)
    z = c * r2 / (1 + root)
    slope = c / root
    for j in range(a.shape[0]):
        if a[j] != 0:
            z = z + a[j] * r2 ** (j + 2)
            slope = slope + a[j] * (2 * j + 4) * r2 ** (j + 1)
    return z, x * slope, y * slope, ok


def _intersect(c, k, a, x, y, z, L, M, N, ok):
    """Distance along the ray to the surface whose vertex is at the local origin, plus the local normal."""
    if k == 0 and not np.any(a != 0):
        F = c * (x * x + y * y + z * z) - 2 * z
        G = N - c * (L * x + M * y + N * z)
        rt, ok = _safe_sqrt(G * G - c * F, ok)
        s = F / (G + rt)
        px, py, pz = x + s * L, y + s * M, z + s * N
        nx, ny, nz = -c * px, -c * py, 1 - c * pz
        return s, px, py, pz, nx, ny, nz, ok
    s = -z / N
    for _ in range(12):
        px, py, pz = x + s * L, y + s * M, z + s * N
        sg, sx, sy, ok = sag_grad(c, k, a, px, py, ok)
        f = pz - sg
        fp = N - sx * L - sy * M
        s = s - f / fp
    px, py, pz = x + s * L, y + s * M, z + s * N
    sg, sx, sy, ok = sag_grad(c, k, a, px, py, ok)
    ok &= np.abs(pz - sg).real < 1e-9
    norm = np.sqrt(1 + sx * sx + sy * sy)
    return s, px, py, pz, -sx / norm, -sy / norm, 1 / norm, ok


def _rotate(ax, ay, x, y, z):
    """Small-or-large rotation: first about x by ax, then about y by ay."""
    if ax == 0 and ay == 0:
        return x, y, z
    ca, sa, cb, sb = np.cos(ax), np.sin(ax), np.cos(ay), np.sin(ay)
    y1, z1 = ca * y - sa * z, sa * y + ca * z
    return cb * x + sb * z1, y1, -sb * x + cb * z1


def _unrotate(ax, ay, x, y, z):
    if ax == 0 and ay == 0:
        return x, y, z
    ca, sa, cb, sb = np.cos(ax), np.sin(ax), np.cos(ay), np.sin(ay)
    x1, z1 = cb * x - sb * z, sb * x + cb * z
    return x1, ca * y + sa * z1, -sa * y + ca * z1


def trace(lens, w, rays, keep=False, image_shift=0.0):
    """rays: dict x y z L M N, opl optional. Traces to the plane sum(t) + image_shift behind the first vertex."""
    x, y, z, L, M, N = (rays[q] for q in "x y z L M N".split())
    opl = rays.get("opl", 0 * x)
    ok = np.ones(np.shape(x), bool)
    clip = np.ones(np.shape(x), bool)
    nrow = lens.n[w]
    zv, heights, cos_in, cos_out = 0.0 + 0j, [], [], []
    m = len(lens.c)
    for i in range(m):
        c, k, a = lens.c[i], lens.k[i], lens.a[i]
        lx, ly, lz = _rotate(lens.ax[i], lens.ay[i], x - lens.dx[i], y - lens.dy[i], z - zv)
        lL, lM, lN = _rotate(lens.ax[i], lens.ay[i], L, M, N)
        s, px, py, pz, nx, ny, nz, ok = _intersect(c, k, a, lx, ly, lz, lL, lM, lN, ok)
        if i > 0:
            ok &= s.real > -1e-9
        opl = opl + nrow[i] * s
        h2 = px * px + py * py
        clip &= h2.real <= lens.semi[i] ** 2 * (1 + 1e-9)
        heights.append(np.sqrt(h2.real))
        norm = np.sqrt(nx * nx + ny * ny + nz * nz)
        nx, ny, nz = nx / norm, ny / norm, nz / norm
        cosi = lL * nx + lM * ny + lN * nz
        mu = nrow[i] / nrow[i + 1]
        rt, ok = _safe_sqrt(1 - mu * mu * (1 - cosi * cosi), ok)
        g = rt - mu * cosi
        lL, lM, lN = mu * lL + g * nx, mu * lM + g * ny, mu * lN + g * nz
        if keep:
            cos_in.append(cosi.real.copy())
            cos_out.append(rt.real.copy())
        if lens.irr[i, 0] != 0 or lens.irr[i, 1] != 0:
            u2, v2 = (px / lens.semi[i]) ** 2, (py / lens.semi[i]) ** 2
            rho2 = u2 + v2
            opl = opl + (nrow[i + 1] - nrow[i]) * (lens.irr[i, 0] * (u2 - v2) + lens.irr[i, 1] * (rho2 * rho2 - rho2))
        x, y, z = _unrotate(lens.ax[i], lens.ay[i], px, py, pz)
        L, M, N = _unrotate(lens.ax[i], lens.ay[i], lL, lM, lN)
        x, y, z = x + lens.dx[i], y + lens.dy[i], z + zv
        if i < m - 1:
            zv = zv + lens.t[i]
    zi = zv + lens.t[m - 1] + image_shift
    s = (zi - z) / N
    ok &= s.real > -1e-9
    out = dict(x=x + s * L, y=y + s * M, z=zi, L=L, M=M, N=N, opl=opl + nrow[m] * s, ok=ok, clip=clip)
    if keep:
        out.update(heights=heights, cos_in=cos_in, cos_out=cos_out)
    return out


def paraxial(lens, w=None):
    """EFL and back focal distance from a marginal ray at y = 1, u = 0."""
    w = lens.primary if w is None else w
    n = lens.n[w]
    y, u = 1.0 + 0j, 0.0 + 0j
    for i in range(len(lens.c)):
        u = (n[i] * u - y * (n[i + 1] - n[i]) * lens.c[i]) / n[i + 1]
        if i < len(lens.c) - 1:
            y = y + lens.t[i] * u
    return -1.0 / u, -y / u


def entrance_pupil(lens, w=None):
    """Axial position of the entrance pupil from the first vertex, and the pupil magnification to the stop."""
    w = lens.primary if w is None else w
    n, st = lens.n[w], lens.stop

    def run(y, u):
        for i in range(st):
            u = (n[i] * u - y * (n[i + 1] - n[i]) * lens.c[i]) / n[i + 1]
            y = y + lens.t[i] * u
        return y
    a, b = run(1.0 + 0j, 0j), run(0j, 1.0 + 0j)
    # y_stop = a y0 + b u0. A ray aimed at (z_e, 0) has y0 = -z_e u0, so y_stop = 0 when z_e = b / a.
    return b / a, a


def launch(direction_deg, y0, x_grid, y_grid, zback):
    """A plane-wave bundle with field in the y-z plane. y0: height where its centre ray crosses z = 0."""
    th = np.radians(direction_deg)
    Ld, Md, Nd = 0.0, np.sin(th), np.cos(th)
    # plane normal to the bundle: points = (u, y0 + v cos th, -v sin th)
    x = x_grid + 0j
    y = y0 + y_grid * np.cos(th)
    z = -y_grid * np.sin(th)
    b = zback
    return dict(x=x - b * Ld, y=y - b * Md, z=z - b * Nd, L=np.full_like(x, Ld), M=np.full_like(x, Md), N=np.full_like(x, Nd))
