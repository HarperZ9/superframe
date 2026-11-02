# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build the thermometer board page : run the sim, chain and board tests, run the
chain, then inline the engine, the eda layer, the results and the site kit.

    python -I eda/page/build.py [--skip-run]
"""
import os
import base64
import datetime
import html
import json
import math
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
EDA = HERE.parent
ROOT = EDA.parent
sys.path.insert(0, os.environ.get("SITE_KIT", "site-kit"))  # the site repo's system/kit
from inline import inline_kit  # noqa: E402

OUT = ROOT / "pages"
DATA = EDA / "data"
FAR = Path(os.environ.get("RENDER_OUT", "out/render")) / "eda"
ENGINE = ["core", "raster", "gl"]
EDASRC = ["geom", "footprints", "board", "autoroute", "font", "view2d", "render3d"]
E = html.escape
TODAY = datetime.date.today().isoformat()


def read(p):
    return Path(p).read_text(encoding="utf-8")


def run(args):
    r = subprocess.run([str(a) for a in args], capture_output=True, text=True)
    print(r.stdout.strip()[-300:], r.stderr.strip()[-1500:])
    if r.returncode:
        raise SystemExit("failed: " + " ".join(map(str, args)))


def fmt(v, d=4):
    return "unknown" if v is None else f"{v:.{d}g}"


def chart(series, xlab, ylab, logx=True, logy=True, w=640, h=300):
    """Inline SVG line chart in kit tokens; series: [(name, xs, ys, cls)]."""
    pad = (52, 14, 16, 40)
    xs = [x for s in series for x in s[1] if (x > 0 or not logx)]
    ys = [y for s in series for y in s[2] if (y > 0 or not logy)]
    fx = (lambda v: math.log10(v)) if logx else (lambda v: v)
    fy = (lambda v: math.log10(v)) if logy else (lambda v: v)
    x0, x1, y0, y1 = fx(min(xs)), fx(max(xs)), fy(min(ys)), fy(max(ys))
    if y1 - y0 < 1e-12:
        y1 = y0 + 1
    X = lambda v: pad[0] + (fx(v) - x0) / (x1 - x0) * (w - pad[0] - pad[1])  # noqa: E731
    Y = lambda v: h - pad[3] - (fy(v) - y0) / (y1 - y0) * (h - pad[2] - pad[3])  # noqa: E731
    o = [f'<svg viewBox="0 0 {w} {h}" class="eda-chart" role="img" aria-label="{E(ylab)} against {E(xlab)}">']
    o.append(f'<line class="ax" x1="{pad[0]}" y1="{h - pad[3]}" x2="{w - pad[1]}" y2="{h - pad[3]}"/><line class="ax" x1="{pad[0]}" y1="{pad[2]}" x2="{pad[0]}" y2="{h - pad[3]}"/>')
    if logx:
        for k in range(math.ceil(x0), math.floor(x1) + 1):
            o.append(f'<line class="gr" x1="{X(10**k):.1f}" y1="{pad[2]}" x2="{X(10**k):.1f}" y2="{h - pad[3]}"/><text class="tk" x="{X(10**k):.1f}" y="{h - pad[3] + 16}" text-anchor="middle">1e{k}</text>')
    if logy:
        for k in range(math.ceil(y0), math.floor(y1) + 1):
            o.append(f'<text class="tk" x="{pad[0] - 6}" y="{Y(10**k) + 4:.1f}" text-anchor="end">1e{k}</text>')
    else:
        for v in (min(ys), max(ys)):
            o.append(f'<text class="tk" x="{pad[0] - 6}" y="{Y(v) + 4:.1f}" text-anchor="end">{v:.3g}</text>')
        if not logx:
            for v in (min(xs), max(xs)):
                o.append(f'<text class="tk" x="{X(v):.1f}" y="{h - pad[3] + 16}" text-anchor="middle">{v:.3g}</text>')
    for name, sx, sy, cls in series:
        pts = " ".join(f"{X(a):.1f},{Y(b):.1f}" for a, b in zip(sx, sy) if (a > 0 or not logx) and (b > 0 or not logy))
        o.append(f'<polyline class="{cls}" points="{pts}"><title>{E(name)}</title></polyline>')
    o.append(f'<text class="lb" x="{w / 2}" y="{h - 4}" text-anchor="middle">{E(xlab)}</text><text class="lb" x="12" y="{h / 2}" transform="rotate(-90 12 {h / 2})" text-anchor="middle">{E(ylab)}</text></svg>')
    return "".join(o)


def img(name):
    return "data:image/png;base64," + base64.b64encode((FAR / name).read_bytes()).decode()


CSS = """
.eda-chart{width:100%;height:auto;max-width:720px}.eda-chart .ax{stroke:var(--ink);stroke-width:1}.eda-chart .gr{stroke:var(--line);stroke-width:.5}
.eda-chart .tk,.eda-chart .lb{fill:var(--soft);font:400 11px var(--face-utility)}.eda-chart polyline{fill:none;stroke-width:2}
.eda-chart .s1{stroke:var(--red)}.eda-chart .s2{stroke:var(--navy)}.eda-chart .s3{stroke:var(--ochre);stroke-dasharray:5 4}
.eda-fig{margin:var(--sp-3) 0}.eda-fig img,.eda-fig svg{width:100%;height:auto;display:block;border:1px solid var(--line)}
.eda-pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--sp-3)}
.eda-3d{position:relative;width:100%}.eda-3d canvas{display:block;width:100%;touch-action:none;border:1px solid var(--line)}
.eda-bar{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin-top:var(--sp-2)}
table.eda{border-collapse:collapse;width:100%;font-size:var(--fs-2)}table.eda th,table.eda td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
table.eda td.num{font-family:var(--face-utility);text-align:right;white-space:nowrap}
.v-pass{color:var(--verified)}.v-gap{color:var(--drift)}
.mx{display:grid;grid-template-columns:minmax(84px,auto) repeat(8,minmax(58px,1fr));gap:3px;min-width:640px}
.mx .h{font:600 var(--fs-2)/1.2 var(--face-utility);color:var(--soft);padding:4px}
.mx button{all:unset;cursor:pointer;min-height:44px;padding:6px;border:1px solid var(--line);font:500 12px/1.2 var(--face-utility);color:var(--ink);display:flex;flex-direction:column;justify-content:space-between}
.mx button:focus-visible{outline:3px solid var(--navy);outline-offset:1px}
.mx button[aria-pressed="true"]{box-shadow:inset 0 0 0 3px var(--ink)}
.mx .st-measured,.mx .st-analytic{background:color-mix(in srgb,var(--verified) 22%,transparent)}
.mx .st-smoke,.mx .st-untested,.mx .st-visual{background:color-mix(in srgb,var(--ochre) 24%,transparent)}
.mx .st-none{background:color-mix(in srgb,var(--drift) 18%,transparent)}
.mx-key{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:var(--fs-2);margin:var(--sp-2) 0}.mx-key span::before{content:"";display:inline-block;width:12px;height:12px;margin-right:6px;vertical-align:-1px;border:1px solid var(--line)}
.mx-key .k-ok::before{background:color-mix(in srgb,var(--verified) 40%,transparent)}.mx-key .k-weak::before{background:color-mix(in srgb,var(--ochre) 45%,transparent)}.mx-key .k-none::before{background:color-mix(in srgb,var(--drift) 35%,transparent)}
#mx-detail{min-height:8em}#mx-detail code{word-break:break-all;font-size:12px}
ol.gaps li{margin-bottom:var(--sp-2)}
"""


def page(title, sup, lede, body, out, js="", region="print"):
    t = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{E(title)}</title>
<!-- Built by packages/diagram/eda/page/build.py. Style: the site's system/kit, inlined between the markers. -->
<!-- site-kit:begin --><!-- site-kit:end --><style>{read(ROOT / "page" / "page.css")}{CSS}</style></head>
<body data-region="{region}"><main class="k-page"><header class="k-head"><p class="k-super" aria-hidden="true">{E(sup)}</p><h1>{E(title)}</h1>
<p class="k-lede">{E(lede)}</p><hr class="k-horizon"></header>{body}
<p class="k-meta k-foot">Built {TODAY} by packages/diagram/eda/page/build.py.</p></main>{js}</body></html>"""
    out.write_text(inline_kit(t, out), encoding="utf-8")
    print("wrote", out, out.stat().st_size)


