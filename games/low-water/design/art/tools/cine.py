"""Direction C, 'Sodium Cinema': ENB-lineage light composition on the shared G-buffer.

HDR shading -> wet reflections -> lamp fog in-scatter -> bloom and a short streak -> filmic curve
-> violet shadow lift -> grain. Also exports shade_hdr() for the painterly direction.
"""
import sys
import numpy as np
import cv2
from PIL import Image
import shading as sh
import scene as scn

AMB = np.array([0.050, 0.038, 0.085])   # thin violet lift; ENB night ambient 0.15 of day


def sky(D, opts):
    y = np.clip(D[:, 1], -0.2, 1)
    top = np.array([0.006, 0.004, 0.014])
    hor = np.array([0.045, 0.030, 0.060])
    c = hor[None, :] * (1 - y[:, None]) ** 3 + top[None, :]
    mdir = -np.asarray(scn.MOON_DIR)
    md = np.clip(D @ mdir, 0, 1)
    c += np.array([0.25, 0.27, 0.33]) * (md ** 400)[:, None] * 0.5 + np.array([0.04, 0.04, 0.06]) * (md ** 20)[:, None]
    return c


def radiance(T, lights, weights, amb=AMB, n=None):
    rad = np.zeros((len(T['idx']), 3))
    for L in lights:
        k = weights.get(L['name'], 1.0)
        rad += k * (T['diff'][L['name']] + T['spec'][L['name']])
    rad += T['amb'] * amb[None, :]
    rad += T['emis']
    return rad


def fog_inscatter(O, D, t, lights, sigma, names):
    """Single scattering from point lights in a uniform medium, closed form along each ray."""
    acc = np.zeros((len(D), 3))
    for L in lights:
        if L['type'] != 'point' or L['name'] not in names:
            continue
        Lp = np.asarray(L['pos'], float)
        oc = Lp[None, :] - O
        b = np.einsum('ij,ij->i', oc, D)
        h2 = np.maximum(np.einsum('ij,ij->i', oc, oc) - b * b, 1e-4) + 0.04
        h = np.sqrt(h2)
        I = (np.arctan((t - b) / h) - np.arctan(-b / h)) / h
        acc += (sigma * L['I'] * I * names[L['name']])[:, None] * np.asarray(L['col'])[None, :] / (4 * np.pi)
    return acc


def smooth_shadows(G, w, h, sigma=None):
    """Masked, normalised blur of the visibility buffer within each object, so one-pixel
    terminator lines from non-exact distance bounds vanish without bleeding across silhouettes."""
    sigma = sigma or max(2.0, w / 260)
    S = G['S'].reshape(h, w, -1).astype(np.float32)
    gid = G['gid'].reshape(h, w)
    hit = G['hit'].reshape(h, w)
    out = S.copy()
    for g in np.unique(gid[hit]):
        m = ((gid == g) & hit).astype(np.float32)
        den = cv2.GaussianBlur(m, (0, 0), sigma) + 1e-6
        for j in range(S.shape[2]):
            num = cv2.GaussianBlur(S[..., j] * m, (0, 0), sigma)
            out[..., j] = np.where(m > 0, num / den, out[..., j])
    return out.reshape(-1, S.shape[2])


class _GB(dict):
    pass


