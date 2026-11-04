# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Limit report: each design against the physical bound for its job.

Bound for point localisation by one photon: quantum Fisher information 4 Var(k) of the pupil, which direct imaging reaches
for a flat pupil. Precision bits lost per coordinate = 0.5 log2(I_bound / I_actual), so the stages of the budget add up.
N photons at Fisher information I give variance 1 / (N I). Assumptions are stated in the record: ideal pixel-free photon
counting, no background, scalar optics, field in the y-z plane.
"""
import numpy as np

from . import glass, optics
from .trace import trace


def pupil_field(r, px, py, nm):
    N = r["grid"]
    live = r["live"].reshape(N, N)
    W = np.where(r["live"], optics.wavefront(r, px, py, nm), 0.0).reshape(N, N)
    W = W - W[live].mean()
    return np.where(live, np.exp(2j * np.pi * W), 0)


def psf_grid(P, r, nm, pad=2):
    """Normalised PSF and sample spacings in mm. Scale from the fitted pupil map."""
    N = P.shape[0]
    M = N * pad
    psf = np.abs(np.fft.fft2(P, (M, M))) ** 2
    psf /= psf.sum()
    sx, sy = optics.pupil_scale(r)
    dg = r["dg"]
    return psf, nm * 1e-6 / (M * sx * dg), nm * 1e-6 / (M * sy * dg)


def fisher_axis(psf, dx, axis):
    """I = sum (dp/dx)^2 / p with a spectral derivative, per photon, per mm^2. The PSF is band-limited, so the grid holds it."""
    M = psf.shape[axis]
    f = np.fft.fftfreq(M, dx)
    sh = [1, 1]
    sh[axis] = M
    d = np.fft.ifftn(np.fft.fftn(psf) * (2j * np.pi * f.reshape(sh))).real
    keep = psf > psf.max() * 1e-12
    return float((d[keep] ** 2 / psf[keep]).sum())


def qfi_pupil(r, nm):
    """4 Var(k) from the live rays' exit direction cosines. Independent of phase. x and y, per mm^2."""
    m = r["live"]
    k = 2 * np.pi / (nm * 1e-6)
    L, M = optics._real(r["L"])[m], optics._real(r["M"])[m]
    return 4 * k * k * L.var(), 4 * k * k * M.var()


def airy_qfi(na, nm):
    return (2 * np.pi * na / (nm * 1e-6)) ** 2


def transmission(lens, d, field=0.0, coated_R=None, N=64):
    """Mean transmission of the live rays. Unpolarised Fresnel at each surface, or a flat residual R; catalogue absorption."""
    w = lens.primary
    rays, _, _, _ = optics.bundle(lens, field, N)
    r = trace(lens, w, rays, keep=True)
    live = r["ok"] & r["clip"]
    T = np.ones(live.sum())
    nm = lens.wl[w]
    per = []
    for i in range(len(lens.c)):
        n1, n2 = lens.n[w, i], lens.n[w, i + 1]
        ci, ct = r["cos_in"][i][live], r["cos_out"][i][live]
        if n1 == n2:
            per.append(1.0)
            continue
        if coated_R is not None and (n1 == 1.0 or n2 == 1.0):
            t = np.full(T.shape, 1 - coated_R)
        else:
            rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct)
            rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct)
            t = 1 - 0.5 * (rs * rs + rp * rp)
        T = T * t
        per.append(float(t.mean()))
    abso, unknown = 1.0, []
    for i, s in enumerate(d["surfaces"]):
        m = s.get("material")
        if m in (None, "air"):
            continue
        q = glass.internal_transmittance(m, nm, s["t"])
        if q is None:
            unknown.append(i + 1)
        else:
            abso *= q
    return dict(fresnel=float(T.mean()), per_surface=per, absorption=abso, absorption_unknown_surfaces=unknown, total=float(T.mean() * abso))


def _common_mix(stack, ref):
    """Mix per-wavelength PSFs on the reference wavelength's grid by linear resampling."""
    from scipy.ndimage import map_coordinates
    psf0, dx0, dy0, _ = stack[ref]
    M = psf0.shape[0]
    q = np.fft.fftfreq(M) * M
    Y, X = np.meshgrid(q * dy0, q * dx0, indexing="ij")
    out = np.zeros_like(psf0)
    for psf, dx, dy, wt in stack:
        pp = map_coordinates(psf, [(Y / dy) % M, (X / dx) % M], order=1, mode="grid-wrap")
        out += wt * pp / pp.sum()
    return out / out.sum()


