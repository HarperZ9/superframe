# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Equivalence checks: every kernel against its reference, on every device.

For each kernel:
  1. small sizes: reference vs CPU (1 thread), CPU (threads), CUDA;
  2. one larger size: CPU vs CUDA only (the reference is too slow there);
  3. a false-success control: one output perturbed by 1 ulp must fail the comparator;
  4. the open built-in (where one exists) vs the kernel, reported as max ulp, to show
     that a different reduction order is caught by the bit-identical contract;
  5. known answers from kcore.known.
Bit-identical mode passes only on equal bytes. Tolerance mode passes within TOLERANCE ulp.
"""
import numpy as np

from kcore import controls, known, receipt
from kcore.ops import NumpyOps, TorchOps, cuda_available, device_label
from kcore.run import bitwise_equal, max_ulp, run_device


def _devices(threads):
    devs = [("cpu", NumpyOps(1))]
    devs.append((f"cpu-threads{threads}", NumpyOps(threads)))
    if cuda_available():
        devs.append(("cuda", TorchOps()))
    return devs


def _same(mod, a, b):
    if mod.MODE == "bit-identical":
        return all(bitwise_equal(a[k], b[k]) for k in a)
    return all(max_ulp(a[k], b[k]) <= mod.TOLERANCE for k in a)


def _ulps(a, b):
    return {k: max_ulp(a[k], b[k]) for k in a if a[k].shape == b[k].shape}


def check_kernel(mod, threads=4, seed=20261030, write_receipts=True):
    rng = np.random.default_rng(seed)
    devs = _devices(threads)
    res = {"kernel": mod.NAME, "version": mod.VERSION, "mode": mod.MODE, "tolerance": mod.TOLERANCE,
           "vs_reference": {}, "cross_device": {}, "controls": {}, "known_answers": []}
    for size in getattr(mod, "TEST_SIZES", [mod.TEST_SIZE]):
        inp = mod.make_inputs(rng, size)
        ref = mod.reference(inp)
        for name, ops in devs:
            out = run_device(mod, inp, ops)
            ok = _same(mod, ref, out)
            prev = res["vs_reference"].get(name, {"pass": True, "max_ulp": 0})
            res["vs_reference"][name] = {"pass": prev["pass"] and ok,
                                         "max_ulp": max([prev["max_ulp"], *_ulps(ref, out).values()])}
    inp = mod.make_inputs(rng, mod.CHECK_SIZE)
    outs, recs = {}, {}
    for name, ops in devs:
        outs[name] = run_device(mod, inp, ops)
        recs[name] = receipt.make(mod.NAME, mod.VERSION, mod.MODE, device_label(ops), inp, outs[name],
                                  {"purpose": "kernels check", "size": mod.CHECK_SIZE})
        if write_receipts:
            receipt.append(recs[name])
    base = devs[0][0]
    for name in outs:
        if name != base:
            res["cross_device"][f"{base}~{name}"] = {
                "pass": _same(mod, outs[base], outs[name]),
                "max_ulp": max(_ulps(outs[base], outs[name]).values()),
                "receipt_outputs_equal": recs[base]["outputs"] == recs[name]["outputs"]}
    res["check_size"] = mod.CHECK_SIZE
    res["output_hash"] = recs[base]["outputs"]
    res["controls"]["one_ulp_perturbation_detected"] = _perturbation_caught(mod, outs[base])
    res["controls"]["open_builtin_max_ulp"] = _open_ulps(mod, inp, devs, outs[base])
    res["controls"]["drift_variants"] = controls.run(mod.NAME, rng)
    res["known_answers"] = known.run(mod.NAME, rng)
    res["pass"] = (all(v["pass"] for v in res["vs_reference"].values())
                   and all(v["pass"] for v in res["cross_device"].values())
                   and res["controls"]["one_ulp_perturbation_detected"]
                   and all(v["caught"] for v in res["controls"]["drift_variants"])
                   and all(k["pass"] for k in res["known_answers"]))
    return res


def _perturbation_caught(mod, out):
    bad = {k: v.copy() for k, v in out.items()}
    k0 = next(iter(bad))
    flat = bad[k0].reshape(-1)
    flat[0] = np.nextafter(flat[0], np.inf, dtype=flat.dtype)
    return not _same(mod, out, bad) if mod.MODE == "bit-identical" else max_ulp(out[k0], bad[k0]) == 1


def _open_ulps(mod, inp, devs, out):
    if getattr(mod, "open_reference", None) is None:
        return None
    found = {}
    for name, ops in devs:
        if "threads" in name:
            continue
        o = mod.open_reference(mod.prepare(inp, ops), ops)
        ops.sync()
        o = {k: ops.get(v).astype(out[k].dtype) for k, v in o.items()}
        common = {k: o[k] for k in o if k in out and o[k].shape == out[k].shape}
        found[name] = {k: {"max_ulp": max_ulp(out[k], v), "max_abs": float(np.abs(out[k] - v).max()),
                           "bitwise_equal": bool(np.array_equal(out[k], v))}
                       for k, v in common.items()} or "different output shape"
    return found
