# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Performance from real rays: chief aim, pupil sampling, spot, distortion, relative illumination, wavefront, Strehl, MTF.

Scalar diffraction with a plane-wave (Debye) sum. Each ray carries the phase its plane wave has at the reference point, so
the wavefront is exact for the traced rays. The FFT works on the launch grid with a local scale fitted from the exit
direction cosines. Pupil distortion beyond that linear fit and polarisation are ignored; the tests state the margin.
"""
import numpy as np

from .trace import entrance_pupil, launch, paraxial, trace

ZBACK = 500.0


def _truncated(lens):
    st = lens.stop
    t2 = lens.copy()
    t2.c, t2.k, t2.a = lens.c[:st + 1], lens.k[:st + 1], lens.a[:st + 1]
    t2.t = np.append(lens.t[:st], 0.0)
    t2.semi = np.full(st + 1, 1e6)
    t2.n = lens.n[:, :st + 2].copy()
    t2.n[:, st + 1] = t2.n[:, st]     # stop itself does not refract for this probe
    for q in ("dx", "dy", "ax", "ay"):
        setattr(t2, q, getattr(lens, q)[:st + 1])
    t2.irr = lens.irr[:st + 1]
    return t2


def aim_chief(lens, field, w=None):
    """y0 at z = 0 whose ray crosses the stop centre. Secant from the paraxial pupil."""
    w = lens.primary if w is None else w
    ze, _ = entrance_pupil(lens, w)
    ze = float(np.real(ze))
    tn = np.tan(np.radians(field))
    a = -ze * tn
    if field == 0:
        return 0.0
    b = a + 0.5
    probe = _truncated(lens)
    fa, oka = _trace_to_stop_probe(probe, w, field, a)
    fb, okb = _trace_to_stop_probe(probe, w, field, b)
    for _ in range(12):
        if fb == fa:
            break
        c = b - fb * (b - a) / (fb - fa)
        a, fa = b, fb
        b = c
        fb, okb = _trace_to_stop_probe(probe, w, field, b)
        if abs(fb) < 1e-9:
            break
    return b


def _trace_to_stop_probe(probe, w, field, y0):
    r = launch(field, y0, np.zeros(1), np.zeros(1), ZBACK)
    res = trace(probe, w, r)
    return res["y"][0].real, bool(res["ok"][0])


def bundle(lens, field, N=64, oversize=1.3, w=None):
    """Square grid over the entrance pupil, oversize so the real stop and clear apertures set the edge."""
    w = lens.primary if w is None else w
    y0 = aim_chief(lens, field)
    _, mag = entrance_pupil(lens, lens.primary)
    r_ep = lens.semi[lens.stop] / abs(np.real(mag)) * oversize
    g = (np.arange(N) - (N - 1) / 2) * 2 * r_ep / (N - 1)
    gx, gy = np.meshgrid(g, g, indexing="xy")
    rays = launch(field, y0, gx.ravel(), gy.ravel(), ZBACK)
    return rays, gx.ravel(), gy.ravel(), g[1] - g[0]


def field_rays(lens, field, N=64, image_shift=0.0):
    """Trace one field at every wavelength. Returns a list of per-wavelength results with a live mask."""
    out = []
    for w in range(len(lens.wl)):
        rays, gx, gy, dg = bundle(lens, field, N)
        r = trace(lens, w, rays, image_shift=image_shift)
        r["live"] = r["ok"] & r["clip"]
        r["gx"], r["gy"], r["dg"], r["grid"] = gx, gy, dg, N
        out.append(r)
    return out


def _real(a):
    return a.real if np.iscomplexobj(a) else a


def centroid(r):
    m = r["live"]
    return float(_real(r["x"])[m].mean()), float(_real(r["y"])[m].mean())


def spot_rms(rs, lens):
    """Polychromatic RMS about the weighted centroid, in mm."""
    xs, ys, ws = [], [], []
    for w, r in enumerate(rs):
        m = r["live"]
        xs.append(_real(r["x"])[m]); ys.append(_real(r["y"])[m]); ws.append(np.full(m.sum(), lens.w[w] / max(m.sum(), 1)))
    x, y, q = np.concatenate(xs), np.concatenate(ys), np.concatenate(ws)
    q = q / q.sum()
    cx, cy = (q * x).sum(), (q * y).sum()
    return float(np.sqrt((q * ((x - cx) ** 2 + (y - cy) ** 2)).sum()))


def wavefront(r, px, py, nm, pz=None):
    """W in waves at each live ray, referred to the point (px, py) on the image plane, piston and tilt kept."""
    pz = r["z"] if pz is None else pz
    x, y = _real(r["x"]), _real(r["y"])
    L, M, N_ = _real(r["L"]), _real(r["M"]), _real(r["N"])
    opl = _real(r["opl"]) + (px - x) * L + (py - y) * M + np.real(pz - r["z"]) * N_
    return opl / (nm * 1e-6)


def wave_stats(r, px, py, nm, remove_defocus=False):
    """RMS and Strehl of the pupil on the launch grid. Piston and x, y tilt removed always; defocus optionally."""
    m = r["live"]
    W = wavefront(r, px, py, nm)[m]
    if W.size < 8:
        return dict(rms=np.inf, strehl=0.0, pv=np.inf)
    gx, gy = r["gx"][m], r["gy"][m]
    cols = [np.ones_like(gx), gx, gy]
    if remove_defocus:
        cols.append(gx ** 2 + gy ** 2)
    A = np.stack(cols, 1)
    W2 = W - A @ np.linalg.lstsq(A, W, rcond=None)[0]
    return dict(rms=float(np.sqrt((W2 ** 2).mean())), strehl=float(np.abs(np.exp(2j * np.pi * W2).mean()) ** 2),
                pv=float(W2.max() - W2.min()))


def pupil_scale(r):
    """Local d(L)/d(gx), d(M)/d(gy) in exit direction cosines per mm of launch grid, least squares on live rays."""
    m = r["live"]
    gx, gy = r["gx"][m], r["gy"][m]
    L, M = _real(r["L"])[m], _real(r["M"])[m]
    A = np.stack([np.ones_like(gx), gx, gy], 1)
    return abs(np.linalg.lstsq(A, L, rcond=None)[0][1]), abs(np.linalg.lstsq(A, M, rcond=None)[0][2])


def otf_slices(r, px, py, nm, pad=4):
    """OTF on the pupil's own FFT grid. Returns the complex OTF centred, and the frequency step in x and y (cycles/mm)."""
    N = r["grid"]
    W = np.where(r["live"], wavefront(r, px, py, nm), 0.0).reshape(N, N)
    live = r["live"].reshape(N, N)
    if live.sum() < 8:
        return None
    W = W - W[live].mean()
    P = np.where(live, np.exp(2j * np.pi * W), 0)
    M = N * pad
    psf = np.abs(np.fft.fft2(P, (M, M))) ** 2
    otf = np.fft.fftshift(np.fft.fft2(psf))
    otf = otf / otf[M // 2, M // 2]
    sx, sy = pupil_scale(r)
    dg = r["dg"]
    return otf, sx * dg / (nm * 1e-6), sy * dg / (nm * 1e-6), M


def mtf(rs, lens, freqs, pad=4):
    """Polychromatic sagittal and tangential MTF at freqs, cycles/mm. Common reference point: primary wavelength centroid."""
    px, py = centroid(rs[lens.primary])
    total_s, total_t, wsum = np.zeros(len(freqs), complex), np.zeros(len(freqs), complex), 0.0
    for w, r in enumerate(rs):
        o = otf_slices(r, px, py, lens.wl[w], pad)
        if o is None:
            continue
        otf, dnx, dny, M = o
        wt = lens.w[w]
        # MTF x slice: sagittal for a field in y. y slice: tangential.
        ix = np.asarray(freqs, float) / dnx + M // 2
        iy = np.asarray(freqs, float) / dny + M // 2
        ax = np.arange(M)
        sx = otf[M // 2, :]
        sy = otf[:, M // 2]
        total_s += wt * (np.interp(ix, ax, sx.real) + 1j * np.interp(ix, ax, sx.imag))
        total_t += wt * (np.interp(iy, ax, sy.real) + 1j * np.interp(iy, ax, sy.imag))
        wsum += wt
    return np.abs(total_s) / wsum, np.abs(total_t) / wsum


def best_focus(lens, fields=(0.0,), N=32, weights=None):
    """Shift of the image plane that minimises mean square polychromatic spot. Rays are straight past the last surface."""
    num = den = 0.0
    weights = np.ones(len(fields)) if weights is None else np.asarray(weights, float)
    for f, q in zip(fields, weights):
        rs = field_rays(lens, f, N)
        xs, ys, dxs, dys, ws = [], [], [], [], []
        for w, r in enumerate(rs):
            m = r["live"]
            xs.append(_real(r["x"])[m]); ys.append(_real(r["y"])[m])
            dxs.append((_real(r["L"]) / _real(r["N"]))[m]); dys.append((_real(r["M"]) / _real(r["N"]))[m])
            ws.append(np.full(m.sum(), lens.w[w] / max(m.sum(), 1)))
        x, y, dx, dy, wt = map(np.concatenate, (xs, ys, dxs, dys, ws))
        wt = wt / wt.sum()
        ax, ay, bx, by = x - (wt * x).sum(), y - (wt * y).sum(), dx - (wt * dx).sum(), dy - (wt * dy).sum()
        num += q * (wt * (ax * bx + ay * by)).sum()
        den += q * (wt * (bx * bx + by * by)).sum()
    return float(-num / den)


def distortion_pct(lens, field, efl=None):
    """Chief ray height against f tan theta, at the primary wavelength, on the paraxial image plane of this lens."""
    if field == 0:
        return 0.0
    w = lens.primary
    efl = float(np.real(paraxial(lens, w)[0])) if efl is None else efl
    y0 = aim_chief(lens, field)
    r = trace(lens, w, launch(field, y0, np.zeros(1), np.zeros(1), ZBACK))
    return float(100 * (abs(_real(r["y"])[0]) / abs(efl * np.tan(np.radians(field))) - 1))


def chief_height(lens, deg):
    w = lens.primary
    r = trace(lens, w, launch(deg, aim_chief(lens, deg), np.zeros(1), np.zeros(1), ZBACK))
    return abs(float(_real(r["y"])[0]))


def relative_illumination(lens, fields, N=64):
    """Flux per image area against the axis: E = A_proj sin(theta) / (y' dy'/dtheta), from radiance times etendue.
    A_proj counts live rays on the grid normal to the beam, so it holds vignetting and pupil aberration; the height map holds distortion.
    An exit-cone route fails away from focus, since astigmatism moves the ray map; a test keeps that lesson."""
    out = []
    for f in fields:
        r = field_rays(lens, f, N)[lens.primary]
        area = r["live"].sum() * r["dg"] ** 2
        deg = max(f, 0.2)
        e = 0.1
        y = chief_height(lens, deg)
        dy = (chief_height(lens, deg + e) - chief_height(lens, deg - e)) / np.radians(2 * e)
        out.append(float(area * np.sin(np.radians(deg)) / max(y * dy, 1e-12)))
    return [float(v / out[0]) for v in out]


def vignetting(lens, fields, N=64):
    vals = [field_rays(lens, f, N)[lens.primary]["live"].sum() for f in fields]
    return [float(1 - v / vals[0]) for v in vals]


def mtf_geom(rs, lens, freqs):
    """Geometric OTF of the polychromatic spot about its centroid, times the aberration-free diffraction MTF at f/#.
    Fast and smooth; it ignores interference, so it serves search and Monte Carlo. The tests give the margin against the FFT."""
    xs, ys, ws, nas = [], [], [], []
    for w, r in enumerate(rs):
        m = r["live"]
        if m.sum() < 4:
            continue
        xs.append(_real(r["x"])[m]); ys.append(_real(r["y"])[m]); ws.append(np.full(m.sum(), lens.w[w] / m.sum()))
        nas.append(np.sqrt((_real(r["L"])[m] ** 2 + _real(r["M"])[m] ** 2).max()))
    if not xs:
        return np.zeros(len(freqs)), np.zeros(len(freqs))
    x, y, q = np.concatenate(xs), np.concatenate(ys), np.concatenate(ws)
    q = q / q.sum()
    x, y = x - (q * x).sum(), y - (q * y).sum()
    ms, mt = [], []
    nu_c = 2 * max(nas) / (lens.wl[lens.primary] * 1e-6)
    for f in freqs:
        v = min(f / nu_c, 1.0)
        dif = 2 / np.pi * (np.arccos(v) - v * np.sqrt(1 - v * v))
        ms.append(abs((q * np.exp(2j * np.pi * f * x)).sum()) * dif)
        mt.append(abs((q * np.exp(2j * np.pi * f * y)).sum()) * dif)
    return np.array(ms), np.array(mt)


def needed_grid(lens, field, shift, nmin=128, nmax=640):
    """Grid so that the FFT window holds the geometric spot: window = N * lambda / (direction-cosine span of the grid)."""
    rs = field_rays(lens, field, 32, image_shift=shift)
    r = rs[lens.primary]
    if r["live"].sum() < 8:
        return nmin
    spread = max(max(np.ptp(_real(q["y"])[q["live"]]), np.ptp(_real(q["x"])[q["live"]])) for q in rs if q["live"].any())
    sx, _ = pupil_scale(r)
    delta = sx * r["dg"] * 31
    need = int(np.ceil(2.5 * spread * delta / (lens.wl[lens.primary] * 1e-6)))
    return int(min(max(nmin, need), nmax))


def evaluate(lens, intent, focus=None, nmax=640):
    """Full performance record at the intent's fields and frequencies. focus: image shift, default best polychromatic."""
    fields = list(intent["half_field_deg"])
    freqs = list(intent.get("mtf_freqs", [10, 30, 60]))
    fw = intent.get("field_weights")
    shift = best_focus(lens, fields, weights=fw) if focus is None else focus
    rec = dict(focus_shift_mm=shift, fields=[], efl=float(np.real(paraxial(lens)[0])), bfd=float(np.real(paraxial(lens)[1])))
    ri = relative_illumination(lens, fields, 64)
    for i, f in enumerate(fields):
        N = needed_grid(lens, f, shift, nmax=nmax)
        rs = field_rays(lens, f, N, image_shift=shift)
        p = rs[lens.primary]
        px, py = centroid(p)
        ms, mt = mtf(rs, lens, freqs, pad=2)
        ws = wave_stats(p, px, py, lens.wl[lens.primary])
        gs, gt = mtf_geom(rs, lens, freqs)
        rec["fields"].append(dict(deg=f, grid=N, spot_rms_um=spot_rms(rs, lens) * 1e3, wave_rms=ws["rms"], strehl=ws["strehl"],
                                  distortion_pct=distortion_pct(lens, f), ri=ri[i], live=float(p["live"].mean()),
                                  mtf_s=[float(x) for x in ms], mtf_t=[float(x) for x in mt],
                                  mtf_geom_s=[float(x) for x in gs], mtf_geom_t=[float(x) for x in gt]))
    rec["mtf_freqs"] = freqs
    rec["mtf_mean"] = {str(fr): float(np.mean([0.5 * (x["mtf_s"][j] + x["mtf_t"][j]) for x in rec["fields"]])) for j, fr in enumerate(freqs)}
    rec["distortion_max_pct"] = float(max(abs(x["distortion_pct"]) for x in rec["fields"]))
    return rec
