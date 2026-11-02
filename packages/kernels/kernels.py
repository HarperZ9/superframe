# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""kernels: a growing library of compute kernels, each built to one contract.

  kernels check              every equivalence test, stress profile, batch test and reward-hack gate,
                             plus a planted-bad kernel per gate; update kernels.json; exit 1 on failure
  kernels bench [--window S] smoke benchmark (labelled "under load, not valid" on a loaded machine)
  kernels pipeline           composed blend > resample > shade on every device placement
  kernels list               show the registry
"""
import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import advect_diffuse.kernel as K_ad  # noqa: E402
import blend.kernel as K_bl  # noqa: E402
import lattice_resample.kernel as K_lr  # noqa: E402
import spectral_shade.kernel as K_ss  # noqa: E402

MODULES = [K_bl, K_ad, K_lr, K_ss]
REGISTRY = ROOT / "kernels.json"


def _registry():
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


def _save(reg):
    REGISTRY.write_text(json.dumps(reg, indent=2) + "\n", encoding="utf-8")


def cmd_check(a):
    from kcore.check import check_kernel
    reg = _registry()
    ok_all = True
    report = []
    for mod in MODULES:
        res = check_kernel(mod, threads=a.threads, seed=a.seed, write_receipts=not a.no_receipts)
        report.append(res)
        ok_all &= res["pass"]
        entry = next(e for e in reg["kernels"] if e["name"] == mod.NAME)
        entry["contract"]["equivalence"] = {
            "pass": res["pass"], "checked": dt.datetime.now().isoformat(timespec="seconds"),
            "vs_reference": res["vs_reference"], "cross_device": res["cross_device"],
            "known_answers": res["known_answers"], "controls": res["controls"],
            "check_size": res["check_size"], "output_hash": res["output_hash"], "seed": res["seed"]}
        print(f"{mod.NAME:18s} {mod.MODE:13s} {'PASS' if res['pass'] else 'FAIL'}   seed {res['seed']}")
        for dev, v in res["vs_reference"].items():
            print(f"    vs reference  {dev:14s} {'equal' if v['pass'] else 'DIFFER'}  max ulp {v['max_ulp']}")
        for pair, v in res["cross_device"].items():
            print(f"    cross-device  {pair:22s} {'equal' if v['pass'] else 'DIFFER'}  max ulp {v['max_ulp']}")
        for k in res["known_answers"]:
            print(f"    known answer  {'ok ' if k['pass'] else 'BAD'} {k['name']}")
        print(f"    control: 1-ulp perturbation caught = {res['controls']['one_ulp_perturbation_detected']}")
        print(f"    open built-in max ulp vs kernel: {res['controls']['open_builtin_max_ulp']}")
        for v in res["controls"]["drift_variants"]:
            print(f"    control: {v['name']} caught = {v['caught']} ({100 * v['fraction_differing']:.1f} % of outputs differ)")
        _print_stress(res)
        entry["contract"]["equivalence"]["stress"] = {k: v["pass"] for k, v in res["stress"].items()}
        entry["contract"]["equivalence"]["batch"] = res["batch"]["pass"]
        entry["contract"]["equivalence"]["gates"] = {k: not v["caught"] for k, v in res["gates"].items()}
    if not a.no_planted:
        from kcore.check import _devices, planted_controls
        pcr = planted_controls(_devices(a.threads), seed=a.seed)
        pc = pcr["rows"]
        print(f"planted controls, seed {pcr['seed']}")
        for gate, row in pc.items():
            print(f"planted {gate:16s} {row['planted']:30s} caught = {row['caught']}"
                  f"   old one-input bitwise check passes it = {row['old_bitwise_check_passes_it']}")
            ok_all &= row["caught"]
        reg["planted_controls"] = {"checked": dt.datetime.now().isoformat(timespec="seconds"), "seed": pcr["seed"],
                                   **{g: {"planted": r["planted"], "caught": r["caught"]} for g, r in pc.items()}}
        report.append({"planted_controls": pc})
    _save(reg)
    if a.json:
        Path(a.json).write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    return 0 if ok_all else 1


def _print_stress(res):
    s = res["stress"]
    bad = [k for k, v in s.items() if v["pass"] is False]
    na = [k for k, v in s.items() if v["pass"] is None]
    print(f"    stress profiles: {sum(v['pass'] is True for v in s.values())} of {len(s)} equal bytes"
          + (f", FAILED {bad}" if bad else "") + (f", not applicable {na}" if na else ""))
    b = res["batch"]
    print(f"    batch 1/7/64 same bytes: {b['pass'] if b['applicable'] else 'not applicable (' + b['why'] + ')'}")
    for g, v in res["gates"].items():
        extra = {"stream_sync": lambda v: f" residual {v['residual_fraction']:.4f}",
                 "fp64_ulp": lambda v: f" normwise {v['normwise']:.2e}" if v.get("applicable") else " n/a"}
        print(f"    gate {g:24s} {'CAUGHT' if v['caught'] else 'clean'}" + extra.get(g, lambda v: "")(v))


def cmd_bench(a):
    from kcore.bench import run_all
    res = run_all(MODULES, window_s=a.window, threads=a.threads)
    for r in res["rows"]:
        jr = r.get("J_per_result")
        rp = f"{r['roofline_pct']:7.2f}% ({r['bound']})" if "roofline_pct" in r else "      -"
        print(f"{r['kernel']:17s} {r['impl']:13s} {r['device']:5s} {json.dumps(r['size']):48s} "
              f"{r['results_per_s']:12.4g}/s  {('%.3g J/result' % jr) if jr else 'J n/a':16s} {rp}")
    for p in res["pareto"]:
        print(f"pareto {p['kernel']:17s} {p['device']:5s} fastest {json.dumps(p['fastest_size'])} "
              f"least-energy {json.dumps(p['least_energy_size'])} agree={p['optima_agree']}")
    print(f"ALL NUMBERS: {res['label']}")
    out = Path(a.out or ROOT / "out" / "bench-smoke.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=2, default=str), encoding="utf-8")
    return 0


def cmd_pipeline(a):
    from pipeline import compose
    res = compose()
    for name, st in res["placements"].items():
        print(f"{name:16s} " + "  ".join(f"{k}={'equal' if v else 'DIFFER'}" for k, v in st.items()))
    print(f"all placements bit-identical: {res['all_bit_identical']}  xyz sha256 {res['xyz_hash'][:16]}")
    reg = _registry()
    reg["pipelines"] = [{"name": "blend>lattice_resample>spectral_shade", "checked":
                         dt.datetime.now().isoformat(timespec="seconds"), **res}]
    _save(reg)
    return 0 if res["all_bit_identical"] else 1


def cmd_list(a):
    for e in _registry()["kernels"]:
        eq = e["contract"].get("equivalence", {})
        print(f"{e['name']:18s} v{e['version']:6s} {e['mode']:13s} equivalence={eq.get('pass', 'unchecked')}")
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check")
    c.add_argument("--threads", type=int, default=4)
    c.add_argument("--json")
    c.add_argument("--no-receipts", action="store_true")
    c.add_argument("--seed", type=int, help="replay a recorded check seed (default: fresh at check time)")
    c.add_argument("--no-planted", action="store_true", help="skip the planted-bad gate controls")
    b = sub.add_parser("bench")
    b.add_argument("--window", type=float, default=3.0)
    b.add_argument("--threads", type=int, default=8)
    b.add_argument("--out")
    sub.add_parser("pipeline")
    sub.add_parser("list")
    a = p.parse_args()
    return {"check": cmd_check, "bench": cmd_bench, "pipeline": cmd_pipeline, "list": cmd_list}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
