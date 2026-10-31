# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known-answer tests for the physical CRT. Run: python -B tests/test_crt.py (or pytest)."""
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from crt import Tube, beam, glass, phosphors, scene, screen  # noqa: E402
from crt.backend import Numpy  # noqa: E402

SMALL = dict(diagonal_in=6.0)
RESULTS = {}


def record(name, ok, **kw):
    RESULTS[name] = dict(ok=bool(ok), **kw)
    assert ok, (name, kw)


def test_line_rate():
    t = Tube(**SMALL)
    bt = t.beam_time(0)
    dl = float(np.max(np.abs(np.diff(bt, axis=0) - t.H)))
    df = float(np.max(np.abs(t.beam_time(1) - bt - t.T)))
    x, _ = t.beam_x()
    span = (bt[0, -1] - bt[0, 0]) / ((x[-1] - x[0]) / t.raster_w)
    record("line_rate", abs(t.H - 63.5556e-6) < 1e-10 and abs(1 / t.T - 60.0544) < 1e-3 and dl < 1e-15
           and df < 1e-15 and abs(span - t.active_s) < 1e-12,
           H_us=t.H * 1e6, field_hz=1 / t.T, line_step_err_s=dl, field_step_err_s=df, active_us=span * 1e6)


def test_beam_arrival():
    """A single lit source pixel: light first appears in a window that opens at its beam time."""
    t = Tube(**SMALL)
    img = np.zeros((240, 320, 3))
    img[100, 160] = 1.0
    x, _ = t.beam_x()
    k = int(np.argmin(np.abs((x + t.raster_w / 2) / t.raster_w * 320 - 160.5)))
    t_hit = t.beam_time(0)[100, k]
    before = beam.frame(t, lambda f: img if f == 0 else 0 * img, t_hit - 2e-6, t_hit - 0.5e-6, history=0, static=False, tail=False)
    after = beam.frame(t, lambda f: img if f == 0 else 0 * img, t_hit - 2e-6, t_hit + 5e-6, history=0, static=False, tail=False)
    record("beam_arrival", before.sum() == 0 and after.sum() > 0, t_hit_us=t_hit * 1e6,
           line_start_us=t.line_start(100) * 1e6)


def test_decay_constants():
    out = {}
    targets = {"ast": (0.1, [850e-6, 35e-6, 80e-6]), "patent": (0.01, [1.9e-3, 7.5e-3, 7.0e-3])}
    ok = True
    for name, (level, want) in targets.items():
        got = [phosphors.times_to(law, level) for law in phosphors.decay_preset(name)]
        err = [abs(g - w) / w for g, w in zip(got, want)]
        ok &= max(err) < 1e-6
        out[name] = dict(level=level, want_s=want, got_s=got, rel_err=err)
    t0, n = phosphors.two_point_hyperbola(35e-6, 7.5e-3)
    out["green_two_source_fit"] = dict(t0_s=t0, n=n, finite_energy=n > 1)
    record("decay_constants", ok, **out)


def test_decay_kuhn():
    """Kuhn 2002 P22 (default preset): the red slow term has tau = 1/(2 pi 360 Hz) = 0.442 ms; the
    green and blue power laws alone fall to 10% in t0 (10^(1/n) - 1) = 39.1 and 34.8 us, which RCA
    TPM-1508A (1961) lists as about 38 us for ZnS:Cu (P31) and 34 us for ZnS:Ag (P11). Agreement within
    10% is the criterion (RCA quotes two figures)."""
    r, g, b = phosphors.decay_preset("kuhn2002")
    tau_red = 1 / min(k for _, k in r.exps)
    pw = [g.power_t_to(0.1), b.power_t_to(0.1)]
    rca = [38e-6, 34e-6]
    err = [abs(p - q) / q for p, q in zip(pw, rca)]
    f_red_1ms = float(r.F(np.array(1e-3)))
    ok = abs(tau_red - 0.442e-3) < 1e-6 and max(err) < 0.10 and abs(f_red_1ms - 0.908) < 0.002
    record("decay_kuhn", ok, tau_red_s=tau_red, power_t10_s=pw, rca_t10_s=rca, rel_err=err, F_red_1ms=f_red_1ms)


def test_decay_through_frame():
    """Sample the light of one flash in short windows; the ratio follows the law's I(tau)."""
    t = Tube(**SMALL)
    img = np.zeros((240, 320, 3))
    img[100, 150:170] = 1.0
    t_hit = t.beam_time(0)[100].mean()
    src = lambda f: img if f == 0 else 0 * img  # noqa: E731
    dt, res = 2e-6, {}
    for c, law in enumerate(t.ph["decay"]):
        tau = [20e-6, 200e-6, 2e-3]
        q = [beam.frame(t, src, t_hit + s, t_hit + s + dt, history=0, static=False, tail=False)[..., c].sum() for s in tau]
        ref = [law.F(s + dt) - law.F(s) for s in tau]
        res[c] = float(max(abs(q[i] / q[0] - ref[i] / ref[0]) / (ref[i] / ref[0]) for i in range(3)))
    record("decay_through_frame", max(res.values()) < 0.02, max_rel_err=res)


