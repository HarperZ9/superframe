# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Receipts: a JSON record that names what went in, what came out and where.

Each array is hashed as sha256 over a header (dtype, shape) and its C-order
little-endian bytes, so the same values in another layout hash differently on
purpose. A receipt is unsigned. It can be sealed later by any signer, because
it holds only hashes and labels.
"""
import datetime as dt
import hashlib
import json
from pathlib import Path

import numpy as np

LIB_VERSION = "0.1.0"
RECEIPTS = Path(__file__).resolve().parent.parent / "receipts"


def array_hash(a):
    a = np.ascontiguousarray(np.asarray(a))
    if a.dtype.byteorder == ">":
        a = a.astype(a.dtype.newbyteorder("<"))
    h = hashlib.sha256(f"{a.dtype.str}|{a.shape}|".encode())
    h.update(a.tobytes())
    return h.hexdigest()


def value_hash(v):
    if isinstance(v, np.ndarray):
        return array_hash(v)
    return hashlib.sha256(json.dumps(v, sort_keys=True).encode()).hexdigest()


def make(kernel, version, mode, device, inputs, outputs, extra=None):
    rec = {
        "kind": "kernel-receipt",
        "library_version": LIB_VERSION,
        "kernel": kernel,
        "kernel_version": version,
        "mode": mode,
        "device": device,
        "time": dt.datetime.now().isoformat(timespec="seconds"),
        "inputs": {k: value_hash(v) for k, v in sorted(inputs.items())},
        "outputs": {k: array_hash(v) for k, v in sorted(outputs.items())},
        "sealed": False,
    }
    if extra:
        rec.update(extra)
    return rec


def append(rec, name="receipts.jsonl"):
    RECEIPTS.mkdir(exist_ok=True)
    with open(RECEIPTS / name, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, sort_keys=True) + "\n")
