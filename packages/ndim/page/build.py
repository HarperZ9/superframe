# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build packages/ndim/ndim.html: run the known-answer tests, then inline the library, the page
scripts, the law embedding, the test record and the site kit into one page that opens from disk.

    python -I page/build.py
"""
import os
import datetime
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, os.environ.get("SITE_KIT", "site-kit"))  # the site repo's system/kit
from inline import inline_kit  # noqa: E402
from prose import MISSING, PRO  # noqa: E402

LIB = ["vec", "polytopes", "lattice", "slice", "coxeter", "project", "fields"]
PAGE = ["draw", "toy", "gallery", "fieldsview", "diagrams"]
KNOBS = [("xy", 25), ("xz", 20), ("xw", 0), ("yz", 12), ("yw", 0), ("zw", 0), ("xv", 0), ("yv", 0), ("zv", 0), ("wv", 0)]
FAR = os.path.join(os.environ.get("RENDER_OUT", "out/render"), "ndim")


def run_tests():
    out = ROOT / "data" / "tests.json"
    r = subprocess.run(["node", str(ROOT / "tests" / "known.test.js"), "--json", str(out)], capture_output=True, text=True)
    print(r.stdout.strip(), r.stderr.strip()[:2000])
    if r.returncode:
        raise SystemExit("known-answer tests failed; page not built")
    Path(FAR).mkdir(parents=True, exist_ok=True)
    shutil.copy(out, Path(FAR) / "tests.json")
    return out.read_text(encoding="utf-8")


def knobs():
    out = []
    for k, (plane, v) in enumerate(KNOBS):
        cls = "kn k5" if "v" in plane else "kn"
        hid = " hidden" if "v" in plane else ""
        out.append(f'<span class="{cls}"{hid}><label for="k{k}">Turn {plane}</label>'
                   f'<input id="k{k}" type="range" min="0" max="360" step="1" value="{v}" data-knob data-label="{plane}" data-unit="°"></span>')
    return "".join(out)


def strip():
    return "".join(f'<figure><canvas id="pw{n}" aria-label="{n}D member of the family"></canvas><figcaption id="pwc{n}">{n}D</figcaption></figure>'
                   for n in range(1, 6))


def main():
    tests = run_tests()
    js = "\n".join((ROOT / "src" / f"{f}.js").read_text(encoding="utf-8") for f in LIB)
    js += "\n" + "\n".join((HERE / f"{f}.js").read_text(encoding="utf-8") for f in PAGE)
    js += "\nNToy.init(); NGallery.init(); NFields.init(); NDiagrams.init();\n"
    laws = (ROOT / "data" / "laws.json").read_text(encoding="utf-8")
    t = (HERE / "template.html").read_text(encoding="utf-8")
    for k, v in {"CSS": (HERE / "page.css").read_text(encoding="utf-8"), "KNOBS": knobs(), "STRIP": strip(), "PRO": PRO,
                 "MISSING": MISSING, "DATE": datetime.date.today().isoformat(), "LAWS": laws.replace("</", "<\\/"),
                 "TESTS": tests.replace("</", "<\\/"), "JS": js.replace("</script", "<\\/script")}.items():
        t = t.replace("{{" + k + "}}", v)
    out = ROOT / "ndim.html"
    out.write_text(inline_kit(t, out), encoding="utf-8")
    print("wrote", out, out.stat().st_size)


if __name__ == "__main__":
    main()
