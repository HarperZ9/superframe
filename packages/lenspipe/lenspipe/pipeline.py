# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""One open design in; performance, manufacturability, tolerance, limits, cost class, verdict and every output file out.

python -I -B -m lenspipe.pipeline DESIGN.json OUTDIR [--trials N]. Each step writes its JSON and is skipped when the file is
present and the design hash matches, so a killed run resumes where it stopped.
"""
import hashlib
import json
import sys
import warnings
from pathlib import Path

import numpy as np

from . import cadout, design, interchange, limits, optics, rules, tolerance


def cost_class(d, rows, mc):
    """Rough class only, from drivers public sources name. No shop quoted this and it is unverified."""
    n = len(cadout.pieces(d))
    asph = sum(1 for s in d["surfaces"] if s.get("aspheric") or s.get("conic"))
    tight = sum(1 for i in range(len(d["surfaces"])) if design.tolerances(d, i)["ct_mm"] < 0.05 or design.tolerances(d, i)["irreg_fringes"] < 0.5)
    points = n + 3 * asph + tight + 2 * len(rules.flags(rows))
    label = "A" if points <= 3 else "B" if points <= 8 else "C" if points <= 15 else "D"
    return dict(cost_class=label, points=points, status="rough and unverified: no quote, no shop input", drivers=dict(pieces=n, aspheric_surfaces=asph, tight_tolerance_surfaces=tight, flags=len(rules.flags(rows))),
                basis="Optimax says price rises about 50 percent per tolerance tier; the point weights are my judgement")


def verdict(rows, perf, mc, lim, intent):
    """Names the first thing to change, in fixed priority. Words: design check only, nothing here shows the part."""
    blocks = rules.blockers(rows)
    if blocks:
        r = blocks[0]
        return dict(status="DO NOT QUOTE", first_change=f"{r['where']}: {r['message']}", why=f"{len(blocks)} blocking rule(s)", blockers=[f"{x['rule']} {x['where']}" for x in blocks])
    goal_mtf = intent.get("mtf_targets", {})
    misses = [f"{k} cy/mm mean MTF {perf['mtf_mean'].get(k, 0):.3f} under goal {v}" for k, v in goal_mtf.items() if perf["mtf_mean"].get(k, 0) < v]
    if misses:
        return dict(status="REDESIGN", first_change=misses[0], why="performance against the stated goal")
    if mc and mc["yield_"] < intent.get("yield_goal", 0.8):
        s = mc["sensitivity"][0]
        return dict(status="TIGHTEN", first_change=f"S{s['surface']} {s['kind']} tolerance, largest single drop {s['drop']:.4f}", why=f"yield {mc['yield_']:.2f} under goal {intent.get('yield_goal', 0.8)}")
    flags = rules.flags(rows)
    if flags:
        return dict(status="QUOTABLE WITH NOTES", first_change=f"{flags[0]['where']}: {flags[0]['message']}", why=f"{len(flags)} flag(s), no blockers")
    gap = lim["largest_gap"]
    return dict(status="QUOTABLE", first_change=f"largest gap to bound is {gap['cause']} at {gap['deg']} deg, {gap['bits']['total']:.2f} bits", why="no rule fired; a calculation on the design, never proof of a lens")


def _step(out, name, h, fn, state):
    p = out / f"{name}.json"
    if state.get(name) == h and p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    res = fn()
    p.write_text(json.dumps(res, indent=1, default=float), encoding="utf-8")
    state[name] = h
    (out / "state.json").write_text(json.dumps(state), encoding="utf-8")
    return res


def run(path, outdir, trials=200, seed=1, plates=None, nmax=512):
    warnings.simplefilter("ignore")
    d = design.load(path)
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha256(Path(path).read_bytes()).hexdigest()[:16] + f"/{trials}/{seed}"
    st = out / "state.json"
    state = json.loads(st.read_text()) if st.exists() else {}
    lens = design.to_lens(d)
    rows = _step(out, "rules", h, lambda: rules.check(d, plates), state)
    bad = rules.blockers(rows)
    # A design with blockers still gets interchange where possible, but no performance is claimed for it.
    perf = _step(out, "performance", h, lambda: optics.evaluate(lens, d["intent"], nmax=nmax), state) if not bad else None
    mc = _step(out, "tolerance", h, lambda: tolerance.monte_carlo(d, trials=trials, seed=seed), state) if not bad else None
    lim = _step(out, "limits", h, lambda: limits.report(d, lens, nmax=nmax), state) if not bad else None
    cost = cost_class(d, rows, mc)
    v = verdict(rows, perf, mc, lim, d["intent"]) if not bad else verdict(rows, None, None, None, d["intent"])
    files = {}
    if not bad:
        interchange.write_zmx(d, out / f"{d['id']}.zmx")
        interchange.write_seq(d, out / f"{d['id']}.seq")
        cadout.write_step(d, out / f"{d['id']}.step")
        cadout.write_glb(d, out / f"{d['id']}.glb")
        (out / f"{d['id']}.lensroom.json").write_text(json.dumps(interchange.to_lens_room(d), indent=1), encoding="utf-8")
        files["drawings"] = [cadout.drawing(d, a, b, out / f"{d['id']}.S{a+1}") for a, b, _, _ in cadout.pieces(d)]
        rt_z = interchange.compare(d, interchange.read_zmx(out / f"{d['id']}.zmx", d))
        rt_s = interchange.compare(d, interchange.read_seq(out / f"{d['id']}.seq", d))
        files["round_trip"] = dict(zmx=dict(worst=rt_z[0], misses=rt_z[1]), seq=dict(worst=rt_s[0], misses=rt_s[1]))
        files["glb"] = cadout.read_glb(out / f"{d['id']}.glb")
    summary = dict(design=d["id"], verdict=v, cost=cost, rules=dict(block=len(bad), flag=len(rules.flags(rows))), files=files,
                   notice="Simulation result on a stated model. Not a fabrication guarantee, not a shop review. Anything about patents or selling needs a lawyer.")
    (out / "summary.json").write_text(json.dumps(summary, indent=1, default=float), encoding="utf-8")
    return summary


if __name__ == "__main__":
    a = sys.argv[1:]
    tr = int(a[a.index("--trials") + 1]) if "--trials" in a else 200
    print(json.dumps(run(a[0], a[1], trials=tr), indent=1, default=float)[:3000])
