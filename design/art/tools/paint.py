"""Direction A, 'Oil and Ink': an expressionist oil-paint treatment of the shared G-buffer.

Base: the lit HDR image, massed into a few painted value planes with violet-teal shadows and warm
lights. Paint: coarse-to-fine strokes (after Hertzmann's layered painterly rendering, 1998) that
follow the structure-tensor flow, with finer brushes kept for faces, hands and props. Surface:
bristle texture by line-integral convolution along the flow, a little impasto relief. Ink: a
violet-brown line from depth, normal and identity breaks, heavier on silhouettes than folds.
"""
import sys
import numpy as np
import cv2
from PIL import Image
import cine
import scene as scn

INK = np.array([0.10, 0.045, 0.075])
DETAIL_MATS = (20, 21, 22, 23, 24, 27, 28, 29, 25, 26, 49, 32, 39, 38, 45, 33, 47)


def lum(x):
    return x[..., 0] * 0.2126 + x[..., 1] * 0.7152 + x[..., 2] * 0.0722


def painted_base(hdr, exposure, bands=5, shadow=(0.15, 0.11, 0.40), mid=(0.06, 0.16, 0.20), warm=(1.0, 0.82, 0.58),
                 sat=0.95, skin=None, nx=None):
    ldr = cine.filmic(hdr * exposure)
    L = lum(ldr)
    v = np.clip(L, 0, 1) ** (1 / 2.2)
    q = v * bands
    f = q - np.floor(q)
    edge = np.clip((f - 0.5) * 6 + 0.5, 0, 1)  # soft step: planes of value, brushy edges
    vb = (np.floor(q) + edge) / bands
    vb = 0.65 * vb + 0.35 * v
    chroma = ldr / np.maximum(L[..., None], 1e-4)
    chroma = np.clip(1 + (chroma - 1) * sat, 0, 3)
    s = np.clip(1 - vb * 1.8, 0, 1)[..., None] ** 0.8
    m = np.clip(1 - np.abs(vb - 0.45) * 3.0, 0, 1)[..., None]
    hi = np.clip((vb - 0.62) * 2.6, 0, 1)[..., None]
    shadow = np.asarray(shadow, float)
    out = chroma * vb[..., None]
    if skin is not None:  # verdaccio: green-olive halftones on skin, rose in the light
        sk = skin[..., None]
        out = out * (1 - sk * m * 0.45) + np.array([0.20, 0.26, 0.14]) * vb[..., None] * 1.6 * sk * m * 0.45
        out = out + np.array([0.06, -0.01, 0.0]) * sk * hi
    if nx is not None:  # cool planes turn violet on one side, teal on the other
        tcol = np.asarray(shadow)[None, None, :] * (0.5 + 0.5 * nx[..., None]) + np.array([0.07, 0.24, 0.30]) * (0.5 - 0.5 * nx[..., None])
        shadow = tcol
    out = out * (1 - s * 0.8) + shadow * s * 0.8 * (0.25 + 1.5 * vb[..., None])
    out = out + np.asarray(mid) * m * 0.10
    out = out * (1 - hi * 0.3) + np.asarray(warm) * vb[..., None] * hi * 0.3
    return np.clip(out, 0, 1)


def flow_field(img, sigma=3.0):
    g = lum(img).astype(np.float32)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    Jxx = cv2.GaussianBlur(gx * gx, (0, 0), sigma)
    Jyy = cv2.GaussianBlur(gy * gy, (0, 0), sigma)
    Jxy = cv2.GaussianBlur(gx * gy, (0, 0), sigma)
    ang = 0.5 * np.arctan2(2 * Jxy, Jxx - Jyy) + np.pi / 2  # along edges, across the gradient
    coh = np.sqrt((Jxx - Jyy) ** 2 + 4 * Jxy ** 2) / (Jxx + Jyy + 1e-6)
    return np.cos(ang), np.sin(ang), coh


