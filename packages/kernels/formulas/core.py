# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Shared parts of a formula kernel: the refusal, the range tests and the unit-checked call.

A formula kernel never returns a default, a NaN or a clipped value in place of an answer. Outside its stated
range it returns a Refusal that names the input, the value and the range.
"""
import math
import struct
from dataclasses import dataclass


@dataclass(frozen=True)
class Refusal:
    """Why a kernel gave no answer: which input, the value it had, and the range the kernel accepts."""
    input: str
    value: object
    range: str

    def __str__(self):
        return f"refused: {self.input} = {self.value!r} is outside {self.range}"


def finite(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def positive(x):
    return finite(x) and x > 0.0


def refused(result):
    return isinstance(result, Refusal)


def flat(values):
    """A result tuple with each array output (a tuple) spread in place, in output order."""
    out = []
    for v in values:
        out.extend(v) if isinstance(v, tuple) else out.append(v)
    return out


def finite_array(x, minimum=1):
    """A list or tuple of at least `minimum` finite numbers."""
    return isinstance(x, (list, tuple)) and len(x) >= minimum and all(finite(v) for v in x)


def bits(values):
    """The bytes of a result tuple, so two implementations can be compared bit for bit. Array outputs are
    tuples inside the result; their lengths are part of the bytes."""
    shape = [len(v) if isinstance(v, tuple) else -1 for v in values]
    f = flat(values)
    return struct.pack(f"<{len(shape)}q{len(f)}d", *shape, *f)


def same(a, b):
    """Equal results: the same refusal (by input name), or the same bytes."""
    if refused(a) or refused(b):
        return refused(a) and refused(b) and a.input == b.input
    return bits(a) == bits(b)


def call(spec, fn, quantities):
    """Call `fn` with (value, unit) pairs, checked against the units the spec declares.

    Returns {output name: (value, unit)}, or a Refusal for a missing input, a wrong unit or a value
    outside the kernel's range.
    """
    values = {}
    for name, unit, rng in spec["inputs"]:
        if name not in quantities or quantities[name] is None:
            return Refusal(name, None, f"required, {rng}, in {unit}")
        q = quantities[name]
        if not (isinstance(q, tuple) and len(q) == 2):
            return Refusal(name, q, f"a (value, unit) pair in {unit}")
        if q[1] != unit:
            return Refusal(name, q[1], f"unit {unit}")
        values[name] = q[0]
    extra = set(quantities) - set(values)
    if extra:
        return Refusal(sorted(extra)[0], quantities[sorted(extra)[0]], "an input this kernel declares")
    result = fn(**values)
    if refused(result):
        return result
    return {name: (v, unit) for (name, unit), v in zip(spec["outputs"], result)}
