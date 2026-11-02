# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Screenshots of the instrument pages at desktop and phone width, light and dark, plus in-browser checks: a
parameter change reaches the drawing, the schematic and the 3D model; a pick lights the part in every view; no
page errors; no sideways scroll.

    python -I tests/cad_shots.py        writes $RENDER_OUT/instrument-cad/shots/*.png and shots.json
"""
import os
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

PAGES = Path(__file__).resolve().parents[2 if "eda" in __file__ else 1] / "pages"
OUT = Path(os.environ.get("RENDER_OUT", "out/render")) / "instrument-cad" / "shots"
FILES = {"jnt": "cad-jnt.html", "polariscope": "cad-polariscope.html", "room": "cad-room.html", "index": "cad-index.html"}
CHANGE = {"jnt": ["encW", 160, "R", 47000], "polariscope": ["theta", 60, "P", 150], "room": ["L", 7, "T60", 1.2]}

PROBE = """async ([k1, v1, k2, v2, pick]) => {
  const S = CadApp.state, txt = (s) => [...document.querySelectorAll(s)].map((e) => e.textContent).join("|");
  const before = { bp: txt('#bp text[data-dim]'), sch: txt('#sch .s-val'), hash: S.R.hash, parts: S.R.B.parts.length, box: JSON.stringify(S.R.mesh(S.R.B.parts[0].id).pos.length) };
  S.set(k1, v1); S.set(k2, v2); await new Promise((r) => setTimeout(r, 700));
  const after = { bp: txt('#bp text[data-dim]'), sch: txt('#sch .s-val'), hash: S.R.hash, title: txt('#bp text') .includes(S.R.hash), spec: document.querySelector('#spec').textContent.includes(S.R.hash) };
  S.select(pick); await new Promise((r) => setTimeout(r, 200));
  const sel = { bp: document.querySelectorAll('#bp .sel').length, sch: document.querySelectorAll('#sch .sel').length, bom: document.querySelectorAll('tr.sel').length, threeD: S.view.selected };
  return { before, after, sel, problems: S.R.problems };
}"""
VIEW = """async ([ex, cut]) => { const e = document.getElementById('explode'); e.value = ex; e.dispatchEvent(new Event('input'));
  const c = document.getElementById('cut-on'); c.checked = cut; c.dispatchEvent(new Event('change')); await new Promise((r) => setTimeout(r, 400)); }"""
PICK = {"jnt": "U1", "polariscope": "disc", "room": "laptop"}


async def shoot(b, i, w, h, tag, scheme, rec):
    ctx = await b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, reduced_motion="reduce")
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.on("console", lambda m: errs.append("console: " + m.text[:300]) if m.type == "error" else None)
    await pg.goto((PAGES / FILES[i]).as_uri())
    await pg.wait_for_timeout(1800)
    name = f"{i}-{tag}-{scheme}"
    r = rec.setdefault(i, {}).setdefault(f"{tag}-{scheme}", {})
    await pg.screenshot(path=str(OUT / f"{name}-first.png"))
    if i != "index":
        await pg.evaluate(VIEW, [70, False])
        await pg.locator("#stage").screenshot(path=str(OUT / f"{name}-3d-exploded.png"))
        await pg.evaluate(VIEW, [0, True])
        await pg.locator("#stage").screenshot(path=str(OUT / f"{name}-3d-cut.png"))
        await pg.locator(".cad-sheet-wrap").screenshot(path=str(OUT / f"{name}-drawing.png"))
        await pg.locator("#sch").screenshot(path=str(OUT / f"{name}-schematic.png"))
        await pg.locator("#cv-phys").screenshot(path=str(OUT / f"{name}-physics.png"))
        if tag == "desk" and scheme == "light":
            r["probe"] = await pg.evaluate(PROBE, CHANGE[i] + [PICK[i]])
            await pg.locator(".cad-sheet-wrap").screenshot(path=str(OUT / f"{name}-drawing-changed.png"))
            await pg.locator("#stage").screenshot(path=str(OUT / f"{name}-3d-changed-picked.png"))
    await pg.screenshot(path=str(OUT / f"{name}-page.png"), full_page=True)
    r["errors"] = errs
    r["scroll_x"] = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
    await ctx.close()


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rec = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--allow-file-access-from-files", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for i in FILES:
            for w, h, tag in ((1440, 1000, "desk"), (390, 844, "phone")):
                for scheme in ("light", "dark"):
                    await shoot(b, i, w, h, tag, scheme, rec)
            print(i, json.dumps(rec[i])[:900])
        await b.close()
    (OUT / "shots.json").write_text(json.dumps(rec, indent=1))


if __name__ == "__main__":
    asyncio.run(main())
