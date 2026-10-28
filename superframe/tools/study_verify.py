"""Check a superframe study.json without Node. Stdlib only; run with python -I.

    python -I tools/study_verify.py OUT/study.json [schemas/study.schema.json]

Checks: (1) the file is canonical JSON v2, byte for byte, using the decompose port of superstack's canonicaliser
(tools/canon.py); (2) receipt_sha256 is the canonical hash of every other field; (3) the record has the shape the
schema states (a JSON Schema subset: type, required, properties, items, enum, const, pattern, minimum, maximum,
minItems, maxItems, minProperties, additionalProperties false, $ref); (4) each plate PNG present beside the file
hashes to its png_sha256. Prints OK and exits 0, or prints each failure and exits 1.
"""
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # canon.py is vendored beside this file
from canon import canonical, canonical_sha256  # noqa: E402

TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None)}


def is_type(v, t):
    if t == "integer":
        return isinstance(v, int) and not isinstance(v, bool)
    if t == "number":
        return isinstance(v, (int, float)) and not isinstance(v, bool)
    return isinstance(v, TYPES[t])


def check(v, s, root, path, errs):
    if "$ref" in s:
        node = root
        for part in s["$ref"].lstrip("#/").split("/"):
            node = node[part]
        return check(v, node, root, path, errs)
    if "type" in s:
        ts = s["type"] if isinstance(s["type"], list) else [s["type"]]
        if not any(is_type(v, t) for t in ts):
            errs.append("%s: expected %s" % (path, "/".join(ts)))
            return None
    if "const" in s and v != s["const"]:
        errs.append("%s: expected %r" % (path, s["const"]))
    if "enum" in s and v not in s["enum"]:
        errs.append("%s: %r not in %r" % (path, v, s["enum"]))
    if isinstance(v, str) and "pattern" in s and not re.search(s["pattern"], v):
        errs.append("%s: does not match %s" % (path, s["pattern"]))
    if is_type(v, "number"):
        if "minimum" in s and v < s["minimum"]:
            errs.append("%s: below %s" % (path, s["minimum"]))
        if "maximum" in s and v > s["maximum"]:
            errs.append("%s: above %s" % (path, s["maximum"]))
    if isinstance(v, list):
        if len(v) < s.get("minItems", 0) or len(v) > s.get("maxItems", len(v)):
            errs.append("%s: %d items" % (path, len(v)))
        if "items" in s:
            for i, x in enumerate(v):
                check(x, s["items"], root, "%s[%d]" % (path, i), errs)
    if isinstance(v, dict):
        for k in s.get("required", []):
            if k not in v:
                errs.append("%s: missing %s" % (path, k))
        if len(v) < s.get("minProperties", 0):
            errs.append("%s: too few properties" % path)
        props = s.get("properties", {})
        if s.get("additionalProperties") is False:
            for k in v:
                if k not in props:
                    errs.append("%s: unexpected %s" % (path, k))
        for k, sub in props.items():
            if k in v:
                check(v[k], sub, root, "%s.%s" % (path, k), errs)
    return None


def verify(study_path, schema_path):
    errs = []
    with open(study_path, "rb") as fh:
        raw = fh.read()
    rec = json.loads(raw.decode("utf-8"))
    if canonical(rec).encode("utf-8") != raw:
        errs.append("file is not canonical JSON v2 (bytes differ after a round trip)")
    body = {k: v for k, v in rec.items() if k != "receipt_sha256"}
    if canonical_sha256(body) != rec.get("receipt_sha256"):
        errs.append("receipt_sha256 does not match the canonical hash of the record")
    with open(schema_path, encoding="utf-8") as fh:
        schema = json.load(fh)
    check(rec, schema, schema, "$", errs)
    base = os.path.dirname(os.path.abspath(study_path))
    for p in rec.get("plates", []):
        f = os.path.join(base, p.get("file", ""))
        if p.get("png_sha256") and os.path.exists(f):
            with open(f, "rb") as fh:
                if hashlib.sha256(fh.read()).hexdigest() != p["png_sha256"]:
                    errs.append("plate %s: PNG hash differs" % p["file"])
    return errs


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python -I tools/study_verify.py study.json [schema.json]")
        sys.exit(2)
    schema_file = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "schemas", "study.schema.json")
    problems = verify(sys.argv[1], schema_file)
    for e in problems:
        print("FAIL", e)
    if not problems:
        print("OK")
    sys.exit(1 if problems else 0)