def shade_hdr(G, lights, opts):
    w, h = int(G['w']), int(G['h'])
    G2 = _GB({k: G[k] for k in G.files}) if hasattr(G, 'files') else _GB(G)
    G2['S'] = smooth_shadows(G2, w, h)
    G = G2
    n = w * h
    D = G['D'].astype(float)
    O = np.broadcast_to(G['cam_pos'], D.shape)
    t = np.where(G['hit'], G['t'], 60.0).astype(float)
    img = np.zeros((n, 3))
    img[~G['hit']] = sky(D[~G['hit']], opts)
    T = sh.light_terms(G, lights)
    wts = opts.get('weights', {})
    img[T['idx']] = radiance(T, lights, wts, opts.get('amb', AMB))
    # wet reflections
    if 'r_hit' in G and len(G['r_hit']):
        ridx = G['r_idx']
        rad = np.zeros((len(ridx), 3))
        rh = G['r_hit']
        rD = G['r_D'].astype(float)
        rad[~rh] = sky(rD[~rh], opts)
        TR = sh.light_terms(G, lights, 'r_')
        rad[TR['idx']] = radiance(TR, lights, wts, opts.get('amb', AMB))
        # fog on the reflected path too
        rO = G['r_P'].astype(float)  # unused origin proxy
        refl = np.zeros((n, 3))
        refl[ridx] = rad
        # per-pixel wetness and roughness at the base hit
        wet = np.zeros(n); rough = np.ones(n); N = G['N'].astype(float)
        wet[T['idx']] = T['wet']; rough[T['idx']] = T['rough']
        ri = refl.reshape(h, w, 3).astype(np.float32)
        blur = cv2.GaussianBlur(ri, (0, 0), max(2.0, w / 320))
        blur2 = cv2.GaussianBlur(ri, (0, 0), max(6.0, w / 110))
        rr = rough.reshape(h, w, 1)
        a1 = np.clip(rr / 0.15, 0, 1)
        a2 = np.clip((rr - 0.15) / 0.25, 0, 1)
        rimg = (ri * (1 - a1) + blur * a1) * (1 - a2) + blur2 * a2
        rimg = rimg.reshape(n, 3)
        vdn = np.clip(-np.einsum('ij,ij->i', D, N), 0, 1)
        F = 0.03 + 0.97 * (1 - vdn) ** 5
        k = np.zeros(n)
        k[ridx] = 1
        strength = k * wet * (0.25 + 0.75 * F) * opts.get('refl', 1.0)
        img += rimg * strength[:, None]
    # fog: extinction toward a violet night haze, plus lamp in-scatter (ENB volumetric fog, curve 2.5)
    sig = opts.get('fog', 0.035)
    ext = np.exp(-sig * t)
    haze = np.array([0.020, 0.014, 0.030])
    img = img * ext[:, None] + haze[None, :] * (1 - ext[:, None])
    img += fog_inscatter(O, D, t, lights, sig * opts.get('scatter', 1.0),
                         opts.get('fog_lights', {'sodium_l': 1.0, 'sodium_r': 1.0, 'door': 0.6, 'lantern': 0.5}))
    return img.reshape(h, w, 3), T


def auto_exposure(hdr, G, target=0.55, pct=96):
    """Exposure that puts the bright end of the characters at a fixed level of the curve."""
    gid = G['gid'].reshape(hdr.shape[0], hdr.shape[1]) if hdr.shape[0] * hdr.shape[1] == len(G['gid']) else None
    L = hdr[..., 0] * 0.2126 + hdr[..., 1] * 0.7152 + hdr[..., 2] * 0.0722
    sel = L[gid >= 0] if gid is not None and np.any(gid >= 0) else L.ravel()
    return target / max(np.percentile(sel, pct), 1e-4)


def filmic(x):
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return np.clip((x * (a * x + b)) / (x * (c * x + d) + e), 0, 1)


def bloom(img, amount=0.08, w=None):
    w = img.shape[1]
    bright = np.clip(img - 0.9, 0, None).astype(np.float32)
    acc = np.zeros_like(bright)
    for s, k in ((w / 400, 0.5), (w / 130, 0.3), (w / 45, 0.2), (w / 18, 0.12)):
        acc += k * cv2.GaussianBlur(bright, (0, 0), s)
    return img + amount * acc


def streak(img, amount=0.03):
    bright = np.clip(img - 6.0, 0, None).astype(np.float32)
    k = int(img.shape[1] / 6) | 1
    ker = np.exp(-np.abs(np.linspace(-1, 1, k)) * 6).astype(np.float32)
    ker /= ker.sum()
    st = cv2.filter2D(bright, -1, ker[None, :])
    return img + amount * st * np.array([1.0, 0.75, 0.6], np.float32)


def grade(ldr, lift=(0.035, 0.018, 0.055), toe=0.02):
    x = np.clip((ldr - toe) / (1 - toe), 0, 1)
    lum = x.mean(2, keepdims=True)
    shadow = np.clip(1 - lum * 3.5, 0, 1)
    x = x + shadow * np.asarray(lift)[None, None, :]
    return np.clip(x, 0, 1)


