# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Benchmark harness: throughput, joules per result, roofline percent, the open built-in
on the same machine, and the speed and energy optima across sizes.

Energy comes from packages/joules. GPU: the NVML total-energy counter's difference across each timed
window (joules/nvml.py, since 2026-10-30); the 1 Hz nvidia-smi integral is kept beside it. CPU: the
running logger's RAPL CSV integrated over the window (trapezoid rule, about 1 sample per second). The meter sees the whole machine
(CPU package plus GPU board), so any other job running inside the window lands in these
joules. Every result written while the machine carries other work is labelled
"under load, not valid". GPU timings exclude host-device copies; CPU timings include
the thread split and join. Nothing here changes a clock, power limit or system setting.
"""
import datetime as dt
import os
import sys
import time
from pathlib import Path

import numpy as np

from kcore import hw
from kcore.ops import NumpyOps, TorchOps, cuda_available
from kcore.run import run_device

JOULES_DIR = Path(__file__).resolve().parents[2] / "joules"
# the running logger's CSV: $JOULES_POWER_CSV, else the joules package default (its gitignored out/)
POWER_CSV = Path(os.environ.get("JOULES_POWER_CSV") or JOULES_DIR / "out" / "power.csv")
LABEL_LOADED = "under load, not valid"


def _joules_total(start, end, csv_path):
    sys.dont_write_bytecode = True
    if str(JOULES_DIR) not in sys.path:
        sys.path.insert(0, str(JOULES_DIR))
    import joules
    if not Path(csv_path).exists():
        return None
    return joules.total(str(csv_path), start, end)


def _nvml():
    if str(JOULES_DIR) not in sys.path:
        sys.path.insert(0, str(JOULES_DIR))
    import nvml
    return nvml


def _time_calls(fn, sync, window_s, min_calls=3, energy=None):
    """energy, when given, is a dict that receives the NVML counter's GPU joules for the window."""
    fn()
    fn()
    sync()
    n = 0
    t_start = dt.datetime.now()
    e0 = _nvml().total_energy_mj()
    t0 = time.perf_counter()
    while n < min_calls or time.perf_counter() - t0 < window_s:
        fn()
        n += 1
    sync()
    secs = time.perf_counter() - t0
    e1 = _nvml().total_energy_mj()
    if energy is not None:
        energy["gpu_J_nvml"] = None if e0 is None or e1 is None else (e1 - e0) / 1000.0
    return n, secs, t_start, dt.datetime.now()


def _ops_for(device, mod, threads):
    if device == "cuda":
        return TorchOps()
    return NumpyOps(threads if getattr(mod, "SPLIT", None) else 1)


def bench_kernel(mod, devices, window_s, threads, rng):
    rows = []
    for size in mod.SMOKE_SIZES:
        inp = mod.make_inputs(rng, size)
        nbytes, flops = mod.work(inp)
        bits = 64 if any(v.dtype == np.float64 for v in inp.values() if v.ndim > 1) else 32
        for device in devices:
            ops = _ops_for(device, mod, threads)
            if device == "cuda":
                d = mod.prepare(inp, ops)
                fn = lambda: mod.run(d, ops)  # noqa: E731
            else:
                fn = lambda: run_device(mod, inp, ops)  # noqa: E731
            en = {}
            n, secs, t0, t1 = _time_calls(fn, ops.sync, window_s, energy=en)
            per = secs / n
            pct, bound, grades = hw.roofline_pct(device, bits, nbytes, flops, per)
            rows.append({"kernel": mod.NAME, "impl": "kernel", "device": device, "threads": ops.threads,
                         "size": size, "calls": n, "s_per_call": per,
                         "results_per_s": mod.results(inp) / per, "results_per_call": mod.results(inp),
                         "roofline_pct": pct, "bound": bound, "spec_grades": grades, "fp_bits": bits, **en,
                         "window": (t0.isoformat(timespec="seconds"), t1.isoformat(timespec="seconds"))})
            if getattr(mod, "open_reference", None) is not None:
                d = mod.prepare(inp, ops)
                fn = lambda: mod.open_reference(d, ops)  # noqa: E731
                n, secs, t0, t1 = _time_calls(fn, ops.sync, window_s)
                per = secs / n
                rows.append({"kernel": mod.NAME, "impl": "open built-in", "device": device,
                             "threads": "library default", "size": size, "calls": n, "s_per_call": per,
                             "results_per_s": mod.open_results(inp) / per,
                             "results_per_call": mod.open_results(inp), "fp_bits": bits,
                             "window": (t0.isoformat(timespec="seconds"), t1.isoformat(timespec="seconds"))})
    return rows


def attach_joules(rows, csv_path=POWER_CSV, settle_s=2.5):
    """Integrate the power log over each window once the logger has caught up."""
    time.sleep(settle_s)
    for r in rows:
        j = _joules_total(*r["window"], csv_path)
        if not j:
            r["joules"] = None
            continue
        gpu = r.get("gpu_J_nvml")
        src = "nvml total-energy counter"
        if gpu is None:
            gpu, src = j["gpu_w"], "nvidia-smi 1 Hz samples, integrated"
        total = j["cpu_pkg_w"] + gpu
        r["joules"] = {"cpu_pkg_J": j["cpu_pkg_w"], "gpu_J": gpu, "gpu_source": src,
                       "gpu_J_smi_1hz": j["gpu_w"], "machine_J": total}
        r["J_per_result"] = total / (r["calls"] * r["results_per_call"]) if total > 0 else None
        r["label"] = LABEL_LOADED
    return rows


def pareto(rows):
    """Per kernel and device: the fastest point, the least-energy point, and the
    non-dominated set over (results/s up, J/result down)."""
    out = {}
    for r in rows:
        if r["impl"] != "kernel" or not r.get("J_per_result"):
            continue
        out.setdefault((r["kernel"], r["device"]), []).append(r)
    table = []
    for (k, dev), pts in out.items():
        front = [p for p in pts if not any(
            q["results_per_s"] >= p["results_per_s"] and q["J_per_result"] <= p["J_per_result"]
            and (q["results_per_s"] > p["results_per_s"] or q["J_per_result"] < p["J_per_result"])
            for q in pts)]
        fast = max(pts, key=lambda p: p["results_per_s"])
        lean = min(pts, key=lambda p: p["J_per_result"])
        table.append({"kernel": k, "device": dev, "fastest_size": fast["size"], "least_energy_size": lean["size"],
                      "optima_agree": fast is lean, "front": [p["size"] for p in front],
                      "label": LABEL_LOADED})
    return table


def run_all(mods, window_s=3.0, threads=8, seed=7):
    rng = np.random.default_rng(seed)
    devices = ["cpu"] + (["cuda"] if cuda_available() else [])
    rows = []
    for mod in mods:
        rows += bench_kernel(mod, devices, window_s, threads, rng)
    attach_joules(rows)
    return {"label": LABEL_LOADED, "window_s": window_s, "rows": rows, "pareto": pareto(rows)}
