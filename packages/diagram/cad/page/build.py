# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build the instrument pages: run the engine and cad tests, export every artefact, then inline the engine, the
cad layer, one instrument, its pipeline record and the site kit into one page per instrument, plus an index.

    python -I cad/page/build.py
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
CAD = HERE.parent
ROOT = CAD.parent
sys.path.insert(0, os.environ.get("SITE_KIT", "site-kit"))  # the site repo's system/kit
from inline import inline_kit  # noqa: E402

IDS = ["jnt", "polariscope", "room"]
NDIM = ["vec", "polytopes", "lattice", "slice", "coxeter", "project", "fields"]
PERCEIVE = ["cmf", "spectral", "loss"]
SRC = ["core", "mesh", "model", "section", "raster", "scene", "lens", "layout", "spacetime", "overlay", "charts", "gl"]
CADSRC = ["param", "symbols", "ortho", "sheet", "blueprint", "out", "schem", "schsvg", "kicad", "spec"]
PIPE = ROOT.parent / "instruments" / "examples"
OUT = ROOT / "pages"
FAR = Path(os.environ.get("RENDER_OUT", "out/render")) / "instrument-cad"

WORKING = """<p>One file per instrument (<code>cad/instruments/ID.js</code>) holds the parameters and a <code>build(p)</code> that returns
parts with geometry in millimetres, a material and tolerances, the assembly tree, the parts-list items, the netlist and
the drawing's dimensions. <code>resolve()</code> runs it for one set of values and refuses the record if a part has no
label, a net has fewer than two pins, a pin is neither wired nor marked no-connect, a dimension has no tolerance, a
part is in no parts-list item, or a fit check fails.</p>
<p>The drawing's views are the engine's own meshes projected orthographically. Every crease, open edge and silhouette
is sampled against a depth buffer from the engine's software raster and split into visible and hidden runs. Dimensions
are measured from that projected geometry, never copied from the parameters, so the tests can compare the two. The
section view uses the engine's plane cut, hatched per material after ISO 128-50. The DXF is release 12, written and read
here; the KiCad schematic and netlist are KiCad 8 s-expressions, written here and read back by a parser that rebuilds
connectivity from pin, wire and label geometry, because KiCad is not installed.</p>
<p>Conventions: ASME Y14.5-2018 for dimensions and tolerances (unidirectional text, basic dimensions boxed, a position
tolerance in a feature control frame), third-angle projection, ISO 5455 scales, ISO 7200 title block, ASME Y14.34 parts
list order, IEC 60617 symbols for passives, switches, cells and ground, the IEEE 315 triangle for amplifiers.</p>"""

PLAIN = {
    "jnt": """<p>A resistor's own electrical noise grows with its temperature, and the size of that noise is fixed by a constant of
nature, so measuring the noise measures the temperature. The box holds two separate amplifiers that listen to the same
resistor; noise they share is the resistor's, noise they do not share averages away.</p>
<p>Slide the resistor value and the band, and the noise budget, the averaging time and the settle time move at once.
Slide the box or the probe can and the 3D body, every drawing view and every dimension move with it. The resistor's
value in the schematic and in the KiCad files follows the same slider.</p>""",
    "polariscope": """<p>Clear plastic under load turns polarised light by an amount that depends on the stress inside it. Between two
crossed polarisers that turning shows up as coloured bands, and each band is one more step of stress. A disc squeezed
across its diameter has a known pattern, so it calibrates the plastic.</p>
<p>Load the disc and watch the fringe count at its centre climb. Turn the analyser and the dark cross of the isoclinics
comes and goes; the drawing's angle dimension and the optical-train label follow the same knob.</p>""",
    "room": """<p>Every room rings at a set of notes fixed by its shape. Count how many of those notes lie below a frequency and
Weyl's law turns the count into the room's volume. A laptop in one corner plays a sweep, a phone in the opposite corner
listens, and a small resistor pad lets the same chain be tested by wire first.</p>
<p>Stretch the room and the walls move in the 3D view and on the set-up drawing, the dimensions change, and the counted
modes and Weyl's curve move together on the chart.</p>""",
}


def read(p):
    return Path(p).read_text(encoding="utf-8")


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    print(r.stdout.strip()[-400:], r.stderr.strip()[-2000:])
    if r.returncode:
        raise SystemExit("failed: " + " ".join(map(str, args)))


def lib_js():
    js = [read(ROOT.parent / "measured" / "generated" / "constants.js")] + [read(ROOT.parent / "ndim" / "src" / f"{f}.js") for f in NDIM] + [read(ROOT.parent / "perceive" / "src" / f"{f}.js") for f in PERCEIVE]
    js += [read(ROOT / "src" / f"{f}.js") for f in SRC] + [read(ROOT / "page" / "stage.js")]
    records = {i: json.loads(read(ROOT.parent / "instruments" / "records" / f"{i}.json")) for i in IDS}
    js += ["globalThis.InstrumentRecords = " + json.dumps(records).replace("</", "<\\/") + ";"]
    js += [read(CAD / "src" / f"{f}.js") for f in CADSRC]
    return "\n".join(js)