def field_limit(lens, field, shift, N, fno_target):
    rs = optics.field_rays(lens, field, N, image_shift=shift)
    w0 = lens.primary
    p = rs[w0]
    px, py = optics.centroid(p)
    nm = lens.wl[w0]
    q_x, q_y = qfi_pupil(p, nm)
    psf0, dx, dy = psf_grid(pupil_field(p, px, py, nm), p, nm)
    mono = 0.5 * (fisher_axis(psf0, dx, 1) + fisher_axis(psf0, dy, 0))
    stack = []
    for w, r in enumerate(rs):
        ps, ddx, ddy = psf_grid(pupil_field(r, px, py, lens.wl[w]), r, lens.wl[w])
        stack.append((ps, ddx, ddy, lens.w[w]))
    mix = _common_mix(stack, w0)
    poly = 0.5 * (fisher_axis(mix, dx, 1) + fisher_axis(mix, dy, 0))
    ws = optics.wave_stats(p, px, py, nm)
    wd = optics.wave_stats(p, px, py, nm, remove_defocus=True)
    q_id = airy_qfi(1 / (2 * fno_target), nm)
    return dict(deg=field, strehl=ws["strehl"], strehl_refocus=wd["strehl"], wave_rms=ws["rms"], qfi_ideal=q_id, qfi_pupil=0.5 * (q_x + q_y), fi_mono=mono, fi_poly=poly,
                area=float(p["live"].sum() * p["dg"] ** 2), crb_nm_ideal=1e6 / np.sqrt(q_id), crb_nm_actual=1e6 / np.sqrt(max(poly, 1e-30)))


def bits(a, b):
    return float(0.5 * np.log2(max(a, 1e-300) / max(b, 1e-300)))


def report(d, lens, coated_R=0.005, focus=None, nmax=512, reached=None):
    """Limit record for one design. reached: the record of what the optimiser got to, same intent."""
    it = d["intent"]
    fields = it["half_field_deg"]
    shift = optics.best_focus(lens, fields, weights=it.get("field_weights")) if focus is None else focus
    t0 = transmission(lens, d, 0.0)
    tc = transmission(lens, d, 0.0, coated_R=coated_R)
    area0, rows = None, []
    for f in fields:
        N = optics.needed_grid(lens, f, shift, nmax=nmax)
        x = field_limit(lens, f, shift, N, it["fno"])
        x["grid"] = N
        area0 = x["area"] if area0 is None else area0
        vig = float(min(x["area"] / area0, 1.0))
        x["vignetted_share"] = 1 - vig
        T, Tc = t0["total"] * vig, tc["total"] * vig
        x["transmission_uncoated"], x["transmission_coated"] = T, Tc
        x["bits"] = dict(pupil=bits(x["qfi_ideal"], x["qfi_pupil"]), aberration=bits(x["qfi_pupil"], x["fi_mono"]), chromatic=bits(x["fi_mono"], x["fi_poly"]), photon_loss=bits(1.0, T))
        x["bits"]["total"] = sum(x["bits"].values())
        x["bits_coating_gain"] = bits(Tc, T)
        rows.append(x)
    worst = max(rows, key=lambda r: r["bits"]["total"])
    b = worst["bits"]
    cause = max(("pupil", "aberration", "chromatic", "photon_loss"), key=lambda k: b[k])
    reach = dict(coating_bits=worst["bits_coating_gain"], coating_assumption=f"residual reflection {coated_R} per air-glass surface; an assumption, no coating was designed",
                 aberration_at_bound="phase does not reduce quantum Fisher information, so a corrector could in principle remove the aberration term at one field and wavelength; nothing here shows it can be built",
                 optimiser_reached=None)
    if reached is not None:
        reach["optimiser_reached"] = [dict(deg=a["deg"], total_before=a2["bits"]["total"], total_after=a["bits"]["total"], aberration_before=a2["bits"]["aberration"], aberration_after=a["bits"]["aberration"]) for a, a2 in zip(reached["fields"], rows)]
    lam = float(lens.wl[lens.primary])
    return dict(design=d["id"], job="point localisation and imaging through a real stop", wavelength_nm=lam, target_fno=it["fno"], focus_shift_mm=shift,
                diffraction=dict(cutoff_cy_mm=float(1 / it["fno"] / (lam * 1e-6)), airy_radius_um=float(1.22 * lam * 1e-3 * it["fno"])),
                transmission_axis=dict(uncoated=t0, coated=tc), fields=rows, largest_gap=dict(deg=worst["deg"], cause=cause, bits=b), reachable=reach,
                assumptions=["photon counting with no pixel, read noise or background", "scalar optics on the launch-grid pupil", "absorption from catalogue extinction; model glasses carry none", "a calculation on the design, not a measurement of a built part"])