def test_mask_pitch():
    t = Tube(**SMALL)
    Q = beam.frame(t, scene.flat(1.0), 0, t.T)
    co = screen.cells(t, Q, halo=False)
    row = co[t.rows // 2, :, 0]
    spec = np.abs(np.fft.rfft(row - row.mean()))
    f = np.fft.rfftfreq(row.size, d=t.dx)[np.argmax(spec)]
    on = [float(co[t.rows // 2, c::3, c].mean()) for c in range(3)]
    off = float(co[t.rows // 2, 1::3, 0].max())
    record("mask_pitch", abs(1 / f - t.pitch_mm) < 1e-9 and off == 0.0 and min(on) > 0,
           pitch_mm=t.pitch_mm, measured_mm=1 / f, triads=t.triads, face_mm=t.face_w)


def test_energy():
    t = Tube(**SMALL)
    still = scene.dungeon(3)(0)
    E, sig = beam.excite(t, still)
    rel, budget = [], {}
    for c in range(3):
        face, missed = beam.scatter(t, E[c], sig[c], Numpy())
        rel.append(abs(face.sum() + missed - E[c].sum()) / E[c].sum())
        budget[c] = dict(beam_J=float(E[c].sum()), face_J=float(face.sum()), missed_J=float(missed))
    led = {}
    Q = beam.frame(t, lambda f: still, 0, t.T, history=600, ledger=led)
    landed = sum(t.ph["eta"][c] * t.mask_transmission * budget[c]["face_J"] for c in range(3))
    steady = abs(Q.sum() - landed) / landed
    img = np.zeros((801, 801))
    img[400, 400] = 1.0
    out, kappa = glass.halate(t.glass, img, 1.52, 0.2, 0.2, reach_mm=70)
    halo_err = abs(out.sum() - 1 / (1 - t.glass.albedo * kappa))
    n = 1.52
    X1 = glass.Faceplate(transmission=1.0).exit_fraction(n)
    record("energy", max(rel) < 1e-12 and steady < 2e-3 and halo_err < 1e-4 and 0.9 / n ** 2 < X1 < 1 / n ** 2,
           scatter_rel_err=max(rel), steady_state_rel_err=steady, halation_sum_err=halo_err, kappa=kappa,
           exit_T1=X1, one_over_n2=1 / n ** 2, budget=budget)


def test_spot_growth():
    t = Tube(**SMALL)
    src, rows = scene.drive_lines()
    Q = beam.frame(t, src, 0, t.T)
    prof = Q[:, t.triads // 2, 1]
    y = t.y_rows()
    res, ok = [], True
    for r, v in zip(rows, (0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0)):
        yc = t.line_y()[r]
        win = np.abs(y - yc) < 4 * t.line_mm
        p, yy = prof[win], y[win]
        m = (p * yy).sum() / p.sum()
        s_meas = math.sqrt(max((p * (yy - m) ** 2).sum() / p.sum() - t.dx ** 2 / 12, 0))
        s_want = float(t.sigma(t.current(v, 1)))
        res.append(dict(drive=v, sigma_mm=s_meas, want_mm=s_want, fwhm_mm=2.3548 * s_meas))
        ok &= abs(s_meas - s_want) < 0.02
    record("spot_growth", ok and res[-1]["sigma_mm"] > res[0]["sigma_mm"] * 1.5, lines=res)


def test_white_point():
    t = Tube(**SMALL)
    co = screen.cells(t, beam.frame(t, scene.flat(1.0), 0, t.T))
    xyz = screen.luminance(t, co, t.T)[t.rows // 3:2 * t.rows // 3, t.cols // 3:2 * t.cols // 3].mean(axis=(0, 1))
    x, y = xyz[0] / xyz.sum(), xyz[1] / xyz.sum()
    record("white_point", abs(x - 0.31271) < 0.003 and abs(y - 0.32902) < 0.003, xy=[x, y], Y_cd_m2=xyz[1])


def _bytes(seed):
    t = Tube(**SMALL)
    co = screen.cells(t, beam.frame(t, scene.dungeon(seed), 0, t.T))
    return hashlib.sha256(screen.to_display(screen.luminance(t, co, t.T), 100.0).tobytes()).hexdigest()


def test_determinism():
    a, b, c = _bytes(1), _bytes(1), _bytes(2)
    record("determinism", a == b and a != c, seed1=a, seed1_again=b, seed2=c)


def test_controls():
    """The checks must catch wrong answers: a 1% decay error and a wrong expected pitch."""
    law = phosphors.Hyperbolic(7.5e-3 / 9.0 * 1.01, 2.0)
    decay_caught = abs(phosphors.times_to(law, 0.01) - 7.5e-3) / 7.5e-3 > 1e-6
    t = Tube(**SMALL, pitch_mm=0.62)
    Q = beam.frame(t, scene.flat(1.0), 0, t.T, history=0)
    row = screen.cells(t, Q, halo=False)[t.rows // 2, :, 0]
    f = np.fft.rfftfreq(row.size, d=t.dx)[np.argmax(np.abs(np.fft.rfft(row - row.mean())))]
    pitch_caught = abs(1 / f - 0.60) > 1e-3
    g = phosphors.Kuhn("green")
    g.power = (g.power[0], g.power[1], 2.0)  # the old n = 2 exponent must fail the RCA check
    n2_caught = abs(g.power_t_to(0.1) - 38e-6) / 38e-6 > 0.10
    record("controls", decay_caught and pitch_caught and n2_caught, decay_1pct_caught=decay_caught,
           pitch_0p62_caught=pitch_caught, becquerel_n2_caught=n2_caught)


if __name__ == "__main__":
    fails = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            try:
                fn()
                print("PASS", name)
            except AssertionError as e:
                fails += 1
                print("FAIL", name, e)
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if out:
        out.write_text(json.dumps(RESULTS, indent=1, default=float), encoding="utf-8")
    raise SystemExit(1 if fails else 0)
