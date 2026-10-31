# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Equivalence checks: every kernel against its reference, on every device.

For each kernel:
  1. small sizes: reference vs CPU (1 thread), CPU (threads), CUDA;
  2. one larger size: CPU vs CUDA only (the reference is too slow there);
  3. a false-success control: one output perturbed by 1 ulp must fail the comparator;
  4. the open built-in (where one exists) vs the kernel, reported as max ulp, to show
     that a different reduction order is caught by the bit-identical contract;
  5. known answers from kcore.known;
  6. stressed input profiles and the batch-composition test (kcore/stress.py, after ForgeKernel);
  7. reward-hack gates (kcore/gates.py, after Wafer AI), each with a planted-bad kernel that the
     gate must catch (kcore/planted.py, run once per check by planted_controls).
Bit-identical mode passes only on equal bytes. Tolerance mode passes within TOLERANCE ulp.
"""
import os

import numpy as np

from kcore import controls, gates, known, receipt, stress
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


def fresh_seed():
    """Seeds are drawn at check time and recorded, never fixed values a kernel could learn
    (KernelBench-Verified, arXiv 2607.16241, abstract read 2026-10-30). Rerun with --seed to replay."""
    return int.from_bytes(os.urandom(4), "little")


def check_kernel(mod, threads=4, seed=None, write_receipts=True):
    seed = fresh_seed() if seed is None else seed
    rng = np.random.default_rng(seed)
    devs = _devices(threads)
    res = {"seed": seed, "kernel": mod.NAME, "version": mod.VERSION, "mode": mod.MODE, "tolerance": mod.TOLERANCE,
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
    res["stress"] = stress.run_profiles(mod, devs, seed=seed + 11)
    res["batch"] = stress.run_batch(mod, devs, seed=seed + 12)
    res["gates"] = run_gates(mod, devs, seed=seed + 13)
    res["pass"] = (all(v["pass"] is not False for v in res["stress"].values())
                   and res["batch"]["pass"] is not False
                   and not any(g["caught"] for g in res["gates"].values())
                   and all(v["pass"] for v in res["vs_reference"].values())
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


GATE_SIZE = {"blend": {"N": 8, "C": 2, "L": 4096, "T": 2 ** 22}}  # big enough that GPU time dominates


def run_gates(mod, devs, planted_mod=None, only=None, seed=0):
    """Every reward-hack gate on one kernel, or one gate on a planted imitation of it."""
    m = planted_mod or mod
    big = GATE_SIZE.get(mod.NAME, mod.SMOKE_SIZES[-1])
    want = (lambda g: only is None or g == only)
    out = {}
    if want("static_ban"):
        out["static_ban"] = gates.static_ban(m) if planted_mod is None else gates.static_ban_function(m.run)
    if want("fp64_ulp"):
        out["fp64_ulp"] = gates.fp64_ulp(m, mod.CHECK_SIZE, seed=seed + 8)
    for name, ops in devs:
        if "threads" not in name and want("input_overwrite"):
            out[f"input_overwrite:{name}"] = gates.input_overwrite(m, mod.CHECK_SIZE, ops, seed=seed)
    if any(n == "cuda" for n, _ in devs):
        if want("stream_sync"):
            out["stream_sync"] = gates.stream_sync(m, big, seed=seed)
        if want("nan_sentinel"):
            out["nan_sentinel"] = gates.nan_sentinel(m, mod, mod.CHECK_SIZE, seed=seed)
    return out


def planted_controls(devs, seed=None):
    """Each planted-bad kernel against its own gate, and against the old one-input bitwise check."""
    from kcore import planted
    seed = fresh_seed() if seed is None else seed
    rows = {}
    cuda = [ops for name, ops in devs if name == "cuda"]
    for gate, p in planted.all_planted().items():
        G = p.good
        kind = gate.split("_constant")[0]
        if kind == "stress":
            r = stress.run_profiles(p, devs, seed=seed)
            row = {"caught": any(v["pass"] is False for v in r.values()), "base_pass": r["base"]["pass"],
                   "failed_profiles": [k for k, v in r.items() if v["pass"] is False]}
        elif kind == "batch":
            r = stress.run_batch(p, devs, seed=seed)
            row = {"caught": r["pass"] is False}
        else:
            g = run_gates(G, devs, planted_mod=p, only=kind, seed=seed)
            hits = {k: v["caught"] for k, v in g.items()}
            row = {"caught": all(hits.values()) and bool(hits), "detail": g}
        inp = G.make_inputs(np.random.default_rng(seed + 9), G.CHECK_SIZE)
        want = run_device(G, inp, devs[0][1])
        try:
            old = _same(G, want, run_device(p, inp, cuda[0] if cuda else devs[0][1]))
        except Exception as e:  # a planted kernel may not run on every device
            old = f"error: {e!r}"
        row["old_bitwise_check_passes_it"] = old
        rows[gate] = {"planted": p.__name__, **row}
    return {"seed": seed, "rows": rows}
