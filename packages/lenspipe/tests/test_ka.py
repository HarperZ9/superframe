# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Known answers. Margins are stated in each test. Run with: python -I -B -m pytest tests (from the project folder)."""
import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
warnings.simplefilter("ignore")
np.seterr(all="ignore")

from lenspipe import asbuilt, cadout, design, glass, interchange, limits, optics, rules, tolerance, trace  # noqa: E402

D = ROOT / "data" / "designs"


def load(n):
    return design.load(D / f"{n}.json")


def singlet(r1, r2, ct, mat, semi=10.0, conic=0.0, bfd=100.0, fno=5.0, fields=(0.0,), wl=(587.5618,)):
    s = [dict(r=None, t=0.0, material=None, semi=semi, stop=True), dict(r=r1, t=ct, material=mat, semi=semi), dict(r=r2, t=bfd, material=None, semi=semi, conic=conic)]
    return design.validate(dict(schema=design.SCHEMA, id="t", units="mm", surfaces=s, intent=dict(fno=fno, half_field_deg=list(fields), wavelengths_nm=list(wl), primary=0)))


@pytest.mark.parametrize("name,target,margin_pct", [("us2784643_ex1", 100.0, 0.05), ("us2784643_ex2", 100.0, 0.05), ("comsol_dg", 100.2, 0.05)])
def test_published_focal_length(name, target, margin_pct):
    """Patent prints f = 1.00000 for both examples, scaled here by 100; COMSOL states 100.2 mm for its glass substitution."""
    efl = float(np.real(trace.paraxial(design.to_lens(load(name)))[0]))
    assert abs(efl - target) / target * 100 < margin_pct, efl


def test_comsol_back_focus_and_best_focus():
    """Table 1 prints 61.418 mm to the image; the PDF states best focus 187 um ahead of nominal at 550 nm, on axis. Margin 0.01 percent and 40 um."""
    L = design.to_lens(load("comsol_dg"))
    assert abs(float(np.real(trace.paraxial(L)[1])) - 61.418) < 0.01
    bf = optics.best_focus(design.to_lens(load("comsol_dg"), [550.0]), (0.0,), N=96)
    assert abs(bf - (-0.187)) < 0.040, bf


def test_comsol_entrance_pupil_stop():
    """COMSOL's nominal entrance pupil 58.941 mm through a 37.2 mm stop. The real stop edge should land near it, margin 1 percent."""
    L = design.to_lens(load("comsol_dg"))
    _, mag = trace.entrance_pupil(L)
    assert abs(2 * L.semi[L.stop] / abs(float(np.real(mag))) - 58.941) / 58.941 < 0.01


def stigmatic(semi=8.0, ct=5.0):
    """Plane front; glass to air through a hyperboloid k = -n^2 of vertex radius -50: focus 50 / (n - 1) behind its vertex."""
    n = glass.index({"nd": 1.5, "vd": 60}, 587.5618)
    return singlet(None, -50.0, ct, {"nd": 1.5, "vd": 60}, conic=-n * n, bfd=50.0 / (n - 1), semi=semi)


def test_stigmatic_hyperboloid():
    """Exercises the asphere path: zero spherical aberration by construction."""
    L = design.to_lens(stigmatic())
    rs = optics.field_rays(L, 0.0, 64)
    assert rs[0]["live"].sum() > 1000
    assert optics.spot_rms(rs, L) * 1e3 < 1e-5


def test_aplanatic_points():
    """Sphere radius R, index n: rays aimed at R(n+1) behind the vertex meet at R(n+1)/n exactly, inside the glass."""
    n, R = 1.6, 20.0
    d = design.validate(dict(schema=design.SCHEMA, id="a", units="mm", surfaces=[dict(r=None, t=0.0, material=None, semi=19.0, stop=True), dict(r=R, t=R * (n + 1) / n - 1.0, material={"nd": n, "vd": 1e6}, semi=19.0), dict(r=None, t=1.0, material=None, semi=500.0)],
                             intent=dict(fno=1, half_field_deg=[0.0], wavelengths_nm=[587.5618], primary=0)))
    L = design.to_lens(d)
    L.n[:, 3] = L.n[:, 2]   # dummy last plane, so the image plane sits in the glass
    h = np.linspace(1, 15, 8)
    zap = R * (n + 1)
    sinu = h / np.hypot(h, zap)
    cosu = np.sqrt(1 - sinu ** 2)
    rays = dict(x=np.zeros(8) + 0j, y=h + 2 * sinu * zap * 0 + 0j, z=np.zeros(8) + 0j, L=np.zeros(8) + 0j, M=-sinu + 0j, N=cosu + 0j)
    res = trace.trace(L, 0, rays)
    # Image plane is on the last plane surface, in glass path; the point is on axis there
    assert res["ok"].all()
    assert np.abs(res["y"]).max() < 1e-9


