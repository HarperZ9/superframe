"""Canonical JSON v2 and the receipt seal, ported from the vendored superstack v0.2.0
(substrate/lib/vendor/superstack.mjs), so a descriptor receipt hashes the same way as a
substrate asset receipt. Rules: object keys sorted by code point, no whitespace, numbers in positional
form with no exponent and no trailing zeros, strings with the JSON short escapes and \\u00XX below 0x20.
Vendored from the decompose package, where a node test checks this port against the JS original byte
for byte; tools/study_verify.py uses it here."""
import hashlib
import json
import math
import re

_NUM = re.compile(r"^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$")
_ESC = {'"': '\\"', "\\": "\\\\", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t"}
MAX_SAFE = 2**53 - 1


def _positional(sign, int_part, frac, exp):
    digits = int_part + frac
    point = len(int_part) + exp
    stripped = digits.lstrip("0")
    point -= len(digits) - len(stripped)
    digits = stripped.rstrip("0")
    if not digits:
        return "0"
    if point <= 0:
        body = "0." + "0" * (-point) + digits
    elif point >= len(digits):
        body = digits + "0" * (point - len(digits))
    else:
        body = digits[:point] + "." + digits[point:]
    return sign + body


def canonical_number(x):
    if isinstance(x, bool):
        raise TypeError("bool is not a number here")
    if isinstance(x, int):
        if abs(x) > MAX_SAFE:
            raise ValueError("integer outside the safe range")
        return str(x)
    if not math.isfinite(x):
        raise ValueError("non-finite number")
    if x == 0:
        return "0"
    # repr gives the shortest round-trip digits, as JS String(x) does; only the layout differs.
    m = _NUM.match(repr(float(x)).replace("e+", "e"))
    return _positional(m.group(1), m.group(2), m.group(3) or "", int(m.group(4) or 0))


def canonical_string(s):
    out = ['"']
    for ch in s:
        c = ord(ch)
        if 0xD800 <= c <= 0xDFFF:
            raise ValueError("lone surrogate")
        if ch in _ESC:
            out.append(_ESC[ch])
        elif c < 0x20:
            out.append("\\u%04x" % c)
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def _key(k):
    # JS sorts by UTF-16 code units; for the BMP that equals code point order.
    return [ord(c) for c in k]


def canonical(v):
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, (int, float)):
        return canonical_number(v)
    if isinstance(v, str):
        return canonical_string(v)
    if isinstance(v, (list, tuple)):
        return "[" + ",".join(canonical(x) for x in v) + "]"
    if isinstance(v, dict):
        keys = sorted(v.keys(), key=_key)
        return "{" + ",".join(canonical_string(k) + ":" + canonical(v[k]) for k in keys) + "}"
    raise TypeError("cannot canonicalize %s" % type(v).__name__)


def canonical_sha256(v):
    return hashlib.sha256(canonical(v).encode("utf-8")).hexdigest()


def seal(body):
    """The superstack seal: receipt_sha256 is the canonical hash of every other field."""
    body = {k: v for k, v in body.items() if k != "receipt_sha256"}
    return {**body, "receipt_sha256": canonical_sha256(body)}


def verify_seal(rec):
    body = {k: v for k, v in rec.items() if k != "receipt_sha256"}
    return canonical_sha256(body) == rec.get("receipt_sha256")


def plain(v):
    """Round floats and turn numpy scalars and arrays into plain JSON values, so seals are stable."""
    if isinstance(v, dict):
        return {str(k): plain(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [plain(x) for x in v]
    if hasattr(v, "tolist"):
        return plain(v.tolist())
    if isinstance(v, bool) or v is None or isinstance(v, str):
        return v
    if isinstance(v, int):
        return int(v)
    if isinstance(v, float):
        if not math.isfinite(v):
            return None
        r = round(v, 6)
        return 0 if r == 0 else r
    return json.loads(json.dumps(v))