def meta(i):
    r = subprocess.run(["node", "-e", f"const {{C}}=require({json.dumps(str(CAD / 'load.js'))});const I=C.REG[{json.dumps(i)}];"
                        "process.stdout.write(JSON.stringify({title:I.title,file:I.file,region:I.region,super:I.super,lede:I.lede,message:I.message,pipeline:I.pipeline}))"],
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def page(i, m, js, css, tests, mat):
    data = json.dumps({"pipeline": json.loads(read(PIPE / m["pipeline"])), "materials": json.loads(mat)["materials"]}).replace("</", "<\\/")
    mine = [r for r in tests["rows"] if r["name"].startswith(i + ":")]
    tsum = (f"{tests['pass']} cad checks pass and {tests['fail']} fail; {tests['planted_rejected']} planted errors are refused and "
            f"{tests['planted_accepted']} accepted. For this instrument: " + "; ".join(r["name"].split(": ", 1)[1] + (" (pass)" if r["ok"] else " (FAIL)") for r in mine) + ".")
    t = read(HERE / "template.html")
    for k, v in {"TITLE": html.escape(m["title"]), "REGION": m["region"], "SUPER": html.escape(m["super"]), "LEDE": html.escape(m["lede"]),
                 "MESSAGE": html.escape(m["message"]), "PLAIN": PLAIN[i], "WORKING": WORKING, "TESTSUM": html.escape(tsum), "CSS": css, "ID": i,
                 "DATE": datetime.date.today().isoformat(), "DATA": data,
                 "JS": (js + read(CAD / "instruments" / f"{i}.js") + read(HERE / "app.js") + f"\nCadApp.init({json.dumps(i)});\n").replace("</script", "<\\/script")}.items():
        t = t.replace("{{" + k + "}}", v)
    out = OUT / m["file"]
    out.write_text(inline_kit(t, out), encoding="utf-8")
    print("wrote", out, out.stat().st_size)


def index(metas, css, tests):
    cards = ""
    for i, m in metas.items():
        svg = read(CAD / "out" / i / "drawing.svg").replace(' width="594mm" height="420mm"', "").replace(' width="420mm" height="297mm"', "")
        svg = svg.replace('role="img"', 'role="img" aria-hidden="true"', 1)
        cards += f'<li><div class="thumb">{svg}</div><p><a href="{m["file"]}">{html.escape(m["title"])}</a></p><p class="lens">{html.escape(m["message"])}</p></li>'
    body = f"""<header class="k-head"><p class="k-super" aria-hidden="true">Y14.5</p><h1>Instrument drawings</h1>
<p class="k-lede">Three instruments from the hardware pipeline, each one parametric model with its 3D body, assembly drawing, schematic, parts lists and spec sheet.</p><hr class="k-horizon"></header>
<section class="k-layer" data-layer="toy" id="toy" aria-labelledby="toy-h"><div class="k-layer-head"><h2 id="toy-h">Pick an instrument</h2><span class="k-depth">toy</span></div><ul class="cad-cards">{cards}</ul></section>
<p class="k-message">Every drawing, schematic and spec sheet here is generated from one model per instrument, so none of them can drift from the others.</p>
<section class="k-layer" data-layer="plain" id="plain" aria-labelledby="plain-h"><div class="k-layer-head"><h2 id="plain-h">In plain words</h2><span class="k-depth">plain</span></div>
<div class="prose"><p>Change a number on any instrument's page and the 3D model, the drawing, the wiring diagram, the parts lists and the spec sheet are all drawn again from it.</p></div></section>
<section class="k-layer" data-layer="pro" id="pro" aria-labelledby="pro-h"><div class="k-layer-head"><h2 id="pro-h">Tests</h2><span class="k-depth">pro</span></div>
<p>{html.escape(f"{tests['pass']} cad checks pass, {tests['fail']} fail; {tests['planted_rejected']} planted errors refused, {tests['planted_accepted']} accepted.")}</p><div class="prose">{WORKING}</div></section>"""
    t = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Instrument drawings</title>
<!-- site-kit:begin --><!-- site-kit:end --><style>{css}</style></head><body data-region="print"><main class="k-page">{body}
<p class="k-meta k-foot">Built {datetime.date.today().isoformat()} by packages/diagram/cad/page/build.py.</p></main></body></html>"""
    out = OUT / "cad-index.html"
    out.write_text(inline_kit(t, out), encoding="utf-8")
    print("wrote", out, out.stat().st_size)


def main():
    run(["node", str(ROOT / "tests" / "engine.test.js"), "--json", str(ROOT / "data" / "tests.json")])
    run(["node", str(ROOT / "tests" / "cad.test.js"), "--json", str(ROOT / "data" / "cad-tests.json")])
    run(["node", str(CAD / "export.js")])
    tests = json.loads(read(ROOT / "data" / "cad-tests.json"))
    js, css, mat = lib_js(), read(ROOT / "page" / "page.css") + read(HERE / "cad.css"), read(ROOT / "data" / "materials.json")
    metas = {i: meta(i) for i in IDS}
    for i in IDS:
        page(i, metas[i], js, css, tests, mat)
    index(metas, css, tests)
    FAR.mkdir(parents=True, exist_ok=True)
    for i in IDS:
        shutil.copytree(CAD / "out" / i, FAR / "exports" / i, dirs_exist_ok=True)
    shutil.copy(ROOT / "data" / "cad-tests.json", FAR / "cad-tests.json")
    shutil.copy(ROOT / "data" / "tests.json", FAR / "engine-tests.json")


if __name__ == "__main__":
    main()