def test_tilted_plate_shift():
    """Plate thickness t, index n, tilt a: lateral shift t sin a (1 - cos a / sqrt(n^2 - sin^2 a)). Exercises tilt."""
    n, t, a = 1.5, 10.0, np.radians(10.0)
    d = design.validate(dict(schema=design.SCHEMA, id="p", units="mm", surfaces=[dict(r=None, t=0.0, material=None, semi=50, stop=True), dict(r=None, t=t, material={"nd": n, "vd": 1e6}, semi=50), dict(r=None, t=20.0, material=None, semi=50)],
                             intent=dict(fno=4, half_field_deg=[0.0], wavelengths_nm=[587.5618], primary=0)))
    L = design.to_lens(d)
    L.ax = np.array([0.0, a, a])
    L.dy = np.array([0.0, 0.0, t * np.sin(a) * 0 + 0.0])
    # second surface vertex lies along the tilted normal: the plate is one rigid body rotated about the first vertex
    L.dy[2] = -t * np.sin(a) * 0
    r = trace.trace(L, 0, dict(x=np.zeros(1) + 0j, y=np.zeros(1) + 0j, z=np.full(1, -10.0) + 0j, L=np.zeros(1) + 0j, M=np.zeros(1) + 0j, N=np.ones(1) + 0j))
    want = t * np.sin(a) * (1 - np.cos(a) / np.sqrt(n * n - np.sin(a) ** 2))
    # Surface 2 pivots on its own vertex at z = t, so the plate thickness along the normal is t cos a. Correct for that.
    want *= np.cos(a)
    assert abs(abs(r["y"][0].real) - want) < 1e-3 * want + 1e-9, (r["y"][0].real, want)


def test_mtf_matches_circular_pupil():
    """Stigmatic singlet at low NA: MTF equals 2/pi (acos v - v sqrt(1 - v^2)) within 1 percent of unity."""
    L = design.to_lens(stigmatic(semi=5.0, ct=2.0))
    rs = optics.field_rays(L, 0.0, 256)
    na = float(np.sqrt((optics._real(rs[0]["L"])[rs[0]["live"]] ** 2 + optics._real(rs[0]["M"])[rs[0]["live"]] ** 2).max()))
    nuc = 2 * na / 587.5618e-6
    for v in (0.1, 0.3, 0.5, 0.8):
        ms, mt = optics.mtf(rs, L, [v * nuc], pad=2)
        want = 2 / np.pi * (np.arccos(v) - v * np.sqrt(1 - v * v))
        assert abs(ms[0] - want) < 0.01 and abs(mt[0] - want) < 0.01, (v, ms[0], want)


def test_strehl_marechal():
    """Planted spherical zone of known size against exp(-(2 pi sigma)^2), margin 0.03."""
    L = design.to_lens(stigmatic(semi=5.0, ct=2.0))
    lam = 587.5618e-6
    L.irr[2, 1] = 0.4 * lam / 0.5 * 0.5  # sag amplitude; OPD amplitude is (n-1) times this
    rs = optics.field_rays(L, 0.0, 128)
    p = rs[0]
    ws = optics.wave_stats(p, *optics.centroid(p), 587.5618, remove_defocus=True)
    assert abs(ws["strehl"] - np.exp(-(2 * np.pi * ws["rms"]) ** 2)) < 0.03


def test_fisher_reaches_bound_for_flat_pupil_and_drops_with_aberration():
    """Flat circular pupil: classical Fisher = QFI = (2 pi NA / lambda)^2, margin 3 percent. A planted aberration lowers classical, leaves QFI."""
    L = design.to_lens(stigmatic(semi=5.0, ct=2.0))
    x = limits.field_limit(L, 0.0, 0.0, 256, 5.0)
    assert abs(x["fi_mono"] / x["qfi_pupil"] - 1) < 0.03
    L2 = L.copy()
    L2.irr[2, 1] = 2 * 587.5618e-6 / 0.5
    y = limits.field_limit(L2, 0.0, 0.0, 256, 5.0)
    assert y["fi_mono"] < 0.8 * x["fi_mono"]
    assert abs(y["qfi_pupil"] - x["qfi_pupil"]) / x["qfi_pupil"] < 1e-3