def tests_line(name, t):
    return f"{name}: {t['pass']} pass, {t['fail']} fail; {t['planted_rejected']} planted errors refused, {t['planted_accepted']} accepted."


def board_page(res, board, mat, tests):
    s, b = res["sim"], res["board"]
    bu, sp = s["budget"], s["budget"]["spec"]
    th = s["thermometry"]
    rows = [
        ("Mid-band gain", "2000", fmt(s["gain"]["peak"], 5), "finite open-loop gain and GBW (from memory, unverified)"),
        ("High-pass corner", "300 Hz", f"{s['gain']['lo3']:.1f} Hz", f"netlist's rounded C1 puts the corner at {s['gain']['fHPfromNetlist']:.1f} Hz"),
        ("Resistor noise at the input", f"{sp['eR'] * 1e9:.3f} nV/rtHz", f"{bu['eRin'] * 1e9:.3f} nV/rtHz", "4kTR"),
        ("Amplifier to resistor power, a", fmt(sp["a"]), fmt(bu["a"]), f"op-amp term alone {fmt(bu['terms']['U1A'])}; gain resistor RG1 adds {fmt(bu['terms']['RG1'])}"),
        ("Correlated excess", fmt(sp["corr"]), fmt(bu["corr"]), "relay contact resistance in series with R, and both amplifiers' i_n R"),
        ("Uncertainty at 60 s", f"{sp['rel'] * 100:.4f} %", f"{bu['relSpecForm'] * 100:.4f} %", f"cross-spectrum form gives {bu['relCross'] * 100:.4f} %"),
        ("Re Z droop at band top", fmt(s["reZdroop"]["spec"]), fmt(s["reZdroop"]["sim"]), f"(R + 0.1 Ohm contact) || C_in gives {fmt(s['reZdroop']['withContact'])}"),
        ("High-pass settle to 0.1 %", f"{s['settle']['spec'] * 1e3:.3f} ms", f"{s['settle']['sim'] * 1e3:.3f} ms", "transient, BDF2, 1 us steps"),
        ("Temperature read from simulated noise", "300 K", f"{th['T']:.2f} +- {th['sigmaT']:.2f} K", f"{th['nseg']} segments of {th['tseg'] * 1e3:.1f} ms each run, ratio to the 273.15 K reference"),
        ("Input trace copper (from the routed board)", "not in the spec", f"{b['backAnnotated']['inTraceOhms'] * 1e3:.1f} mOhm", f"a moves from {fmt(b['backAnnotated']['aWithout'], 6)} to {fmt(b['backAnnotated']['a'], 6)}"),
    ]
    spec_tbl = "".join(f"<tr><td>{E(a)}</td><td class='num'>{E(x)}</td><td class='num'>{E(y)}</td><td>{E(n)}</td></tr>" for a, x, y, n in rows)
    terms = sorted(((k, v) for k, v in bu["terms"].items() if v > 1e-9), key=lambda kv: -kv[1])
    term_tbl = "".join(f"<tr><td>{E(k)}</td><td class='num'>{v:.3e}</td></tr>" for k, v in terms)
    gfs, gm = s["curves"]["fs"], s["curves"]["mag"]
    gain_svg = chart([("OUT_A / INJ", gfs, gm, "s1")], "Hz", "gain")
    st = s["curves"]["settle"]
    settle_svg = chart([("OUT_A after a 1 uV step", [t * 1e3 for t in st["t"]], [v * 1e3 for v in st["v"]], "s2")], "ms", "mV", logx=False, logy=False)
    from_board = (FAR / "board-3d-angle.png").exists()
    trips = "".join(f"<tr><td><code>{E(t['file'])}</code></td><td>{E(t['kind'])}</td><td class='{'v-pass' if t['ok'] else 'v-gap'}'>{'reads back' if t['ok'] else 'differs'}</td></tr>" for t in res["fab"]["trips"])
    cmp = res["compare"]
    data = json.dumps({"board": board, "materials": mat}).replace("</", "<\\/")
    svg = read(EDA / "out" / "jnt" / "board.svg").split("\n", 1)[1]
    svg = svg.replace(f'width="{board["w"] * 4}" height="{board["h"] * 4}" ', "")
    body = f"""
<section class="k-layer" data-layer="toy" id="toy" aria-labelledby="toy-h"><div class="k-layer-head"><h2 id="toy-h">The board</h2><span class="k-depth">toy</span></div>
<div class="eda-3d"><canvas id="b3d" role="img" aria-label="Thermometer board, 3D: FR-4, copper under green solder mask, gold pads, white silkscreen"></canvas><canvas id="b3d-cpu" hidden role="img" aria-label="Thermometer board, 3D"></canvas></div>
<div class="eda-bar k-controls"><label class="check"><input id="b3d-mask" type="checkbox" checked> Solder mask</label><button type="button" id="b3d-iso">Angle</button><button type="button" id="b3d-top">Top</button><button type="button" id="b3d-under">Underside</button><span class="k-meta">Drawn by <span id="b3d-path"></span>.</span></div>
<figure class="eda-fig">{svg}<figcaption class="k-meta">Top view from the same geometry: red top copper, tan bottom pours (two ground islands), gold pads, white silkscreen.</figcaption></figure>
</section>
<p class="k-message">One model of the thermometer gives its schematic, its simulated noise budget, its routed board and its fab files.</p>
<section class="k-layer" data-layer="plain" id="plain" aria-labelledby="plain-h"><div class="k-layer-head"><h2 id="plain-h">Spec sheet against simulation</h2><span class="k-depth">plain</span></div>
<div class="k-scroll"><table class="eda"><thead><tr><th scope="col">Quantity</th><th scope="col">Spec sheet</th><th scope="col">Simulation</th><th scope="col">Why they differ</th></tr></thead><tbody>{spec_tbl}</tbody></table></div>
<figure class="eda-fig">{gain_svg}<figcaption class="k-meta">Gain from the injection socket to chain A's output, AC sweep of the netlist.</figcaption></figure>
<figure class="eda-fig">{settle_svg}<figcaption class="k-meta">Chain A after a 1 uV step at the injection socket: the high-pass decays to 0.1 percent of its peak in {s['settle']['sim'] * 1e3:.3f} ms.</figcaption></figure>
<h3>Noise terms, each over the resistor's own (band 1 to 10 kHz, chain A)</h3>
<div class="k-scroll"><table class="eda"><thead><tr><th scope="col">Source</th><th scope="col">Share</th></tr></thead><tbody>{term_tbl}</tbody></table></div>
</section>
<section class="k-layer" data-layer="pro" id="pro" aria-labelledby="pro-h"><div class="k-layer-head"><h2 id="pro-h">Fab files and checks</h2><span class="k-depth">pro</span></div>
<p>{b['parts']} parts, {b['nets']} nets, {b['traces']} track segments, {b['vias']} vias, {b['pourRects']} pour rectangles. DRC: {b['drc']['errors']} errors over {b['drc']['objects']} copper objects.</p>
<div class="k-scroll"><table class="eda"><thead><tr><th scope="col">File</th><th scope="col">Format</th><th scope="col">Round trip</th></tr></thead><tbody>{trips}</tbody></table></div>
<p>Top copper Gerber rendered back at 25 px/mm: {cmp['F_Cu']['xor']} of {cmp['F_Cu']['copper']} pixels differ from the board view, all on edges ({cmp['F_Cu']['thick']} in solid patches). Bottom: {cmp['B_Cu']['xor']} of {cmp['B_Cu']['copper']}.</p>
<div class="eda-pair"><figure class="eda-fig"><img src="{img('board-view-F_Cu.png')}" alt="Top copper rasterised from the board geometry"><figcaption class="k-meta">Board view, top copper</figcaption></figure>
<figure class="eda-fig"><img src="{img('gerber-back-F_Cu.png')}" alt="Top copper read back from its Gerber file and rasterised"><figcaption class="k-meta">Gerber read back, top copper</figcaption></figure></div>
<p>{E(tests_line('Simulator', tests['sim']))} {E(tests_line('Thermometer chain', tests['jnt']))} {E(tests_line('Board and fab', tests['eda']))}</p>
<div class="prose"><p>The simulator is modified nodal analysis: DC by Newton with junction step limiting, AC as one complex solve per frequency, transient by backward Euler for the first step and then trapezoidal or BDF2, noise by solving every source's transfer to the output and summing powers (and the cross-spectrum for two outputs). Resistors carry 4kT/R at their own temperature, diodes 2qI, the op-amp macro e_n and i_n. The router is A* on a 0.2 mm grid over two layers with eight headings, a turn penalty and vias; the DRC works on vector shapes and is the judge. Gerber RS-274X, Excellon, pick-and-place and BOM CSV and the outline DXF are written and read here. KiCad export stays an optional interchange path.</p>
<p>Not verified: footprint land sizes and the op-amp and relay values are from memory; FR-4 and solder-mask colours are assumed because the materials library has no record for them; ngspice is not installed, so no differential check against it ran; no board has been fabricated.</p></div>
</section>"""
    js = "<script type=\"application/json\" id=\"eda-data\">" + data + "</script><script>" + ("\n".join(read(ROOT / "src" / f"{f}.js") for f in ENGINE) + "\n" + "\n".join(read(EDA / "src" / f"{f}.js") for f in EDASRC) + "\n" + read(HERE / "app.js")).replace("</script", "<\\/script") + "</script>"
    body = body.replace("<svg ", '<svg style="width:100%;height:auto" ', 1) + f"<style>{read_css_board()}</style>"
    page("Thermometer board", "kT", "The Johnson-noise thermometer from schematic to simulation to routed board to fab files, all from one model, with no outside EDA.", body, OUT / "eda-jnt.html", js)


def read_css_board():
    r = subprocess.run(["node", "-e", "const {E}=require(" + json.dumps(str(EDA / "load.js")) + ");process.stdout.write(E.BOARD_SVG_CSS)"], capture_output=True, text=True, check=True)
    return r.stdout



def main():
    if "--skip-run" not in sys.argv:
        run(["node", ROOT / "sim" / "tests" / "sim.test.js", "--json", DATA / "sim-tests.json"])
        run(["node", ROOT / "sim" / "tests" / "jnt.test.js", "--json", DATA / "jnt-tests.json"])
        run(["node", EDA / "tests" / "eda.test.js", "--json", DATA / "eda-tests.json"])
        run(["python", "-I", EDA / "build" / "board_materials.py"])
        run(["node", EDA / "run-jnt.js"])
    res, board, mat = (json.loads(read(DATA / f)) for f in ("jnt-chain.json", "jnt-board.json", "board-materials.json"))
    tests = {k: json.loads(read(DATA / f"{k}-tests.json")) for k in ("sim", "jnt", "eda")}
    board_page(res, board, mat, tests)


if __name__ == "__main__":
    main()
