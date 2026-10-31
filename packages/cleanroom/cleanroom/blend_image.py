# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Image blend engine: per-channel weights over any number of sources, and signal-chain knobs.

Channels and what each one moves:
  form      structure field (lightness) composited from the sources, after per-source detune
  function  mirror symmetry pulled toward the weighted symmetry of the sources
  colour    a palette pooled from the sources' measured palettes, gradient-mapped onto the form
  texture   1/f noise synthesised at the weighted spectral slope, plus a material tint
  value     lightness key and range set from the weighted source values
  motion    a periodic modulation at the weighted rhythm period
Knobs: detune, reverb (passes and decay), gain, attack and release (spatial ramps), temperature,
transparency and layer order, marbling (tine-line falloff and a ring swirl; an independent numpy
implementation, provenance in LEGAL-CHECK.md),
lattice resampling (hex or square from packages/lattice, Vogel spiral from packages/lattice/packing).
Everything is seeded numpy, so a recipe reproduces its output bit for bit.
"""
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree

from .config import use_libs

use_libs("design-parts", "lattice")
from design_parts import palette as dp_palette, texture  # noqa: E402
from design_parts.channels import _lab_to_rgb  # noqa: E402
from lattice import lattices  # noqa: E402

CHANNELS = ("form", "function", "colour", "texture", "value", "motion", "sound", "text")
DEFAULT_KNOBS = {"detune": 0.0, "reverb": 0.0, "reverb_passes": 0, "reverb_decay": 0.5, "gain": 1.0,
                 "attack": 0.0, "release": 0.0, "temperature": 0.0, "layer_mix": 0.0, "marble": 0.0,
                 "marble_tines": 6, "swirl": 0.0, "lattice": "none", "lattice_cell": 0.0,
                 "texture_mix": 0.15, "material": None, "material_mix": 0.0, "rhythm_gain": 0.0,
                 "palette_k": 5}


def _vogel(n):
    use_libs("packing")
    from packing import spiral
    return spiral.vogel(n)


def gray(a):
    return a @ np.array([0.299, 0.587, 0.114])


def stats(a):
    """Cheap per-source measurements the channels need (design-parts functions)."""
    g = gray(a)
    C, sh = dp_palette.palette(a)
    r = texture.rhythm(g)
    try:
        slope = float(texture.spectrum_slope(g))
    except Exception:  # flat image: no slope to fit
        slope = -2.0
    return {"palette": C, "shares": sh, "sym": float(1 - np.abs(g - g[:, ::-1]).mean() * 2),
            "rhythm_period": r["rhythm_period"] or 0.0, "slope": slope if np.isfinite(slope) else -2.0,
            "key": float(np.percentile(g, 50)), "range": float(np.percentile(g, 95) - np.percentile(g, 5))}


def _affine(img, rot_deg, shift, scale):
    h, w = img.shape[:2]
    c = np.array([h / 2, w / 2])
    t = np.deg2rad(rot_deg)
    R = np.array([[np.cos(t), -np.sin(t)], [np.sin(t), np.cos(t)]]) / scale
    off = c - R @ (c + np.asarray(shift))
    if img.ndim == 2:
        return ndimage.affine_transform(img, R, off, order=1, mode="reflect")
    return np.stack([ndimage.affine_transform(img[..., k], R, off, order=1, mode="reflect") for k in range(3)], -1)


def _ramp(w, attack, release):
    x = np.linspace(0, 1, w)
    up = np.clip(x / attack, 0, 1) if attack > 0 else np.ones(w)
    down = np.clip((1 - x) / release, 0, 1) if release > 0 else np.ones(w)
    return up * down


def _zfall(a, lam, d):
    return a * lam / (d + lam)


def marble(field, rng, strength, tines, swirl):
    """Inverse-map sampling through tine and swirl maps (tine falloff z = a * lam / (d + lam))."""
    h, w = field.shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(float) / max(h, w)
    px, py = x.copy(), y.copy()
    for _ in range(2):
        th = rng.uniform(0, np.pi)
        mx, mz = np.cos(th), np.sin(th)
        nx, nz = -mz, mx
        t = (px - 0.5) * nx + (py - 0.5) * nz
        n = max(1, int(tines))
        offs = (np.arange(n) - (n - 1) / 2) * (1.0 / n)
        d = np.min(np.abs(t[..., None] - offs), axis=-1)
        z = _zfall(strength * 0.25, 0.03, d)
        px, py = px - z * mx, py - z * mz
    if swirl:
        ax, az = px - 0.5, py - 0.5
        r = np.hypot(ax, az) + 1e-9
        a = -_zfall(swirl * 0.6, 0.08, np.abs(r - 0.25)) / r * 0.25
        px, py = 0.5 + ax * np.cos(a) - az * np.sin(a), 0.5 + ax * np.sin(a) + az * np.cos(a)
    coords = [py * max(h, w), px * max(h, w)]
    if field.ndim == 2:
        return ndimage.map_coordinates(field, coords, order=1, mode="mirror")
    return np.stack([ndimage.map_coordinates(field[..., k], coords, order=1, mode="mirror") for k in range(3)], -1)


def lattice_resample(field, kind, cell):
    h, w = field.shape
    if kind in ("hex", "square"):
        G = lattices.generator(kind, density=1.0 / (cell * cell))
        P = lattices.points_in_box(G, w, h)
    elif kind == "vogel":
        n = int(h * w / (cell * cell))
        P = (_vogel(n) * 0.75 + 1) / 2 * np.array([w, h])
    else:
        return field
    yy, xx = np.mgrid[0:h, 0:w]
    _, lab = cKDTree(P).query(np.stack([xx.ravel(), yy.ravel()], 1))
    sums = np.bincount(lab, weights=field.ravel(), minlength=len(P))
    cnt = np.bincount(lab, minlength=len(P))
    return (sums / np.maximum(cnt, 1))[lab].reshape(h, w)


def pink(shape, slope, rng):
    h, w = shape
    fy, fx = np.fft.fftfreq(h)[:, None], np.fft.fftfreq(w)[None, :]
    f = np.hypot(fy, fx)
    f[0, 0] = 1
    amp = f ** (slope / 2)
    amp[0, 0] = 0
    n = np.real(np.fft.ifft2(amp * np.exp(2j * np.pi * rng.random((h, w)))))
    return (n - n.mean()) / (n.std() + 1e-12)


def channel_weights(sources, channel):
    w = np.array([s["weight"] * s["gain"] * s["channels"].get(channel, 1.0) for s in sources], float)
    return w / w.sum() if w.sum() > 0 else w


def _gradient_map(F, pal_lab):
    pal = pal_lab[np.argsort(pal_lab[:, 0])]
    if len(pal) == 1:
        return np.broadcast_to(_lab_to_rgb(pal[0]), F.shape + (3,)).copy()
    t = np.clip(F, 0, 1) * (len(pal) - 1)
    i = np.clip(np.floor(t).astype(int), 0, len(pal) - 2)
    f = (t - i)[..., None]
    return np.clip(_lab_to_rgb(pal[i] * (1 - f) + pal[i + 1] * f), 0, 1)


def _pool_palette(st, wc, k, temperature, rng, hue_shift):
    cands, score = [], []
    for s, wi, hs in zip(st, wc, hue_shift):
        for c, sh in zip(s["palette"], s["shares"]):
            a, b = c[1] * np.cos(hs) - c[2] * np.sin(hs), c[1] * np.sin(hs) + c[2] * np.cos(hs)
            cands.append([c[0], a, b])
            score.append(wi * sh)
    cands, score = np.array(cands), np.array(score) + 1e-12
    if temperature > 0:
        score = score * np.exp(temperature * rng.gumbel(size=len(score)))
    return cands[np.argsort(-score)[:max(1, int(k))]]


def _fields(arrays, sources, det, signs):
    h, w = arrays[0].shape[:2]
    out = []
    for a, d, sg in zip(arrays, det, signs):
        g = gray(a)
        if d:
            g = _affine(g, 15 * d * sg[0], (0.05 * d * sg[1] * h, 0.05 * d * sg[2] * w), 1 + 0.1 * d * sg[3])
        lo, hi = np.percentile(g, [2, 98])
        out.append(np.clip((g - lo) / max(hi - lo, 1e-6), 0, 1))
    return out


def _form(fields, sources, K):
    """Weighted mean of the structure fields, blended toward an over-composite by layer_mix."""
    h, w = fields[0].shape
    wf = channel_weights(sources, "form")
    ramps = [_ramp(w, K["attack"] + s.get("attack", 0.0), K["release"] + s.get("release", 0.0))[None, :]
             for s in sources]
    num = sum(wi * s.get("opacity", 1.0) * r * f for wi, s, r, f in zip(wf, sources, ramps, fields))
    den = sum(wi * s.get("opacity", 1.0) * r for wi, s, r in zip(wf, sources, ramps)) + 1e-9
    F = num / den
    if K["layer_mix"] > 0:
        over = np.zeros((h, w))
        n = len(sources)
        for i in sorted(range(n), key=lambda i: sources[i].get("order", i)):
            al = np.clip(sources[i].get("opacity", 1.0) * wf[i] * n, 0, 1) * ramps[i]
            over = over * (1 - al) + fields[i] * al
        F = (1 - K["layer_mix"]) * F + K["layer_mix"] * over
    return F


def _marble_reverb(F, K, rng):
    if not (K["marble"] or K["swirl"]):
        return F
    passes = [F]
    for _ in range(max(1, int(K["reverb_passes"]) + 1)):
        jit = 1 + K["temperature"] * rng.normal(0, 0.2)
        passes.append(marble(passes[-1], rng, K["marble"] * jit, K["marble_tines"], K["swirl"]))
    if K["reverb"] <= 0:
        return passes[-1]
    ws = np.array([K["reverb_decay"] ** k for k in range(len(passes) - 1)])[::-1]
    return sum(wk * pk for wk, pk in zip(ws / ws.sum(), passes[1:]))


def _value_motion_texture(F, sources, st, K, rng):
    h, w = F.shape
    wv = channel_weights(sources, "value")
    key, rng_v = float(np.dot(wv, [s["key"] for s in st])), float(np.dot(wv, [s["range"] for s in st]))
    period = float(np.dot(channel_weights(sources, "motion"), [s["rhythm_period"] for s in st]))
    if K["rhythm_gain"] and period > 1:
        F = F + K["rhythm_gain"] * 0.15 * np.sin(2 * np.pi * np.arange(w) / period)[None, :]
    slope = float(np.dot(channel_weights(sources, "texture"), [s["slope"] for s in st]))
    F = F + K["texture_mix"] * 0.15 * pink((h, w), slope, rng)
    if K["temperature"]:
        F = F + K["temperature"] * 0.05 * rng.normal(size=(h, w))
    lo, hi = np.percentile(F, [2, 98])
    F = np.clip((F - lo) / max(hi - lo, 1e-6), 0, 1)
    F = np.clip(key + (F - 0.5) * max(rng_v, 0.1) * K["gain"], 0, 1)
    return F, {"value_key": round(key, 4), "value_range": round(rng_v, 4), "rhythm_period": round(period, 3),
               "texture_slope": round(slope, 4)}


def render(arrays, sources, knobs, seed, material_rgb=None):
    """arrays: list of HxWx3 float images in [0, 1], one per source, same size."""
    K = dict(DEFAULT_KNOBS, **(knobs or {}))
    rng = np.random.default_rng(seed)
    st = [stats(a) for a in arrays]
    det = [K["detune"] + s.get("detune", 0.0) for s in sources]
    signs = rng.choice([-1.0, 1.0], size=(len(sources), 4))
    F = _form(_fields(arrays, sources, det, signs), sources, K)
    sym = float(np.dot(channel_weights(sources, "function"), [s["sym"] for s in st]))
    F = (1 - 0.5 * sym) * F + 0.5 * sym * F[:, ::-1]
    if K["lattice"] != "none" and K["lattice_cell"] > 1:
        F = lattice_resample(F, K["lattice"], K["lattice_cell"])
    F = _marble_reverb(F, K, rng)
    F, measured = _value_motion_texture(F, sources, st, K, rng)
    hue = [np.deg2rad(60 * d * sg[0]) for d, sg in zip(det, signs)]
    pal = _pool_palette(st, channel_weights(sources, "colour"), K["palette_k"], K["temperature"], rng, hue)
    out = _gradient_map(F, pal)
    if material_rgb is not None and K["material_mix"]:
        out = out * (1 - K["material_mix"]) + out * np.asarray(material_rgb)[None, None, :] * K["material_mix"]
    measured.update(symmetry_target=round(sym, 4), palette_lab=pal.round(2).tolist())
    return np.clip(out, 0, 1), measured
