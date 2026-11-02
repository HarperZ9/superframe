# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Images on lattices: point sampling with a matched kernel, and decomposition into primitives.

Pixels sit at integer (x, y), image shape (H, W), values in [0, 1]. A primitive i has a centre
p_i, a support weight w_i(x) (a Gaussian disc or a soft hexagon) and a colour field: constant
c_i, or first order c_i + g_i . (x - p_i) / h. Weights are normalised to a partition of unity,
so the picture is sum_i w_i(x) colour_i(x) / sum_i w_i(x). With centres and supports fixed, the
colours enter linearly and the best fit is an exact least-squares solve.
"""
import math

import numpy as np
from scipy import ndimage, sparse
from scipy.sparse.linalg import spsolve
from scipy.spatial import cKDTree

SQ3 = math.sqrt(3.0)


def weights(points, shape, kind, h, s, beta=8.0, rot_deg=0.0, scales=None):
    """Sparse (pixels x primitives) support weights, unnormalised.

    kind 'gauss': exp(-|d|^2 / (2 (s h_i)^2)). kind 'hex': logistic soft hexagon, face normals
    toward the hex-lattice neighbours (rotated by rot_deg), apothem s h_i / 2, sharpness beta.
    h_i = h unless per-primitive `scales` are given.
    """
    H, W = shape
    hi = np.full(len(points), float(h)) if scales is None else np.asarray(scales, float)
    reach = 3.0 * s * hi if kind == "gauss" else np.maximum(1.6 * s * hi / 2 / math.cos(math.pi / 6), 2.0 * hi)
    R = int(math.ceil(reach.max()))
    off = np.arange(-R, R + 1)
    ox, oy = np.meshgrid(off, off, indexing="xy")
    ox, oy = ox.ravel(), oy.ravel()
    cx, cy = np.round(points[:, 0]).astype(int), np.round(points[:, 1]).astype(int)
    px = cx[:, None] + ox[None, :]
    py = cy[:, None] + oy[None, :]
    dx, dy = px - points[:, 0:1], py - points[:, 1:2]
    if kind == "gauss":
        w = np.exp(-(dx ** 2 + dy ** 2) / (2 * (s * hi[:, None]) ** 2))
    else:
        a = s * hi[:, None] / 2
        t0 = math.radians(rot_deg)
        hn = np.zeros_like(dx, float)
        for j in range(3):
            t = t0 + j * math.pi / 3
            hn = np.maximum(hn, np.abs(dx * math.cos(t) + dy * math.sin(t)))
        w = 1.0 / (1.0 + np.exp(np.clip(beta * (hn / a - 1.0), -50, 50)))
        # a faint Gaussian floor so a sharp tile set leaves no pixel uncovered (border gaps)
        w = w + 1e-6 * np.exp(-(dx ** 2 + dy ** 2) / (2 * hi[:, None] ** 2))
    ok = (px >= 0) & (px < W) & (py >= 0) & (py < H) & (np.hypot(dx, dy) <= reach[:, None]) & (w > 1e-12)
    rows = (py * W + px)[ok]
    cols = np.broadcast_to(np.arange(len(points))[:, None], ok.shape)[ok]
    return sparse.csr_matrix((w[ok], (rows, cols)), shape=(H * W, len(points))), (dx, dy, ok, rows, cols, w[ok])


def normalise(Wm):
    tot = np.asarray(Wm.sum(axis=1)).ravel()
    tot[tot < 1e-12] = 1e-12
    return sparse.diags(1.0 / tot) @ Wm, tot


def sample_reconstruct(img, points, h, s_pre, s_rec, kind="gauss", rot_deg=0.0):
    """Prefilter (Gaussian, s_pre h), sample at points (cubic spline), rebuild by normalised kernel."""
    pre = ndimage.gaussian_filter(img, s_pre * h, mode="reflect") if s_pre > 0 else img
    vals = ndimage.map_coordinates(pre, [points[:, 1], points[:, 0]], order=3, mode="reflect")
    Wm, _ = weights(points, img.shape, kind, h, s_rec, rot_deg=rot_deg)
    Wn, tot = normalise(Wm)
    out = (Wn @ vals).reshape(img.shape)
    return out


def design(points, shape, kind, h, s, field, beta=8.0, rot_deg=0.0, scales=None):
    """Columns for a least-squares colour fit: 1 per primitive (const) or 3 (first order)."""
    Wm, (dx, dy, ok, rows, cols, wraw) = weights(points, shape, kind, h, s, beta, rot_deg, scales)
    Wn, tot = normalise(Wm)
    if field == "const":
        return Wn.tocsc()
    n = len(points)
    wv = wraw / np.maximum(tot[rows], 1e-12)
    hh = (np.full(n, float(h)) if scales is None else np.asarray(scales, float))[cols]
    gx = sparse.csr_matrix((wv * dx[ok] / hh, (rows, cols)), shape=Wn.shape)
    gy = sparse.csr_matrix((wv * dy[ok] / hh, (rows, cols)), shape=Wn.shape)
    return sparse.hstack([Wn, gx, gy]).tocsc()


def fit(img, A, train_mask, ridge=1e-6):
    """Ridge least squares on the training pixels, per channel. Returns the full rebuilt image."""
    H, W = img.shape[:2]
    X = img.reshape(H * W, -1)
    At = A[np.flatnonzero(train_mask.ravel())]
    N = At.T @ At + ridge * sparse.identity(A.shape[1], format="csc")
    out = np.zeros_like(X)
    for ch in range(X.shape[1]):
        coef = spsolve(N.tocsc(), At.T @ X[train_mask.ravel(), ch])
        out[:, ch] = A @ coef
    return out.reshape(img.shape)


def lloyd(img_gray, n, iters=15, gamma=0.5, eps=0.02, init=None, rng=None):
    """Weighted centroidal Voronoi placement, density proportional to (|grad| + eps)^gamma."""
    H, W = img_gray.shape
    g = ndimage.gaussian_gradient_magnitude(img_gray, 1.0)
    dens = (g / (g.max() + 1e-12) + eps) ** gamma
    yy, xx = np.mgrid[0:H, 0:W]
    pix = np.stack([xx.ravel(), yy.ravel()], 1).astype(float)
    wv = dens.ravel()
    if init is None:
        rng = rng or np.random.default_rng(0)
        prob = wv / wv.sum()
        init = pix[rng.choice(len(pix), n, replace=False, p=prob)] + rng.uniform(-.5, .5, (n, 2))
    P = np.array(init, float)
    for _ in range(iters):
        _, lab = cKDTree(P).query(pix)
        sw = np.bincount(lab, wv, minlength=len(P))
        sx = np.bincount(lab, wv * pix[:, 0], minlength=len(P))
        sy = np.bincount(lab, wv * pix[:, 1], minlength=len(P))
        moved = sw > 0
        P[moved] = np.stack([sx[moved] / sw[moved], sy[moved] / sw[moved]], 1)
    return P


def local_scale(P, k=3):
    d, _ = cKDTree(P).query(P, k + 1)
    return d[:, 1:].mean(1)


def psnr(a, b, mask=None):
    e = (a - b) ** 2
    mse = float(e[mask].mean() if mask is not None else e.mean())
    return 10 * math.log10(1.0 / max(mse, 1e-12))


def ssim(a, b, sigma=1.5):
    """Mean SSIM with a Gaussian window (Wang et al. 2004 constants), grey or per channel."""
    if a.ndim == 3:
        return float(np.mean([ssim(a[..., c], b[..., c], sigma) for c in range(a.shape[2])]))
    C1, C2 = 0.01 ** 2, 0.03 ** 2
    f = lambda z: ndimage.gaussian_filter(z, sigma, truncate=3.5)
    ma, mb = f(a), f(b)
    va, vb, cab = f(a * a) - ma ** 2, f(b * b) - mb ** 2, f(a * b) - ma * mb
    s = ((2 * ma * mb + C1) * (2 * cab + C2)) / ((ma ** 2 + mb ** 2 + C1) * (va + vb + C2))
    return float(s.mean())


def axis_alignment(img_gray, wedge_deg=7.5, kmin=4):
    """Spectral power share within +-wedge of the x and y axes over its isotropic share.

    1 is isotropic; above 1 the spectrum leans on the pixel axes (architecture, text).
    A Hann window suppresses the border cross.
    """
    H, W = img_gray.shape
    win = np.outer(np.hanning(H), np.hanning(W))
    F = np.abs(np.fft.fftshift(np.fft.fft2((img_gray - img_gray.mean()) * win))) ** 2
    ky, kx = np.mgrid[-(H // 2):H - H // 2, -(W // 2):W - W // 2]
    r = np.hypot(kx * H / W, ky)
    ang = np.degrees(np.arctan2(ky, kx * H / W)) % 180
    use = (r >= kmin) & (r <= min(H, W) / 2)
    near = np.minimum(np.minimum(ang, 180 - ang), np.abs(ang - 90)) <= wedge_deg
    share = F[use & near].sum() / F[use].sum()
    return float(share / (4 * wedge_deg / 180))
