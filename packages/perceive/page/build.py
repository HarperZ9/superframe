# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build packages/perceive/perceive.html: run the known-answer tests, then inline the library, ndim's
source, the page scripts, the data, the test record and the site kit into one page that opens from disk.

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
NDIM = ROOT.parent / "ndim"
sys.path.insert(0, str(HERE))
sys.path.insert(0, os.environ.get("SITE_KIT", "site-kit"))  # the site repo's system/kit
from inline import inline_kit  # noqa: E402
from prose import MISSING, PRO  # noqa: E402

LIB = ["cmf", "spectral", "signal", "loss", "fields", "polar", "surface", "dims", "registry"]
NDIM_LIB = ["vec", "polytopes", "lattice", "slice", "coxeter", "project"]
PAGE = ["app", "v_light", "v_sound", "v_fields", "v_shape"]
FAR = Path(os.environ.get("RENDER_OUT", "out/render")) / "perceive"
PICKS = {
    "waves": [("bb", "The heat glow of anything (a hot body at any temperature)"), ("h", "Hydrogen's colours, ultraviolet to infrared"),
              ("na", "A sodium street lamp"), ("au", "The aurora"), ("mat", "Metals, glass and water: how they bend and absorb light"),
              ("bat", "A bat's call, far above hearing"), ("rings", "Tree rings and Alpine summers, 1901 to 1974")],
    "em": [("elec", "Electric voltage around charges"), ("mag", "The magnetic field round wires")],
    "light-state": [("pol", "How light is twisted (polarisation)")],
    "heat": [("heat", "Heat spreading through metal")],
    "space": [("geo", "How a surface curves"), ("dims", "Shapes with more than three directions"), ("laws", "The laws of physics as chords")],
}
PLANES = ["xw", "yw", "zw", "xv", "yv", "zv", "wv"]
E = html.escape


def run_tests():
    out = ROOT / "data" / "tests.json"
    r = subprocess.run(["node", str(ROOT / "tests" / "known.test.js"), "--json", str(out)], capture_output=True, text=True)
    print(r.stdout.strip(), r.stderr.strip()[:2000])
    if r.returncode:
        raise SystemExit("known-answer tests failed; page not built")
    FAR.mkdir(parents=True, exist_ok=True)
    shutil.copy(out, FAR / "tests.json")
    return json.loads(out.read_text(encoding="utf-8"))


def registry():
    r = subprocess.run(["node", "-e", "const P=require('./src/index.js');console.log(JSON.stringify({b:P.BRIDGES,g:P.GROUPS}))"],
                       cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def pick(groups):
    names = dict(groups)
    return "".join(f'<optgroup label="{E(names[g])}">' + "".join(f'<option value="{v}"{" selected" if v == "bb" else ""}>{E(t)}</option>' for v, t in opts)
                   + "</optgroup>" for g, opts in PICKS.items())


def plain(reg):
    out = []
    for gid, gname in reg["g"]:
        items = "".join(f"<li><h3>{E(b['name'])}</h3><p>{E(b['plain'])}</p></li>" for b in reg["b"] if b["group"] == gid)
        out.append(f"<h3>{E(gname)}</h3><ul class=\"plainlist\">{items}</ul>")
    return "".join(out)


def rows(reg):
    return "".join(f"<tr><th scope=\"row\">{E(b['name'])}</th><td>{E(b['quantity'])}; {E(b['units'])}</td><td>{E(b['geometry'])}</td>"
                   f"<td>{E(b['map'])}</td><td>{E(b['keeps'])}</td><td>{E(b['loses'])}</td><td>{E(b['test'])}</td></tr>" for b in reg["b"])


def planes():
    return "".join(f'<label for="d-{p}"{" class=\"kn5\" hidden" if "v" in p else ""}>Turn in the {p} plane (degrees)'
                   f'<input id="d-{p}" type="range" min="0" max="360" step="1" value="{ {"xw": 30, "zw": 20}.get(p, 0) }"></label>' for p in PLANES)


def main():
    t = run_tests()
    reg = registry()
    js = (ROOT.parent / "measured" / "generated" / "constants.js").read_text(encoding="utf-8") + "\n"
    js += "\n".join((ROOT / "src" / f"{f}.js").read_text(encoding="utf-8") for f in LIB)
    js += "\n" + "\n".join((NDIM / "src" / f"{f}.js").read_text(encoding="utf-8") for f in NDIM_LIB)
    js += "\n" + "\n".join((HERE / f"{f}.js").read_text(encoding="utf-8") for f in PAGE)
    js += "\nPV.init();\n"
    summ = (f"{t['pass']} checks pass, {t['fail']} fail; {t['planted_rejected']} planted wrong values rejected, "
            f"{t['planted_accepted']} accepted; {t['ms']} ms in Node.")
    trows = "".join(f"<tr><td>{E(r['name'])}</td><td data-verdict=\"{'pass' if r['ok'] else 'fail'}\">{'pass' if r['ok'] else 'fail'}</td>"
                    f"<td>{E(str(r.get('detail') or ''))}</td></tr>" for r in t["rows"])
    sub = {"CSS": (HERE / "page.css").read_text(encoding="utf-8"), "PICK": pick(reg["g"]), "PLAIN": plain(reg), "ROWS": rows(reg),
           "PLANES": planes(), "PRO": PRO, "MISSING": MISSING, "TESTSUM": summ, "TESTROWS": trows,
           "DATE": datetime.date.today().isoformat(),
           "MAT": (ROOT / "data" / "materials-nk.json").read_text(encoding="utf-8").replace("</", "<\\/"),
           "RINGS": (ROOT / "data" / "rings.json").read_text(encoding="utf-8").replace("</", "<\\/"),
           "LAWS": (NDIM / "data" / "laws.json").read_text(encoding="utf-8").replace("</", "<\\/"),
           "JS": js.replace("</script", "<\\/script")}
    page = (HERE / "template.html").read_text(encoding="utf-8")
    for k, v in sub.items():
        page = page.replace("{{" + k + "}}", v)
    out = ROOT / "perceive.html"
    out.write_text(inline_kit(page, out), encoding="utf-8")
    print("wrote", out, out.stat().st_size)


if __name__ == "__main__":
    main()
