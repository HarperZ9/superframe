# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Composed pipeline: blend -> lattice resample -> spectral shade, each stage on any device.

Three source layers, each with two channels (material mix w, incidence cosine c), are
blended with per-channel weights and zero detune; the blended field is resampled onto a
hex lattice and reconstructed; the reconstruction drives a gold/BK7 spectral shade that
returns XYZ per pixel. Every placement of the three stages on {cpu, cuda} is run and the
final output bytes compared. Stages hand numpy arrays to each other, so a cross-device
hop is one explicit copy.
"""
import itertools

import numpy as np

import blend.kernel as KB
import lattice_resample.kernel as KL
import spectral_shade.kernel as KS
from kcore import receipt
from kcore.ops import NumpyOps, TorchOps, cuda_available, device_label
from kcore.run import bitwise_equal, run_device, run_shared

F32, F64 = np.float32, np.float64


def sources(rng, h, w, n=3):
    yy, xx = np.mgrid[0:h, 0:w] / max(h, w)
    layers = []
    for i in range(n):  # host-only test layers: smooth fields in [0, 1]
        mix = 0.5 + 0.5 * np.sin(6 * xx + 2.1 * i) * np.cos(4 * yy - i)
        cos = 0.55 + 0.45 * np.cos(3 * (xx - 0.5) * (yy + 0.3 * i))
        layers.append(np.stack([mix, cos]).reshape(2, h * w))
    x = np.stack(layers).astype(F32) + F32(0.01) * rng.standard_normal((n, 2, h * w)).astype(F32)
    wts = rng.uniform(0.2, 1.0, (n, 2))
    wts = (wts / wts.sum(0)).astype(F32)
    return x, wts


def _stage(mod, inp, where, ops):
    if where == "shared":  # one call split 37 % CPU / 63 % GPU along the kernel's separable axis
        return run_shared(mod, inp, [(ops["cpu"], 0.37), (ops["cuda"], 0.63)])
    return run_device(mod, inp, ops[where])


def run_pipeline(placement, x, wts, h, w, spec):
    need = "cuda" in placement or "shared" in placement
    ops = {"cpu": NumpyOps(), "cuda": TorchOps() if need else None}
    st = {}
    b_in = {"x": x, "w": wts, "ratio": KB.detune_ratios([0.0] * x.shape[0]),
            "gain": np.array(1.0, F32), "t": np.arange(h * w, dtype=F64)}
    y = _stage(KB, b_in, placement[0], ops)["y"]
    st["blend"] = y
    l_in = KL.lattice_inputs(y.reshape(2, h, w), "hex", 1.5)
    r = run_device(KL, l_in, ops[placement[1]])
    st["resample"] = r["recon"]
    s_in = dict(spec)
    s_in["wmix"] = r["recon"][0].reshape(-1)
    s_in["cosi"] = r["recon"][1].reshape(-1)
    st["shade"] = _stage(KS, s_in, placement[2], ops)["xyz"]
    return st, (b_in, l_in, s_in)


def compose(h=96, w=128, seed=11, write_receipt=True):
    rng = np.random.default_rng(seed)
    x, wts = sources(rng, h, w)
    spec = KS.spectra("gold", "bk7", "D65")
    devs = ["cpu", "cuda"] if cuda_available() else ["cpu"]
    runs = {}
    for placement in itertools.product(devs, repeat=3):
        runs["/".join(placement)], ins = run_pipeline(placement, x, wts, h, w, spec)
    if "cuda" in devs:  # blend and shade split inside one call across both devices
        runs["shared/cuda/shared"], _ = run_pipeline(("shared", "cuda", "shared"), x, wts, h, w, spec)
    base = "cpu/cpu/cpu"
    table = {}
    for name, st in runs.items():
        table[name] = {stage: bitwise_equal(st[stage], runs[base][stage]) for stage in st}
    final = runs[base]["shade"]
    if write_receipt:
        rec = receipt.make("pipeline:blend>lattice_resample>spectral_shade", "0.1.0", "bit-identical",
                           "+".join(device_label(o) for o in [NumpyOps()] + ([TorchOps()] if "cuda" in devs else [])),
                           {"x": x, "w": wts, "h": h, "w_px": w}, {"xyz": final},
                           {"placements": sorted(runs), "all_equal": all(all(v.values()) for v in table.values())})
        receipt.append(rec, "pipeline.jsonl")
    return {"placements": table, "all_bit_identical": all(all(v.values()) for v in table.values()),
            "xyz_hash": receipt.array_hash(final), "xyz_mean": [float(v) for v in final.mean(0)],
            "shape": [h, w]}
