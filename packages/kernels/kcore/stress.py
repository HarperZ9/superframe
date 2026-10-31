# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Stressed input profiles and the batch-composition test.

Source: ForgeKernel's correctness monitor (corpus entry openbmb-forgekernel, docs-correctness-
monitor.md) reruns a kernel's own judge under input profiles: other seeds, x4 and x1/16 scale,
0.1 % spikes at +-12, zero blocks, constant rows, integer edges and a repeat run. It judges with
each tree's own tolerance and changes only normal draws.

Here every profile is judged by the bit-identical contract (equal bytes to the scalar reference on
CPU, threaded CPU and CUDA), the non-finite census must match the reference, and the profiles
reach every float data input a kernel takes, uniform draws included, because the kernels clamp
or accept the whole range. A profile that would make an input illegal is "not applicable".

Batch composition: one row computed alone, inside a batch of 7 and inside a batch of 64 (at a
different offset each time) must give the same bytes on every device.
"""
import math

import numpy as np

from kcore.run import bitwise_equal, run_device

# float data inputs per kernel, the input whose rows the row profiles act on, the integer edge rule
KEYS = {
    "blend": {"float": ["x", "w"], "rows": ["x"], "int": "blend_t"},
    "advect_diffuse": {"float": ["q", "u", "v"], "rows": ["q", "u", "v"], "int": "advect_count"},
    "lattice_resample": {"float": ["img"], "rows": ["img"], "int": None},
    "spectral_shade": {"float": ["wmix", "cosi"], "rows": [], "int": "spectral_edges"},
}
# batch axis per kernel: inputs cut along these axes, outputs read along these
BATCH = {
    "blend": ({"t": 0}, {"y": 1}, {"T": 64}),
    "spectral_shade": ({"wmix": 0, "cosi": 0}, {"xyz": 0}, {"P": 64}),
    "lattice_resample": ({"img": 0}, {"samples": 0, "recon": 0}, {"C": 64, "H": 14, "W": 18}),
    "advect_diffuse": None,  # one 2-D field per call: the kernel has no batch axis
}
PROFILES = ["base", "repeat", "seed1", "seed2", "amp", "tiny", "spikes", "zero_block",
            "const_rows", "int_edges"]


def _rows_view(a):
    return a.reshape(-1, a.shape[-1]) if a.ndim >= 2 else a.reshape(1, -1)


def _int_edges(rule, inp):
    if rule == "blend_t":
        t = inp["t"].copy()
        k = max(1, len(t) // 16)
        t[:k], t[k:2 * k] = 0.0, float(len(t) - 1)
        return {"t": t}
    if rule == "advect_count":  # a count of zero: no diffusion substeps
        par = inp["par"].copy()
        par[3], par[4] = 0.0, 0.0
        return {"par": par}
    if rule == "spectral_edges":  # both ends of the clamped range
        out = {}
        for key in ("wmix", "cosi"):
            a = inp[key].copy()
            k = max(1, len(a) // 16)
            a[:k], a[k:2 * k] = 0.0, 1.0
            out[key] = a
        return out
    return None


def apply(profile, mod, inp, rng):
    """Return (new inputs, changed keys) or (None, why) when the profile does not apply."""
    keys = KEYS[mod.NAME]
    new = {k: (v.copy() if isinstance(v, np.ndarray) else v) for k, v in inp.items()}
    if profile in ("base", "repeat", "seed1", "seed2"):
        return new, []
    if profile in ("amp", "tiny"):
        f = 4.0 if profile == "amp" else 1.0 / 16.0  # powers of two: the scaling itself is exact
        for k in keys["float"]:
            new[k] = (new[k] * new[k].dtype.type(f)).astype(new[k].dtype)
        return new, keys["float"]
    if profile == "spikes":
        for k in keys["float"]:
            flat = new[k].reshape(-1)
            # at least one spike of each sign (S1c: one random-sign spike on a 24-pixel input missed a
            # swapped lower clamp half the time)
            idx = rng.choice(flat.size, max(2, round(0.001 * flat.size)), replace=False)
            flat[idx] = np.resize([-12.0, 12.0], idx.size)[rng.permutation(idx.size)]
        return new, keys["float"]
    if profile == "zero_block":
        for k in keys["float"]:
            a = new[k]
            a[..., :max(1, math.ceil(a.shape[-1] / 8))] = 0
            if a.ndim >= 2:
                _rows_view(a)[:max(1, math.ceil(_rows_view(a).shape[0] / 16))] = 0
        return new, keys["float"]
    if profile == "const_rows":
        if not keys["rows"]:
            return None, "no rank-2 float input"
        for k in keys["rows"]:
            r = _rows_view(new[k])
            r[:max(2, math.ceil(r.shape[0] / 16))] = r[0]
        return new, keys["rows"]
    if profile == "int_edges":
        ch = _int_edges(keys["int"], new)
        if ch is None:
            return None, "no integer or count input"
        new.update(ch)
        return new, sorted(ch)
    raise KeyError(profile)


def _census(out):
    return {k: [int(np.isnan(v).sum()), int(np.isinf(v).sum())] for k, v in out.items()}


def _equal(a, b):
    return all(bitwise_equal(a[k], b[k]) for k in a)


def run_profiles(mod, devs, seed=20261030):
    """{profile: {applicable, pass, changed, census, devices: {name: equal}}} on every test size."""
    sizes = getattr(mod, "TEST_SIZES", [mod.TEST_SIZE])
    res = {}
    for prof in PROFILES:
        rng = np.random.default_rng(seed + {"seed1": 1, "seed2": 2}.get(prof, 0))
        row = {"applicable": True, "pass": True, "changed": [], "devices": {}}
        for size in sizes:
            inp, changed = apply(prof, mod, mod.make_inputs(rng, size), rng)
            if inp is None:
                row.update(applicable=False, why=changed)
                break
            row["changed"] = changed
            ref = mod.reference(inp)
            row["census"] = _census(ref)
            for name, ops in devs:
                out = run_device(mod, inp, ops)
                ok = _equal(ref, out) and _census(out) == _census(ref)
                if prof == "repeat":
                    ok = ok and _equal(out, run_device(mod, inp, ops))
                row["devices"][name] = row["devices"].get(name, True) and ok
                row["pass"] = row["pass"] and ok
        if not row["applicable"]:
            row["pass"] = None
        res[prof] = row
    return res


def _cut(inp, axes, idx):
    out = dict(inp)
    for k, ax in axes.items():
        out[k] = np.take(inp[k], idx, axis=ax)
    return out


def run_batch(mod, devs, sizes=(1, 7, 64), seed=20261031):
    """Every row of a 64-row set, computed alone, inside 7-row batches and inside the full batch,
    must give the same bytes on every device. (S1 compared one row only and missed the planted
    size-dependent kernel; one row is one rounding draw.)"""
    spec = BATCH.get(mod.NAME)
    if spec is None:
        return {"applicable": False, "why": "kernel has no batch axis", "pass": None}
    in_axes, out_axes, size = spec
    rng = np.random.default_rng(seed)
    full = mod.make_inputs(rng, {**mod.TEST_SIZE, **size})
    n = full[next(iter(in_axes))].shape[next(iter(in_axes.values()))]
    perm = rng.permutation(n).astype(np.int64)
    rows, bad = {}, 0
    for name, ops in devs:
        per_b = {}
        for b in sizes:
            got = {}
            for lo in range(0, n, b):
                idx = perm[lo:lo + b]
                out = run_device(mod, _cut(full, in_axes, idx), ops)
                for j, r in enumerate(idx):
                    got[int(r)] = {k: np.take(out[k], [j], axis=ax) for k, ax in out_axes.items()}
            per_b[b] = got
        ref = per_b[sizes[0]]
        for b in sizes:
            diff = sum(not _equal(ref[r], per_b[b][r]) for r in ref)
            rows[f"b{b}:{name}"] = diff == 0
            bad += diff
        if name != devs[0][0]:
            rows[f"b1:{devs[0][0]}~{name}"] = all(_equal(first[r], ref[r]) for r in ref)
        else:
            first = ref
    return {"applicable": True, "pass": all(rows.values()), "rows": rows, "rows_differing": bad,
            "batch_sizes": list(sizes)}
