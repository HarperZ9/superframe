# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Receipts: a JSON record that names what went in, what came out and where.

Hashes follow canonical-record/1 (kcore/canonical.py). An array hashes as sha256 over the header
"cr1-array" 0x00 DTYPE 0x00 SHAPE 0x00 and its items in C order, little-endian, so the same values
in another dtype or shape hash differently on purpose. Any other JSON value hashes as sha256 of its
RFC 8785 text form. Each receipt records "canonical_form": "canonical-record/1".

Until 2026-10-31 arrays hashed over the header f"{dtype.str}|{shape}|" and values over
json.dumps(sort_keys=True). Those digests are not comparable with the ones written now.

A receipt is unsigned. It can be sealed later by any signer, because it holds only hashes and
labels. Receipts are run output: they go to $KERNELS_RECEIPTS, default packages/kernels/out/receipts
(gitignored).
"""
import datetime as dt
import hashlib
import os
from pathlib import Path

import numpy as np

from kcore import canonical

LIB_VERSION = "0.2.0"
CANONICAL_FORM = canonical.SPEC
RECEIPTS = Path(os.environ.get("KERNELS_RECEIPTS")
                or Path(__file__).resolve().parent.parent / "out" / "receipts")

# numpy dtype -> canonical-record/1 dtype name
_DTYPE = {"bool": "bool", "int8": "i8", "uint8": "u8", "int16": "i16", "uint16": "u16", "int32": "i32",
          "uint32": "u32", "int64": "i64", "uint64": "u64", "float32": "f32", "float64": "f64"}


def array_dtype(a):
    name = _DTYPE.get(np.dtype(a.dtype).name)
    if name is None:
        raise canonical.CanonicalError(f"dtype {a.dtype} has no canonical-record/1 name")
    return name


def array_bytes(a):
    """Header plus little-endian C-order items; the same bytes canonical.array_bytes builds."""
    a = np.asarray(a)
    name = array_dtype(a)
    if name.startswith("f") and a.size and not np.isfinite(a).all():
        raise canonical.CanonicalError("non-finite value in a float array")
    le = np.ascontiguousarray(a, dtype=a.dtype.newbyteorder("<"))
    return canonical.array_header(name, a.shape) + le.tobytes(order="C")


def array_hash(a):
    return hashlib.sha256(array_bytes(a)).hexdigest()


def _plain(v):
    """numpy scalars and tuples to plain JSON values; anything else is left for canonical.text."""
    if isinstance(v, np.generic):
        return v.item()
    if isinstance(v, (list, tuple)):
        return [_plain(x) for x in v]
    if isinstance(v, dict):
        return {k: _plain(x) for k, x in v.items()}
    return v


def value_hash(v):
    if isinstance(v, np.ndarray):
        return array_hash(v)
    return canonical.sha256(_plain(v))


def make(kernel, version, mode, device, inputs, outputs, extra=None):
    rec = {
        "kind": "kernel-receipt",
        "canonical_form": CANONICAL_FORM,
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


def append(rec, name="receipts.jsonl", directory=None):
    """One receipt per line, written in its canonical text form."""
    d = Path(directory) if directory else RECEIPTS
    d.mkdir(parents=True, exist_ok=True)
    with open(d / name, "a", encoding="utf-8") as f:
        f.write(canonical.text(_plain(rec)) + "\n")


def record_hash(rec):
    """sha256 of a whole receipt in canonical form, for a signer or a ledger."""
    return canonical.sha256(_plain(rec))

