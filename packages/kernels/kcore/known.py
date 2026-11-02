# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known-answer tests. Equivalence shows the devices agree; these show the shared
answer is the right one, by cases whose result is known without the kernel."""

import numpy as np

from kcore.ops import NumpyOps
from kcore.run import run_device


def _blend(rng):
    import blend.kernel as K
    out = []
    inp = K.make_inputs(rng, {"N": 3, "C": 2, "L": 32, "T": 32, "detune": 0.0, "gain": 0.25})
    inp["w"] = np.array([[0, 0], [1, 1], [0, 0]], np.float32)
    y = run_device(K, inp, NumpyOps())["y"]
    out.append(("one-hot weight, zero detune: y == gain * x[1]", bool(np.array_equal(y, np.float32(0.25) * inp["x"][1]))))
    inp = K.make_inputs(rng, {"N": 2, "C": 1, "L": 16, "T": 64, "detune": 1200.0, "gain": 1.0})
    inp["w"] = np.array([[1], [0]], np.float32)  # source 0 at -600 cents: ratio 2^-0.5
    y = run_device(K, inp, NumpyOps())["y"][0]
    x = inp["x"][0, 0]
    p = np.arange(64) * 2 ** -0.5
    want = np.interp(p % 16, np.arange(17), np.append(x, x[0]))
    out.append(("detuned read equals periodic linear interpolation (1e-5)", bool(np.allclose(y, want, atol=1e-5))))
    return out


def _advect(rng):
    import advect_diffuse.kernel as K
    inp = K.make_inputs(rng, {"ny": 32, "nx": 32, "kappa": 0.0})
    inp["u"][:] = 0
    inp["v"][:] = 0
    q = run_device(K, inp, NumpyOps())["q"]
    out = [("zero velocity, zero diffusivity: identity", bool(np.array_equal(q, inp["q"])))]
    inp = K.make_inputs(rng, {"ny": 32, "nx": 32, "kappa": 5e-3})
    inp["u"][:] = 0
    inp["v"][:] = 0
    q = run_device(K, inp, NumpyOps())["q"]
    rel = abs(q.sum() - inp["q"].sum()) / abs(inp["q"]).sum()
    out.append((f"diffusion conserves the total (rel {rel:.1e} < 1e-12)", bool(rel < 1e-12)))
    out.append(("diffusion lowers the maximum (discrete maximum principle)", bool(q.max() <= inp["q"].max())))
    inp = K.make_inputs(rng, {"ny": 16, "nx": 16, "kappa": 0.0})
    h, dt = inp["par"][0], inp["par"][1]
    inp["u"][:] = h / dt  # exactly one cell per step in x
    inp["v"][:] = 0
    q = run_device(K, inp, NumpyOps())["q"]
    out.append(("uniform one-cell shift equals a roll (1e-12)", bool(np.allclose(q, np.roll(inp["q"], 1, 1), atol=1e-12))))
    return out


def _lattice(rng):
    import lattice_resample.kernel as K
    out = []
    for kind in ("hex", "square"):
        h, w = 40, 48
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
        img = (0.01 * xx - 0.02 * yy + 0.5)[None].astype(np.float32)
        r = run_device(K, K.lattice_inputs(img, kind, 1.7), NumpyOps())["recon"]
        err = float(np.abs(r[0, 2:-2, 2:-2] - img[0, 2:-2, 2:-2]).max())
        out.append((f"{kind}: linear image reconstructs in the interior (err {err:.1e} < 1e-5)", err < 1e-5))
    return out


def _spectral(rng):
    import spectral_shade.kernel as K
    M, spectral = K._materials()
    from materials import optics
    inp = K.make_inputs(rng, {"P": 16})
    worst = 0.0
    for p in range(16):
        w, c = float(inp["wmix"][p]), float(inp["cosi"][p])
        for i in range(0, 81, 10):
            n = float(inp["nA"][i]) * (1 - w) + float(inp["nB"][i]) * w
            k = float(inp["kA"][i]) * (1 - w) + float(inp["kB"][i]) * w
            r = K.reflectance(np.float32(n), np.float32(k), np.float32(c), np.float32(1.0), NumpyOps())
            worst = max(worst, abs(float(r) - optics.fresnel(complex(n, k), c)))
    out = [(f"Fresnel agrees with tools/materials optics.fresnel (max abs {worst:.1e} < 2e-6)", worst < 2e-6)]
    inp["wmix"][:] = 0.0
    inp["cosi"][:] = 1.0
    xyz = run_device(K, inp, NumpyOps())["xyz"][0]
    R = [optics.normal_reflectance(n, k) for n, k in zip(inp["nA"].astype(float), inp["kA"].astype(float))]
    want = spectral.to_xyz(R, spectral.illuminant("D65"))
    rel = max(abs(a - b) / abs(b) for a, b in zip(xyz, want))
    out.append((f"normal-incidence gold XYZ agrees with tools/materials to_xyz (rel {rel:.1e} < 1e-5)", rel < 1e-5))
    eta = complex(1.5, 0)
    r = K.reflectance(np.float32(1.5), np.float32(0), np.float32(1.0), np.float32(1.0), NumpyOps())
    out.append(("glass n=1.5 at normal incidence: R = 0.04 (1e-7)", abs(float(r) - abs((eta - 1) / (eta + 1)) ** 2) < 1e-7))
    return out


TABLE = {"blend": _blend, "advect_diffuse": _advect, "lattice_resample": _lattice, "spectral_shade": _spectral}


def run(name, rng):
    return [{"name": n, "pass": bool(ok)} for n, ok in TABLE[name](rng)]