def geo_flow(G, w, h):
    """Stroke direction from geometry: across the screen-projected normal (cross-contour)."""
    N = G['N'].reshape(h, w, 3).astype(np.float32)
    # camera basis from first and last rays: approximate screen axes by D gradients
    D = G['D'].reshape(h, w, 3).astype(np.float32)
    rx = D[:, -1:, :] - D[:, :1, :]
    rx /= np.linalg.norm(rx, axis=2, keepdims=True) + 1e-6
    uy = D[:1, :, :] - D[-1:, :, :]
    uy /= np.linalg.norm(uy, axis=2, keepdims=True) + 1e-6
    nx = (N * rx).sum(2)
    ny = -(N * uy).sum(2)
    a = np.arctan2(ny, nx) + np.pi / 2
    return np.cos(a), np.sin(a), np.clip(np.sqrt(nx * nx + ny * ny), 0, 1)


def paint_layer(canvas, ref, fx, fy, r, mask, rng, thresh, maxlen, jitter, block=None):
    h, w, _ = ref.shape
    step = max(1, int(r * 0.9))
    ys, xs = np.mgrid[step // 2:h:step, step // 2:w:step]
    ys = ys.ravel() + rng.integers(-step // 2, step // 2 + 1, ys.size)
    xs = xs.ravel() + rng.integers(-step // 2, step // 2 + 1, xs.size)
    ys = np.clip(ys, 0, h - 1); xs = np.clip(xs, 0, w - 1)
    err = np.abs(canvas[ys, xs] - ref[ys, xs]).sum(1)
    keep = (err > thresh) & (mask[ys, xs] > 0.5)
    ys, xs = ys[keep], xs[keep]
    order = rng.permutation(len(ys))
    ys, xs = ys[order], xs[order]
    col = ref[ys, xs].copy()
    col *= (1 + rng.normal(0, jitter, (len(col), 1)))
    col += rng.normal(0, jitter * 0.35, col.shape)
    col = np.clip(col, 0, 1)
    # trace all strokes in parallel along the flow
    px = xs.astype(np.float32); py = ys.astype(np.float32)
    pts = [np.stack([px, py], 1)]
    dx0 = fx[ys, xs]; dy0 = fy[ys, xs]
    alive = np.ones(len(px), bool)
    for s in range(maxlen):
        ix = np.clip(px.astype(int), 0, w - 1); iy = np.clip(py.astype(int), 0, h - 1)
        dx = fx[iy, ix]; dy = fy[iy, ix]
        flip = dx * dx0 + dy * dy0 < 0
        dx = np.where(flip, -dx, dx); dy = np.where(flip, -dy, dy)
        nx_ = px + dx * r; ny_ = py + dy * r
        ix2 = np.clip(nx_.astype(int), 0, w - 1); iy2 = np.clip(ny_.astype(int), 0, h - 1)
        diff = np.abs(ref[iy2, ix2] - col).sum(1)
        stop = (diff > thresh * 1.6) & (s >= 1)
        if block is not None:  # coarse strokes never run into a person
            stop |= block[iy2, ix2] > 0.5
        alive &= ~stop
        px = np.where(alive, nx_, px); py = np.where(alive, ny_, py)
        dx0, dy0 = dx, dy
        pts.append(np.stack([px, py], 1))
    P = np.stack(pts, 1)  # (n, maxlen+1, 2)
    th = max(1, int(round(r)))
    shift = 3
    for i in range(len(col)):
        poly = np.unique((P[i] * (1 << shift)).astype(np.int32), axis=0) if False else (P[i] * (1 << shift)).astype(np.int32)
        c = tuple(float(v) for v in col[i])
        cv2.polylines(canvas, [poly.reshape(-1, 1, 2)], False, c, th, cv2.LINE_AA, shift)
    return len(col)


def lic(fx, fy, n=14, seed=3, scale=1.0):
    h, w = fx.shape
    rng = np.random.default_rng(seed)
    noise = rng.random((h, w)).astype(np.float32)
    noise = cv2.GaussianBlur(noise, (0, 0), 0.6 * scale)
    acc = noise.copy()
    X, Y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    for sgn in (1, -1):
        px, py = X.copy(), Y.copy()
        for i in range(n):
            ix = np.clip(px.astype(int), 0, w - 1); iy = np.clip(py.astype(int), 0, h - 1)
            px = px + sgn * fx[iy, ix] * scale
            py = py + sgn * fy[iy, ix] * scale
            acc += cv2.remap(noise, px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return acc / (2 * n + 1)


def ink_lines(G, w, h, k_sil=3.2, k_crease=1.4, seed=5, wobble=1.2):
    t = G['t'].reshape(h, w).astype(np.float32)
    hit = G['hit'].reshape(h, w)
    t = np.where(hit, t, 80.0)
    N = G['N'].reshape(h, w, 3).astype(np.float32)
    gid = G['gid'].reshape(h, w).astype(np.int32)
    mat = G['mat'].reshape(h, w).astype(np.int32)
    lt = np.log(t)
    def dif(a):
        d = np.zeros_like(a, dtype=np.float32)
        d[:, 1:] = np.maximum(d[:, 1:], np.abs(a[:, 1:] - a[:, :-1]))
        d[1:, :] = np.maximum(d[1:, :], np.abs(a[1:, :] - a[:-1, :]))
        return d
    sil = (dif(lt) > 0.035).astype(np.float32)
    idb = (dif(gid.astype(np.float32)) > 0).astype(np.float32)
    matb = (dif(mat.astype(np.float32)) > 0).astype(np.float32)
    ndot = np.ones((h, w), np.float32)
    ndot[:, 1:] = np.minimum(ndot[:, 1:], (N[:, 1:] * N[:, :-1]).sum(2))
    ndot[1:, :] = np.minimum(ndot[1:, :], (N[1:, :] * N[:-1, :]).sum(2))
    skinm = np.isin(mat, (20, 21, 22))
    crease = np.where(skinm, ndot < 0.93, ndot < 0.80).astype(np.float32)
    strong = np.maximum(sil, idb)
    weak = np.maximum(crease, matb * 0.8) * (1 - strong)
    # line weight scales with screen size so the pass works at any resolution
    s = w / 1920.0
    ks = max(1, int(round(k_sil * s)))
    kc = max(1, int(round(k_crease * s)))
    strong = cv2.dilate(strong, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ks, ks)))
    weak = cv2.dilate(weak, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kc, kc)))
    line = np.maximum(strong, weak * 0.75)
    line = cv2.GaussianBlur(line, (0, 0), 0.6 * max(s, 0.5))
    rng = np.random.default_rng(seed)
    nx = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 6 * s) * wobble * 6 * s
    ny = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 6 * s) * wobble * 6 * s
    X, Y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    line = cv2.remap(line, X + nx, Y + ny, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    brk = cv2.GaussianBlur(rng.random((h, w)).astype(np.float32), (0, 0), 10 * s)
    brk = np.clip((brk - brk.mean()) / (brk.std() + 1e-6) * 0.8 + 1.0, 0, 1)
    return np.clip(line * brk * 1.15, 0, 1)


def render_paint(npz, out, exposure=1.0, opts=None, seed=7):
    opts = opts or {}
    G = np.load(npz)
    w, h = int(G['w']), int(G['h'])
    _, lights = scn.build(opts.get('scene', 'hero'))
    co = dict(scatter=0.25, fog=0.025, refl=0.8)
    co.update(opts.get('cine', {}))
    hdr, _ = cine.shade_hdr(G, lights, co)
    if opts.get('auto'):
        exposure = exposure * cine.auto_exposure(hdr, G, opts.get('auto'))
    hdr = cine.bloom(hdr, 0.06)
    s = w / 1920.0
    matm = G['mat'].reshape(h, w)
    skin = cv2.GaussianBlur(np.isin(matm, (20, 21, 22)).astype(np.float32), (0, 0), 1.0)
    Nn = G['N'].reshape(h, w, 3)
    Dd = G['D'].reshape(h, w, 3)
    rx = Dd[:, -1:, :] - Dd[:, :1, :]
    rx = rx / (np.linalg.norm(rx, axis=2, keepdims=True) + 1e-6)
    nx = np.clip((Nn * rx).sum(2), -1, 1) * G['hit'].reshape(h, w)
    base = painted_base(hdr, exposure, skin=skin, nx=nx, **opts.get('base', {})).astype(np.float32)
    fx, fy, coh = flow_field(base, 4.0 * s)
    gx, gy, gc = geo_flow(G, w, h)
    hit = G['hit'].reshape(h, w)
    wgeo = (np.clip(gc * 1.2, 0, 1) * hit).astype(np.float32) * opts.get('geo', 0.6)
    fx2 = fx * (1 - wgeo) + gx * wgeo
    fy2 = fy * (1 - wgeo) + gy * wgeo
    nrm = np.sqrt(fx2 ** 2 + fy2 ** 2) + 1e-6
    fx2 = (fx2 / nrm).astype(np.float32); fy2 = (fy2 / nrm).astype(np.float32)
    mat = G['mat'].reshape(h, w)
    detail = np.isin(mat, DETAIL_MATS).astype(np.float32)
    detail = cv2.dilate(detail, np.ones((int(9 * s) | 1, int(9 * s) | 1), np.uint8))
    chars = (G['gid'].reshape(h, w) >= 0).astype(np.float32)
    chars = cv2.dilate(chars, np.ones((int(7 * s) | 1, int(7 * s) | 1), np.uint8))
    rng = np.random.default_rng(seed)
    canvas = cv2.GaussianBlur(base, (0, 0), 18 * s) * 0.9
    canvas = np.where(chars[..., None] > 0.5, base, canvas).astype(np.float32)
    radii = opts.get('radii', [26, 14, 8, 4.5, 2.5])
    total = 0
    for r in radii:
        rs = r * s
        ref = cv2.GaussianBlur(base, (0, 0), max(0.5, rs * 0.5))
        blk = None
        if r >= 8:
            m = 1 - chars
            blk = chars
        elif r >= 4:
            m = np.maximum(chars, detail)
        else:
            m = detail
        thr = opts.get('thresh', 0.10) * (1.0 if r > 5 else 0.7)
        total += paint_layer(canvas, ref, fx2, fy2, max(1.0, rs), m, rng, thr,
                             int(opts.get('maxlen', 9) if r > 5 else 5), opts.get('jitter', 0.06), blk)
    canvas = np.clip(canvas, 0, 1)
    face = cv2.GaussianBlur(np.isin(matm, (20, 21, 22, 23, 24, 27, 28, 29)).astype(np.float32), (0, 0), 2.0 * s)
    sharp = cv2.GaussianBlur(base, (0, 0), max(0.4, 0.7 * s))
    fk = opts.get('face_keep', 0.45)
    canvas = canvas * (1 - face[..., None] * fk) + sharp * face[..., None] * fk
    # bristle texture and impasto relief along the paint flow
    L1 = lic(fx2, fy2, n=int(10 * max(s, 0.6)), scale=max(1.0, 1.5 * s))
    L1 = (L1 - L1.mean()) / (L1.std() + 1e-6)
    hgt = cv2.GaussianBlur(L1, (0, 0), 1.0)
    relief = np.clip(1 + 0.05 * (np.roll(hgt, 1, 0) - hgt + np.roll(hgt, 1, 1) - hgt), 0.8, 1.2)
    canvas = canvas * (1 + 0.055 * L1[..., None]) * relief[..., None]
    # ink
    line = ink_lines(G, w, h, opts.get('k_sil', 3.4), opts.get('k_crease', 1.5), seed + 1)
    ink = INK * (0.6 + 0.4 * lum(canvas)[..., None])
    canvas = canvas * (1 - line[..., None] * 0.92) + ink * line[..., None] * 0.92
    # canvas weave and a gentle vignette
    yy, xx = np.mgrid[0:h, 0:w]
    weave = (np.sin(xx * 1.9 / max(s, 0.5)) * np.sin(yy * 1.9 / max(s, 0.5))) * 0.012
    canvas = canvas * (1 + weave[..., None])
    canvas = cine.finish(np.clip(canvas, 0, 1), seed=seed, grain=0.012, vignette=0.45, ca=0)
    canvas = cine.to_srgb(canvas) if opts.get('srgb', False) else canvas
    Image.fromarray((np.clip(canvas, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out)
    print(out, 'strokes', total, flush=True)
    return canvas


if __name__ == '__main__':
    render_paint(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.0)
