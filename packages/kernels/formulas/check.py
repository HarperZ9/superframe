# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Check every formula kernel: known answers, properties, refusals, planted-bad controls, and bit equality
between the reference and the compiled BuildLang body.

    python -B -m formulas.check            (from packages/kernels)
    python -B kernels.py formulas          (the same, and it records the result in kernels.json)
"""
import sys

from . import modules, native
from .core import same


def run_checks(mod, fn):
    """[(name, passed)] for one implementation. A check that raises counts as failed."""
    rows = []
    try:
        for name, ok in mod.checks(fn):
            rows.append((name, bool(ok)))
    except Exception as e:  # a planted fault may break the call shape; that is a caught fault, with its reason
        rows.append((f"checks raised {type(e).__name__}: {e}", False))
    return rows


def check_kernel(mod, require_native=False):
    spec = mod.SPEC
    res = {"id": spec["id"], "row": spec["row"], "mode": spec["mode"]}
    ref_rows = run_checks(mod, mod.reference)
    res["reference"] = {"checks": len(ref_rows), "failed": [n for n, ok in ref_rows if not ok]}
    res["controls"] = {}
    for name, planted in mod.PLANTED.items():
        failed = [n for n, ok in run_checks(mod, planted) if not ok]
        res["controls"][name] = {"caught": bool(failed), "caught_by": failed[:1]}
    why = spec.get("bld_pending") or native.unavailable()
    if why:
        res["buildlang"] = {"checked": False, "why": why}
        native_ok = not require_native or bool(spec.get("bld_pending"))
    else:
        fn = native.function(mod)
        rows = run_checks(mod, fn)
        differ = [g for g in mod.GRID if not same(mod.reference(**g), fn(**g))]
        res["buildlang"] = {"checked": True, "checks": len(rows), "failed": [n for n, ok in rows if not ok],
                            "grid": len(mod.GRID), "differ_from_reference": len(differ),
                            "first_difference": differ[:1]}
        native_ok = not res["buildlang"]["failed"] and not differ
    res["pass"] = (not res["reference"]["failed"] and native_ok
                   and all(c["caught"] for c in res["controls"].values()))
    return res


def check_all(require_native=False):
    return [check_kernel(m, require_native) for m in modules()]


REGISTRY_FIELDS = ("row", "formula", "mode", "loss", "known_answers", "properties", "controls", "provenance")


def registry_entry(mod):
    """The kernels.json entry for one kernel, from its spec. The last check result is added by the runner."""
    s = mod.SPEC
    entry = {"id": s["id"], "path": f"formulas/{mod.__name__.split('.')[-2]}/",
             "inputs": [{"name": n, "unit": u, "range": r} for n, u, r in s["inputs"]],
             "outputs": [{"name": n, "unit": u} for n, u in s["outputs"]]}
    entry.update({k: s[k] for k in REGISTRY_FIELDS})
    for k in ("array_inputs", "array_outputs"):
        if k in s:
            entry[k] = s[k]
    entry["buildlang"] = {"body": "pending", "missing": s["bld_pending"]} if s.get("bld_pending") \
        else {"body": "kernel.bld"}
    return entry


def registry_entries():
    return [registry_entry(m) for m in modules()]


def main(require_native=False):
    ok = True
    for r in check_all(require_native):
        ok &= r["pass"]
        b = r["buildlang"]
        bl = (f"BuildLang equal on {b['grid']} grid points" if b["checked"] and not b["differ_from_reference"]
              else f"BuildLang DIFFERS on {b['differ_from_reference']}" if b["checked"]
              else f"BuildLang not checked ({b['why']})")
        print(f"{r['id']:28s} {'PASS' if r['pass'] else 'FAIL'}  reference {r['reference']['checks']} checks, {bl}")
        for n in r["reference"]["failed"] + (b.get("failed") or []):
            print(f"    FAILED {n}")
        for name, c in r["controls"].items():
            print(f"    control: {name}: caught = {c['caught']}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(require_native="--require-native" in sys.argv))
