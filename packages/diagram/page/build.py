# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build the diagram pages: run the engine tests, then inline the engine, ndim, perceive's Planck and entropy
code, the diagram, the material values and the site kit into one page per diagram that opens from disk.

    python -I page/build.py
"""
import os
import datetime
import html
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, os.environ.get("SITE_KIT", "site-kit"))  # the site repo's system/kit
from inline import inline_kit  # noqa: E402
from words import INDEX, OVERLAYS  # noqa: E402

IDS = ["wien", "cesium", "sampling", "cordic", "gpib", "guard", "trace"]
NDIM = ["vec", "polytopes", "lattice", "slice", "coxeter", "project", "fields"]
PERCEIVE = ["cmf", "spectral", "loss"]
SRC = ["core", "mesh", "model", "section", "raster", "scene", "lens", "layout", "spacetime", "overlay", "charts", "gl"]
PAGE = ["stage", "views", "app"]
PLANES = ["xy", "xz", "xt", "yz", "yt", "zt"]
OUT = ROOT / "pages"
FAR = Path(os.environ.get("RENDER_OUT", "out/render")) / "diagram"


def run_tests():
    out = ROOT / "data" / "tests.json"
    r = subprocess.run(["node", str(ROOT / "tests" / "engine.test.js"), "--json", str(out)], capture_output=True, text=True)
    print(r.stdout.strip(), r.stderr.strip()[:3000])
    if r.returncode:
        raise SystemExit("engine tests failed; pages not built")
    return json.loads(out.read_text(encoding="utf-8"))


def read(p):
    return Path(p).read_text(encoding="utf-8")


def lib_js():
    js = [read(ROOT.parent / "measured" / "generated" / "constants.js")] + [read(ROOT.parent / "ndim" / "src" / f"{f}.js") for f in NDIM]
    js += [read(ROOT.parent / "perceive" / "src" / f"{f}.js") for f in PERCEIVE]
    js += [read(ROOT / "src" / f"{f}.js") for f in SRC]
    js += [read(HERE / f"{f}.js") for f in PAGE]
    return "\n".join(js)


def knob(id_, label, lo, hi, step, val, unit, extra=""):
    return (f'<span class="kn"><label for="{id_}">{html.escape(label)}</label>'
            f'<input id="{id_}" type="range" min="{lo}" max="{hi}" step="{step}" value="{val}" data-knob data-label="{html.escape(label)}" data-unit="{html.escape(unit)}"{extra}></span>')


def page(i, meta, tests, js, mat, css):
    d = meta["defs"][i]
    knobs = ""
    if d["knobs"]:
        knobs = '<fieldset><legend>Front panel</legend><div class="k-rack">' + "".join(knob(k["id"], k["label"], k["min"], k["max"], k["step"], k["value"], k.get("unit", "")) for k in d["knobs"]) + "</div></fieldset>"
    st = "".join(knob(f"st-{p}", f"Turn {p}", 0, 360, 1, 0, "°", f' data-plane="{n}"') for n, p in enumerate(PLANES))
    M = meta["MATERIALS"]
    rows = []
    for n, p in enumerate(d["parts"]):
        libid = (M.get(p["material"]) or {}).get("lib")
        mat_name = (json.loads(mat)["materials"].get(libid) or {}).get("name") if libid else None
        rows.append(f"<tr><td class=num>{n + 1}</td><td>{html.escape(p['label'])}</td><td>{html.escape(mat_name + ' (library)' if mat_name else p['material'] + ' (no library record)')}</td><td>{html.escape(p['qty'])}</td><td>{html.escape(p['alt'])}</td></tr>")
    lens = "".join(f"<tr><td>{html.escape(v['name'])}</td><td>{html.escape('; '.join(v['keeps']))}</td><td>{html.escape('; '.join(v['drops']))}</td></tr>" for v in meta["LENS"].values())
    lens += "".join(f"<tr><td>Layer: {html.escape(v['name'])}</td><td>{html.escape('; '.join(v['keeps']))}</td><td>{html.escape('; '.join(v['drops']))}</td></tr>" for v in meta["OVERLAY"].values())
    mine = [r for r in tests["rows"] if r["name"].startswith(i + ":")]
    tsum = (f"{tests['pass']} engine checks pass and {tests['fail']} fail; {tests['planted_rejected']} planted wrong inputs are rejected. "
            f"For this diagram: " + "; ".join(r["name"].split(": ", 1)[1] + (" (pass)" if r["ok"] else " (FAIL)") for r in mine) + ".")
    t = read(HERE / "template.html")
    for k, v in {"TITLE": html.escape(d["title"]), "REGION": d["region"], "SUPER": html.escape(d["super"]), "LEDE": html.escape(d["lede"]), "MESSAGE": html.escape(d["message"]),
                 "PLAIN": d["plain"], "WORKING": d["working"], "OVERLAYS": OVERLAYS + d["overlayNotes"], "PARTS": "".join(rows), "LENSES": lens,
                 "SOURCES": "".join(f"<li>{html.escape(s)}</li>" for s in d["sources"]), "TESTSUM": html.escape(tsum), "KNOBS": knobs, "STKNOBS": st, "CSS": css,
                 "ID": i, "DATE": datetime.date.today().isoformat(), "MAT": mat.replace("</", "<\\/"),
                 "JS": (js + read(ROOT / "diagrams" / f"{i}.js") + f"\nDApp.init({json.dumps(i)});\n").replace("</script", "<\\/script")}.items():
        t = t.replace("{{" + k + "}}", v)
    out = OUT / d["file"]
    out.write_text(inline_kit(t, out), encoding="utf-8")
    print("wrote", out, out.stat().st_size)


def index(meta, tests, js, mat, css):
    defs = [meta["defs"][i] for i in IDS if i in meta["defs"]]
    cards = "".join(f'<li><canvas data-card="{d["id"]}" aria-label="{html.escape(d["title"])}: the 3D model, taken apart as far as the slider says and cut open"></canvas>'
                    f'<p><a href="{d["file"]}">{html.escape(d["title"])}</a></p><p class="lens">{html.escape(d["message"])}</p></li>' for d in defs)
    body = INDEX.replace("{{CARDS}}", cards).replace("{{TESTS}}", html.escape(f"{tests['pass']} checks pass, {tests['fail']} fail; {tests['planted_rejected']} planted wrong inputs rejected, {tests['planted_accepted']} accepted."))
    js_all = js + "".join(read(ROOT / "diagrams" / f"{d['id']}.js") for d in defs) + read(HERE / "index.js")
    t = read(HERE / "index_template.html").replace("{{BODY}}", body).replace("{{CSS}}", css).replace("{{MAT}}", mat.replace("</", "<\\/")).replace("{{DATE}}", datetime.date.today().isoformat())
    t = t.replace("{{JS}}", js_all.replace("</script", "<\\/script"))
    out = OUT / "index.html"
    out.write_text(inline_kit(t, out), encoding="utf-8")
    print("wrote", out, out.stat().st_size)


def main():
    ids = [i for i in IDS if (ROOT / "diagrams" / f"{i}.js").exists()]
    tests = run_tests()
    r = subprocess.run(["node", str(ROOT / "build" / "meta.js"), *ids], capture_output=True, text=True, check=True)
    meta = json.loads(r.stdout)
    bad = {i: d["problems"] for i, d in meta["defs"].items() if d["problems"]}
    if bad:
        raise SystemExit(f"models refused: {bad}")
    OUT.mkdir(exist_ok=True)
    js, mat, css = lib_js(), read(ROOT / "data" / "materials.json"), read(HERE / "page.css")
    for i in ids:
        page(i, meta, tests, js, mat, css)
    index(meta, tests, js, mat, css)
    FAR.mkdir(parents=True, exist_ok=True)
    shutil.copy(ROOT / "data" / "tests.json", FAR / "tests.json")


if __name__ == "__main__":
    main()
