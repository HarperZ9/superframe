# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Planted-bad kernels: one per gate, each a plausible shortcut a performance-minded port of
`blend` might take. They are the false-success control for kcore/stress.py and kcore/gates.py:
every gate must catch its planted kernel and must pass the four real kernels.

Never import these into a pipeline. Each is wrong on purpose.
"""
import types

import numpy as np

import blend.kernel as B
import spectral_shade.kernel as S

F32 = np.float32


def _like(name, run=None, prepare=None, base=B, **extra):
    mod = types.SimpleNamespace(**{k: getattr(base, k) for k in dir(base) if not k.startswith("__")})
    mod.NAME, mod.good, mod.__name__ = base.NAME, base, f"planted.{name}"
    if run:
        mod.run = run
    if prepare:
        mod.prepare = prepare
    mod.__dict__.update(extra)
    return mod


def _clamp_prepare(inp, ops):
    """Fast path tuned on randn draws: clamp the samples to +-8 (never hit by a standard normal)."""
    x = np.clip(inp["x"], -8, 8).astype(F32)
    return B.prepare({**inp, "x": x}, ops)


def _size_dependent_run(d, ops):
    """Above 32 output columns, sum the sources in reverse order (a size-picked algorithm)."""
    if d["t"].shape[0] <= 32:
        return B.run(d, ops)
    n = d["x"].shape[0]
    rev = {**d, "x": d["x"][list(range(n - 1, -1, -1))], "w": d["w"][list(range(n - 1, -1, -1))],
           "ratio": d["ratio"][list(range(n - 1, -1, -1))]}
    return B.run(rev, ops)


def _side_stream_run(d, ops):
    """Launch the real work on a side stream and return before it finishes."""
    import torch
    s = torch.cuda.Stream()
    s.wait_stream(torch.cuda.current_stream())
    with torch.cuda.stream(s):
        return B.run(d, ops)


def _lazy_run(d, ops):
    """No-op: allocate the output and never write it."""
    import torch
    c, t = d["x"].shape[1], d["t"].shape[0]
    return {"y": torch.empty((c, t), dtype=torch.float32, device=d["x"].device)}


_MEMO = {}


def _memo_run(d, ops):
    """Memoise on the input buffer's address: the same buffers give the cached answer."""
    key = d["x"].data_ptr() if hasattr(d["x"], "data_ptr") else d["x"].__array_interface__["data"][0]
    if key not in _MEMO:
        _MEMO[key] = B.run(d, ops)
    return _MEMO[key]


def _half_run(d, ops):
    """Precision downgrade: samples and weights carried in float16 (CPU) or bfloat16 (CUDA)."""
    if ops.name == "cuda":
        import torch
        lo = torch.bfloat16
        d2 = {**d, "x": d["x"].to(lo).to(torch.float32), "w": d["w"].to(lo).to(torch.float32)}
    else:
        d2 = {**d, "x": d["x"].astype(np.float16).astype(F32), "w": d["w"].astype(np.float16).astype(F32)}
    return B.run(d2, ops)


def _library_run(d, ops):
    """Hand the reduction to the library: einsum over sources after the detuned read."""
    import torch
    y = B.run(d, ops)["y"]
    return {"y": torch.einsum("c,ct->ct", torch.ones_like(y[:, 0]), y) if ops.name == "cuda"
            else np.einsum("c,ct->ct", np.ones_like(y[:, 0]), y)}


def _constant_swap_run(d, ops):
    """One swapped constant, after Sarkar (arXiv 2607.02541): the lower clamp on the mix weight
    goes from 0.0 to -inf. Every honest input lies in [0, 1], so a randn-style check never sees it."""
    lo = ops.scalar(float("-inf"), np.float32)
    return S.run({**d, "wmix": ops.maximum(d["wmix"], lo)}, _NoLowerClamp(ops))


class _NoLowerClamp:
    """Ops proxy whose first maximum() (the wmix clamp in spectral_shade.run) keeps -inf as floor."""
    def __init__(self, ops):
        self._ops, self._first = ops, True

    def __getattr__(self, k):
        return getattr(self._ops, k)

    def maximum(self, a, b):
        if self._first:
            self._first = False
            return a
        return self._ops.maximum(a, b)


def all_planted():
    """{gate: planted module}. Each name says which gate must catch it."""
    _MEMO.clear()
    return {
        "stress": _like("clamp_fast_path", prepare=_clamp_prepare),
        "stress_constant_swap": _like("constant_swap", run=_constant_swap_run, base=S),
        "batch": _like("size_dependent_order", run=_size_dependent_run),
        "stream_sync": _like("side_stream", run=_side_stream_run),
        "nan_sentinel": _like("lazy_output", run=_lazy_run),
        "input_overwrite": _like("memoised", run=_memo_run),
        "fp64_ulp": _like("half_precision", run=_half_run),
        "static_ban": _like("library_reduction", run=_library_run),
    }