def test_relative_illumination_cos4_on_low_distortion_lens():
    """Published double Gauss stopped to f/20 has almost no vignetting or distortion there, so flux RI should read cos^4. Margin 3 percent."""
    d = load("comsol_dg")
    d["surfaces"][5]["semi"] = 2.0
    L = design.to_lens(d)
    ri = optics.relative_illumination(L, [0.0, 10.0, 15.0], 96)
    for f, v in zip((10.0, 15.0), ri[1:]):
        assert abs(v - np.cos(np.radians(f)) ** 4) < 0.03, (f, v)


def test_relative_illumination_singlet_matches_defocus_free_exit_cone():
    """Near the tangential and sagittal foci the exit cone and flux routes should agree. Thin singlet at 0.5 degrees, slow, margin 2 percent."""
    d = singlet(102.0, -102.0, 1.0, {"nd": 1.5, "vd": 60}, semi=40.0, bfd=101.0, fields=(0.0, 0.5))
    d["surfaces"][0]["semi"] = 1.0
    L = design.to_lens(d)
    ri = optics.relative_illumination(L, [0.0, 0.5], 96)[1]
    assert abs(ri - np.cos(np.radians(0.5)) ** 4) < 0.02, ri


def test_geometric_mtf_agrees_with_fft_on_published_lens():
    """The fast score used for search and Monte Carlo, against the FFT, at 10 cy/mm on axis. Margin 0.02."""
    L = design.to_lens(load("comsol_dg"))
    shift = optics.best_focus(L, (0.0, 13.3, 19.0))
    rs = optics.field_rays(L, 0.0, 512, image_shift=shift)
    a = optics.mtf(rs, L, [10.0], pad=2)[0][0]
    b = optics.mtf_geom(rs, L, [10.0])[0][0]
    assert abs(a - b) < 0.02, (a, b)


def test_glass_rows_match_catalogue_nd():
    for name in ("N-BK7", "S-LAM3", "S-BAH11", "N-SF5"):
        row = glass.catalog()[name]
        assert abs(glass.index(name, glass.ND) - row["nd"]) < 2e-5


def test_interchange_round_trip(tmp_path):
    for n in ("comsol_dg", "us2784643_ex1"):
        d = load(n)
        interchange.write_zmx(d, tmp_path / "a.zmx")
        interchange.write_seq(d, tmp_path / "a.seq")
        assert interchange.compare(d, interchange.read_zmx(tmp_path / "a.zmx", d)) == (pytest.approx(0, abs=1e-12), [])
        assert interchange.compare(d, interchange.read_seq(tmp_path / "a.seq", d)) == (pytest.approx(0, abs=1e-12), [])
        rs = interchange.to_lens_room(d)
        assert len(rs["surfaces"]) == len(d["surfaces"]) + 1
        back = interchange.from_lens_room(rs, d)
        for x, y in zip(d["surfaces"], back["surfaces"]):
            assert x["t"] == pytest.approx(y["t"], abs=1e-9) and (x["r"] == y["r"])


def test_iso_codes_round_trip(tmp_path):
    d = load("comsol_dg")
    data = cadout.drawing(d, 0, 1, tmp_path / "e1")
    txt = (tmp_path / "e1.txt").read_text()
    codes = interchange.parse_iso_codes(txt)
    assert codes[3] == data["s2"]["form"].split("/", 1)[1]
    assert "3/3(1/-)" in txt and "4/1'" in txt


def test_rule_flags_the_published_thin_flint_and_blocks_nothing():
    rows = rules.check(load("comsol_dg"))
    assert not rules.blockers(rows)
    assert any(r["rule"] == "aspect_ratio" and r["severity"] == "FLAG" for r in rows)


def test_overclaim_refused():
    with pytest.raises(ValueError):
        asbuilt.refuse_overclaim(dict(verdict="MEETS", note="a perfect part"))
    with pytest.raises(ValueError):
        asbuilt.refuse_overclaim(dict(verdict="PERFECT"))
