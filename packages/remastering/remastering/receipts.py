# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Hashes and receipts. A receipt names the input hash, every model and binary hash, the settings and the
output hashes, so a rerun can be checked byte for byte."""
import hashlib
import json
import platform
import time
from pathlib import Path

import numpy as np

from . import VERSION


def sha256_file(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def sha256_array(a):
    """Hash of the array's float32 little-endian bytes, C order, with its shape folded in."""
    a = np.ascontiguousarray(np.asarray(a, dtype="<f4"))
    h = hashlib.sha256(repr(a.shape).encode())
    h.update(a.tobytes())
    return h.hexdigest()


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=_default)


def _default(o):
    if isinstance(o, (np.floating, np.integer)):
        return o.item()
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, Path):
        return str(o)
    raise TypeError(f"not serialisable: {type(o)}")


def make(stage, inputs, settings, outputs, models=None, extra=None):
    """One stage receipt. `inputs` and `outputs` map names to sha256 hex; `models` maps names to sha256."""
    rec = {"schema": "remastering.receipt/1", "stage": stage, "version": VERSION, "inputs": inputs,
           "models": models or {}, "settings": settings, "outputs": outputs,
           "host": {"python": platform.python_version(), "machine": platform.machine(), "numpy": np.__version__},
           "written_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    if extra:
        rec.update(extra)
    body = {k: v for k, v in rec.items() if k != "written_utc"}
    rec["receipt_sha256"] = hashlib.sha256(canonical(body).encode()).hexdigest()
    return rec


def verify(rec):
    body = {k: v for k, v in rec.items() if k not in ("written_utc", "receipt_sha256")}
    return hashlib.sha256(canonical(body).encode()).hexdigest() == rec.get("receipt_sha256")


def write(path, rec):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(rec, indent=1, sort_keys=True, default=_default), encoding="utf-8")
    return rec
