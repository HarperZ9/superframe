# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build index.html from the worked examples, the room study results, the receipt and the new checks.

  python -I -B build_page.py
Style and rail: the site's system/kit, inlined. figs.js and page.js are inlined too, so the page is one file.
"""
import os
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.dont_write_bytecode = True
sys.path.insert(0, os.environ.get("SITE_KIT", "site-kit"))  # the site repo's system/kit
from inline import inline_kit  # noqa: E402

RUN1, RUN2 = "20261031T003606Z", "20261031T004139Z"
NEW_CHECKS = ("operatortruth", "zeronull", "analyticspecimen", "shuffledtruth", "fixedpointratio", "buildcapsule")


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def study():
    r1 = load(ROOT / "studies/room/out" / RUN1 / "result.json")
    r2 = load(ROOT / "studies/room/out" / RUN2 / "result.json")
    verdicts = []
    for name, v in r1["verdicts"].items():
        w = r2["verdicts"][name]
        verdicts.append({"name": name, "rule": "; ".join(x["rule"] for x in v["rules"]), "r1": v["verdict"],
                         "l1": v["rules"][0]["left"], "r2": w["verdict"], "l2": w["rules"][0]["left"]})
    cells = []
    for sp in ("ideal", "laptop", "phone"):
        c1, c2 = r1["analysis"]["by_cell"][sp], r2["analysis"]["by_cell"][sp]
        cells.append({"speaker": f"{sp}, run 1", **{m: c1["med_err_" + m] for m in ("S1", "S2", "S3", "S4", "prior")}, "ok": c1["ok_share"]})
        cells.append({"speaker": f"{sp}, run 2", **{m: c2["med_err_" + m] for m in ("S1", "S2", "S3", "S4", "prior")}, "ok": c2["ok_share"]})
    a1, a2 = r1["analysis"], r2["analysis"]
    line = (f"240 simulated rooms through the full chain, preregistered (prereg sha256 {r1['prereg']['sha256'][:12]}...). "
            f"Median volume errors in the table; the verdicts read means and intervals. Run 1 is the result of record. "
            f"Run 2 repeats it after a bug fix found by the WAV known-answer test (deviation D1) and is post hoc. "
            f"Laptop gap to the prior guess: run 1 {a1['gap_prior_laptop']:.2f} (CI {a1['gap_prior_ci_lo']:.2f} to {a1['gap_prior_ci_hi']:.2f}); "
            f"run 2 {a2['gap_prior_laptop']:.2f} (CI {a2['gap_prior_ci_lo']:.2f} to {a2['gap_prior_ci_hi']:.2f}).")
    rt = a1["roundtrip"]
    r2b = sum(x["bits_per_bin"] for x in rt["R2"]) / len(rt["R2"])
    r2e = max(x["error_db"] for x in rt["R2"])
    rows = [{"path": "ideal digital (16-bit sweep, no analog)", "error": f"{rt['ideal']['error_db']:.1f} dB", "bits": f"{rt['ideal']['bits_per_bin']:.1f}", "lost": "reference"},
            {"path": "R0 electrical loopback", "error": f"{rt['R0']['error_db']:.1f} dB", "bits": f"{rt['R0']['bits_per_bin']:.1f}", "lost": f"{rt['bits_lost']['loopback']:.1f}"},
            {"path": "R1 six planted modes, laptop chain", "error": f"{rt['R1']['error_db']:.1f} dB; worst mode {rt['R1']['max_abs_df']:.3f} Hz", "bits": f"{rt['R1']['bits_per_bin']:.1f}", "lost": "n/a"},
            {"path": "R2 six rooms, laptop chain", "error": f"worst {r2e:.1f} dB", "bits": f"{r2b:.1f}", "lost": f"{rt['bits_lost']['acoustic']:.1f}"}]
    msg_val = a1["by_cell"]["laptop"]["med_err_S3"]
    return {"verdicts": verdicts, "cells": cells, "line": line}, rows, msg_val, a1, a2, r1, r2


def main():
    inst = {d["id"]: d for d in (load(ROOT / f"examples/{k}.json") for k in ("room-weyl", "jnt", "polariscope"))}
    st, rt, med, a1, a2, r1, r2 = study()
    rc = load(ROOT / "examples/room-receipt.sim.json")
    ev = rc["events"][0]
    rcpt = json.dumps({"schema": rc["schema"], "event": {k: ev[k] for k in ("event_id", "actor", "units", "value", "uncertainty", "instrument", "event_hash")}}, indent=1, default=float)
    checks = [c for c in load(os.environ["CHECKS_JSON"])["checks"] if c["id"] in NEW_CHECKS]
    data = {"inst": inst, "study": st, "rt": rt, "receipt": rcpt, "checks": checks}
    v1, v2 = r1["verdicts"], r2["verdicts"]
    msg = (f"Ten stages carry an instrument from law to receipt; run for real on the room meter, the laptop heard simulated rooms' "
           f"volume to a median {round(100 * med)} percent and passed its kill condition, but did not beat a plain guess on average until a bug fix, post hoc.")
    plain = (f"We ran the room meter's simulation on 240 made-up rooms, each heard through a model of a laptop's speaker, the air and its microphone. "
             f"Counting the room's notes with a careful method gave the volume within about {round(100 * med)} percent for a typical room. "
             f"A simple count of peaks was far worse, off by about {round(100 * a1['by_cell']['laptop']['med_err_S1'])} percent, because neighbouring notes blur together. "
             f"One rare room fooled the method badly, so on average it did not beat guessing a typical room size. A test with planted notes then found a bug "
             f"in how the echo's fade was timed; with that fixed, a second run beat the guess, but that second run came after we had seen the first, so it counts as a lead, not a result.")
    tpl = (HERE / "page_template.html").read_text(encoding="utf-8")
    js = (ROOT.parent / "measured" / "generated" / "constants.js").read_text(encoding="utf-8") + "\n" + (HERE / "figs.js").read_text(encoding="utf-8") + "\n" + (HERE / "page.js").read_text(encoding="utf-8").replace(
        "/*DATA*/null", json.dumps(data, separators=(",", ":"), default=float))
    html = tpl.replace('<script src="page.js"></script>', "<script>\n" + js + "\n</script>").replace("MESSAGE", msg).replace("PLAIN_RESULT", plain)
    out = ROOT / "index.html"
    out.write_text(inline_kit(html, out), encoding="utf-8")
    print("wrote", out, out.stat().st_size, "V1-7 run1:", [v1[k]["verdict"] for k in sorted(v1)], "run2:", [v2[k]["verdict"] for k in sorted(v2)])


if __name__ == "__main__":
    main()
