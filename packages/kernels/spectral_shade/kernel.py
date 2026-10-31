# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Spectral shading: per pixel, mix two materials' n(l), k(l), take the unpolarised
Fresnel reflectance at the pixel's incidence cosine, and integrate it with a light
spectrum and the CIE 1931 2-degree observer to XYZ. Mode: bit-identical. See SPEC.md.
Spectra come from tools/materials (read only)."""
import sys
from pathlib import Path

import numpy as np

from kcore.fixed import fixed_sum, fixed_sum_reference

NAME = "spectral_shade"
VERSION = "0.1.0"
MODE = "bit-identical"
TOLERANCE = None
SPLIT = {"wmix": 0, "cosi": 0}
OUT_AXIS = {"xyz": 0}
F32 = np.float32
MATERIALS = Path(__file__).resolve().parents[2] / "materials"


def _materials():
    sys.dont_write_bytecode = True
    if str(MATERIALS) not in sys.path:
        sys.path.insert(0, str(MATERIALS))
    import materials as M
    from materials import spectral
    return M, spectral


def spectra(mat_a="gold", mat_b="bk7", light="D65"):
    """Host-side: n, k for two materials, the light and the CMFs on the 81-sample grid."""
    M, spectral = _materials()
    out = {}
    for tag, mid in (("A", mat_a), ("B", mat_b)):
        opt = M.get(mid)["optics"]
        n = opt["n"]["value"]
        k = (opt.get("k") or {}).get("value") or [0.0] * len(n)
        out["n" + tag], out["k" + tag] = np.array(n, F32), np.array(k, F32)
    out["light"] = np.array(spectral.illuminant(light), F32)
    out["cmf"] = np.array(spectral.cmf(), F32)  # [81, 3]
    out["n_out"] = np.array(1.0, F32)
    return out


def make_inputs(rng, size):
    p = size["P"]
    out = spectra(size.get("a", "gold"), size.get("b", "bk7"))
    out["wmix"] = rng.uniform(0, 1, p).astype(F32)
    out["cosi"] = rng.uniform(0, 1, p).astype(F32)
    return out


def prepare(inp, ops):
    return {k: ops.put(v) for k, v in inp.items()}


def reflectance(n, k, c, n_out, ops):
    """Unpolarised Fresnel R for complex index n + ik from a medium of real index n_out,
    written in real operations only: |rs|^2 = |c - w|^2 / |c + w|^2, w = sqrt(eta^2 - s2)."""
    half, two, zero = ops.scalar(0.5, F32), ops.scalar(2.0, F32), ops.scalar(0.0, F32)
    one = ops.scalar(1.0, F32)
    er, ei = n / n_out, k / n_out
    e2r, e2i = er * er - ei * ei, (er * ei) * two
    s2 = one - c * c
    ar, ai = e2r - s2, e2i
    r = ops.sqrt(ar * ar + ai * ai)
    wr = ops.sqrt((r + ar) * half)
    wi = ops.sqrt(ops.maximum((r - ar) * half, zero))
    wi = ops.where(ai < zero, -wi, wi)
    rs = ((c - wr) * (c - wr) + wi * wi) / ((c + wr) * (c + wr) + wi * wi)
    pr, pi = e2r * c, e2i * c
    rp = (((pr - wr) * (pr - wr) + (pi - wi) * (pi - wi))
          / ((pr + wr) * (pr + wr) + (pi + wi) * (pi + wi)))
    return half * (rs + rp)


def run(d, ops):
    zero, one = ops.scalar(0.0, F32), ops.scalar(1.0, F32)
    w = ops.minimum(ops.maximum(d["wmix"], zero), one)[:, None]
    c = ops.minimum(ops.maximum(d["cosi"], zero), one)[:, None]
    n = d["nA"][None, :] * (one - w) + d["nB"][None, :] * w
    k = d["kA"][None, :] * (one - w) + d["kB"][None, :] * w
    R = reflectance(n, k, c, d["n_out"], ops)
    light, cmf = d["light"], d["cmf"]
    norm = fixed_sum(light * cmf[:, 1], ops, F32)
    RS = R * light[None, :]
    xyz = [fixed_sum(RS * cmf[None, :, m], ops, F32) / norm for m in range(3)]
    return {"xyz": ops.stack(xyz, 1)}


def _refl_ref(n, k, c, n_out):
    t = F32
    er, ei = t(n / n_out), t(k / n_out)
    e2r, e2i = t(t(er * er) - t(ei * ei)), t(t(er * ei) * t(2.0))
    s2 = t(t(1.0) - t(c * c))
    ar, ai = t(e2r - s2), e2i
    r = np.sqrt(t(t(ar * ar) + t(ai * ai)))
    wr = np.sqrt(t(t(r + ar) * t(0.5)))
    wi = np.sqrt(max(t(t(r - ar) * t(0.5)), t(0.0)))
    if ai < 0:
        wi = -wi
    rs = t(t(t((c - wr) * (c - wr)) + t(wi * wi)) / t(t((c + wr) * (c + wr)) + t(wi * wi)))
    pr, pi = t(e2r * c), t(e2i * c)
    rp = t(t(t((pr - wr) * (pr - wr)) + t((pi - wi) * (pi - wi)))
           / t(t((pr + wr) * (pr + wr)) + t((pi + wi) * (pi + wi))))
    return t(t(0.5) * t(rs + rp))


def reference(inp):
    t = F32
    L = len(inp["light"])
    light, cmf = inp["light"], inp["cmf"]
    norm = fixed_sum_reference([t(light[i] * cmf[i, 1]) for i in range(L)], F32)
    out = np.zeros((len(inp["wmix"]), 3), F32)
    for p in range(len(inp["wmix"])):
        w = min(max(inp["wmix"][p], t(0.0)), t(1.0))
        c = min(max(inp["cosi"][p], t(0.0)), t(1.0))
        R = []
        for i in range(L):
            n = t(t(inp["nA"][i] * t(t(1.0) - w)) + t(inp["nB"][i] * w))
            k = t(t(inp["kA"][i] * t(t(1.0) - w)) + t(inp["kB"][i] * w))
            R.append(_refl_ref(n, k, c, inp["n_out"][()]))
        for m in range(3):
            terms = [t(t(R[i] * light[i]) * cmf[i, m]) for i in range(L)]
            out[p, m] = t(fixed_sum_reference(terms, F32) / norm)
    return {"xyz": out}


def work(inp):
    p, L = len(inp["wmix"]), len(inp["light"])
    bytes_ = p * (4 + 4 + 12) + L * 4 * 8
    flops = p * L * (8 + 44 + 2 + 6)
    return bytes_, flops


def results(inp):
    return len(inp["wmix"])


open_reference = None  # no built-in spectral Fresnel shader exists in numpy or torch

TEST_SIZE = {"P": 24}
CHECK_SIZE = {"P": 65536}
SMOKE_SIZES = [{"P": 4096}, {"P": 262144}]