def finish(img, seed=1, grain=0.035, vignette=0.35, ca=1.0):
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    img = img * (1 - vignette * np.clip(r - 0.4, 0, 1) ** 1.6)[:, :, None]
    if ca > 0:
        s = ca * w / 1920.0
        M1 = np.float32([[1 + 0.0012 * s, 0, -w * 0.0006 * s], [0, 1 + 0.0012 * s, -h * 0.0006 * s]])
        img[:, :, 0] = cv2.warpAffine(img[:, :, 0].astype(np.float32), M1, (w, h), borderMode=cv2.BORDER_REFLECT)
    rng = np.random.default_rng(seed)
    g = rng.normal(0, 1, (h, w)).astype(np.float32)
    g = cv2.GaussianBlur(g, (0, 0), 0.7)
    lum = img.mean(2)
    img = img + grain * g[:, :, None] * (0.3 + 0.7 * np.sqrt(np.clip(lum, 0, 1)))[:, :, None]
    return np.clip(img, 0, 1)


def dof(img, t, focus, k=6.0, max_r=None):
    """Thin-lens blur by depth: a stack of blurs, picked per pixel by circle of confusion."""
    h, w, _ = img.shape
    max_r = max_r or w / 420
    coc = np.clip(k * np.abs(1.0 / focus - 1.0 / np.maximum(t, 0.1)) * focus, 0, 1).reshape(h, w)
    coc = cv2.GaussianBlur(coc.astype(np.float32), (0, 0), 2)
    levels = [img.astype(np.float32)]
    for f in (0.25, 0.5, 1.0):
        levels.append(cv2.GaussianBlur(img.astype(np.float32), (0, 0), max(0.5, max_r * f)))
    x = coc * 3
    out = np.zeros_like(levels[0])
    for i in range(3):
        wgt = np.clip(1 - np.abs(x - i), 0, 1)[..., None]
        out += levels[i] * wgt
    out += levels[3] * np.clip(x - 2, 0, 1)[..., None]
    return out


def halation(img, amount=0.12):
    w = img.shape[1]
    b = np.clip(img - 1.2, 0, None).astype(np.float32)
    g = cv2.GaussianBlur(b, (0, 0), w / 220) - cv2.GaussianBlur(b, (0, 0), w / 900)
    return img + amount * np.clip(g, 0, None).mean(2, keepdims=True) * np.array([1.0, 0.25, 0.08], np.float32)


def letterbox(img, aspect=2.39):
    h, w, _ = img.shape
    bh = int(round((h - w / aspect) / 2))
    if bh > 0:
        img[:bh] = 0
        img[-bh:] = 0
    return img


def to_srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * x ** (1 / 2.4) - 0.055)


def render_cine(npz, out, ss=1, exposure=1.6, opts=None):
    opts = opts or {}
    G = np.load(npz)
    _, lights = scn.build(opts.get('scene', 'hero'))
    hdr, _ = shade_hdr(G, lights, opts)
    if ss > 1:
        h, w, _ = hdr.shape
        hdr = cv2.resize(hdr.astype(np.float32), (w // ss, h // ss), interpolation=cv2.INTER_AREA)
    if opts.get('auto'):
        exposure = exposure * auto_exposure(hdr, G, opts.get('auto'))
    hdr = hdr * exposure
    if opts.get('focus'):
        t = np.where(G['hit'], G['t'], 60.0)
        if ss > 1:
            t = cv2.resize(t.reshape(int(G['h']), int(G['w'])).astype(np.float32), (hdr.shape[1], hdr.shape[0]),
                           interpolation=cv2.INTER_NEAREST).ravel()
        hdr = dof(hdr, t, opts['focus'], opts.get('dof', 6.0))
    hdr = halation(hdr, opts.get('halation', 0.0))
    hdr = bloom(hdr, opts.get('bloom', 0.10))
    hdr = streak(hdr, opts.get('streak', 0.02))
    ldr = filmic(hdr)
    ldr = grade(ldr)
    ldr = to_srgb(ldr)
    ldr = finish(ldr, grain=opts.get('grain', 0.03), vignette=opts.get('vignette', 0.4))
    if opts.get('letterbox'):
        ldr = letterbox(ldr, opts['letterbox'])
    Image.fromarray((ldr * 255 + 0.5).astype(np.uint8)).save(out)
    return ldr


if __name__ == '__main__':
    render_cine(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1)
