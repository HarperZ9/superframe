# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Screenshots of every diagram page at desktop and phone width, assembled, exploded and sectioned, plus an
in-browser determinism check (the CPU frame at one t, scrubbed away and back, hashes the same).

    python -I tests/shots.py [id ...]       writes $RENDER_OUT/diagram/shots/*.png and shots.json
"""
import os
import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

PAGES = Path(__file__).resolve().parents[2 if "eda" in __file__ else 1] / "pages"
OUT = Path(os.environ.get("RENDER_OUT", "out/render")) / "diagram" / "shots"
FILES = {"wien": "wien-lamp.html", "cesium": "cesium-beam.html", "sampling": "equivalent-time.html", "cordic": "cordic.html",
         "gpib": "gpib-handshake.html", "guard": "guard.html", "trace": "traceability.html", "index": "index.html"}

SET = """async ([ex, cut, overlay, path]) => {
  const S = window.DApp && DApp.state; if (!S) return null;
  const el = (id) => document.getElementById(id);
  el('explode').value = ex; el('explode').dispatchEvent(new Event('input'));
  el('cut-on').checked = cut; el('cut-on').dispatchEvent(new Event('change'));
  el('overlay').value = overlay; el('overlay').dispatchEvent(new Event('change'));
  if (path) document.querySelector('[data-path="' + path + '"]').click();
  S.render(); await new Promise(r => setTimeout(r, 450));
  return document.getElementById('lens-3d').textContent;
}"""

DET = """async () => {
  const S = DApp.state; document.querySelector('[data-path="cpu"]').click();
  const at = async (u) => { S.ui.u = u; S.render(); await new Promise(r => setTimeout(r, 60)); return S.stage.frameHash(); };
  const a = await at(0.4); await at(0.85); await at(0.1); const b = await at(0.4);
  document.querySelector('[data-path="gpu"]').click();
  return { a, b, same: a === b, gl: S.stage.hasGL };
}"""


async def main(ids):
    OUT.mkdir(parents=True, exist_ok=True)
    rec = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--allow-file-access-from-files", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for i in ids:
            url = (PAGES / FILES[i]).as_uri()
            for w, h, tag in ((1440, 1000, "desk"), (390, 844, "phone")):
                ctx = await b.new_context(viewport={"width": w, "height": h}, reduced_motion="reduce")
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
                pg.on("console", lambda m: errs.append("console: " + m.text[:200]) if m.type == "error" else None)
                await pg.goto(url)
                await pg.wait_for_timeout(1500)
                r = rec.setdefault(i, {})
                if i == "index":
                    await pg.screenshot(path=str(OUT / f"{i}-{tag}.png"), full_page=tag == "desk")
                    r[tag] = {"errors": errs}
                    await ctx.close()
                    continue
                shots = {}
                for name, args in (("assembled", [0, False, "", None]), ("exploded", [100, False, "", None]), ("section", [0, True, "", None]),
                                   ("exploded-line", [100, False, "", "line"]), ("thermal", [0, True, "thermal", "gpu"]), ("current", [40, False, "current", "gpu"])):
                    if tag == "phone" and name in ("exploded-line", "current"):
                        continue
                    shots[name] = await pg.evaluate(SET, args)
                    await pg.locator("#toy").screenshot(path=str(OUT / f"{i}-{tag}-{name}.png"))
                if tag == "desk":
                    await pg.evaluate(SET, [0, True, "", "gpu"])
                    await pg.screenshot(path=str(OUT / f"{i}-{tag}-page.png"), full_page=True)
                    r["determinism"] = await pg.evaluate(DET)
                r[tag] = {"errors": errs, "lens": shots, "scroll_x": await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")}
                await ctx.close()
            print(i, json.dumps(rec[i])[:600])
        await b.close()
    old = json.loads((OUT / "shots.json").read_text()) if (OUT / "shots.json").exists() else {}
    old.update(rec)
    (OUT / "shots.json").write_text(json.dumps(old, indent=1))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or list(FILES)))
