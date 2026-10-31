# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Screenshots of the board page and the matrix page at desktop and phone width, light and dark, with page
errors, sideways scroll and the 3D view's renderer recorded.

    python -I eda/tests/eda_shots.py      writes $RENDER_OUT/eda/shots/*.png and shots.json
"""
import os
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

PAGES = Path(__file__).resolve().parents[2 if "eda" in __file__ else 1] / "pages"
OUT = Path(os.environ.get("RENDER_OUT", "out/render")) / "eda" / "shots"
FILES = {"board": "eda-jnt.html", "matrix": "phenomena-matrix.html"}


async def shoot(b, key, w, h, tag, scheme, rec):
    ctx = await b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, reduced_motion="reduce")
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.on("console", lambda m: errs.append("console: " + m.text[:300]) if m.type == "error" else None)
    await pg.goto((PAGES / FILES[key]).as_uri())
    await pg.wait_for_timeout(1500)
    name = f"{key}-{tag}-{scheme}"
    r = {}
    await pg.screenshot(path=str(OUT / f"{name}-first.png"))
    if key == "board":
        r["renderer"] = await pg.evaluate("document.getElementById('b3d-path').textContent")
        vis = "#b3d" if await pg.evaluate("!document.getElementById('b3d').hidden") else "#b3d-cpu"
        await pg.locator(vis).screenshot(path=str(OUT / f"{name}-3d.png"))
        await pg.uncheck("#b3d-mask")
        await pg.click("#b3d-top")
        await pg.wait_for_timeout(300)
        await pg.locator(vis).screenshot(path=str(OUT / f"{name}-3d-copper-top.png"))
    else:
        await pg.click('button[data-cell="solid.electricity"]')
        await pg.wait_for_timeout(200)
        r["detail"] = (await pg.locator("#mx-detail").inner_text())[:200]
        await pg.locator("#mx-detail").screenshot(path=str(OUT / f"{name}-detail.png"))
    await pg.screenshot(path=str(OUT / f"{name}-page.png"), full_page=True)
    r["errors"] = errs
    r["scroll_x"] = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
    rec[name] = r
    await ctx.close()


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rec = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--allow-file-access-from-files", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for k in FILES:
            for w, h, tag in ((1440, 1000, "desk"), (390, 844, "phone")):
                for scheme in ("light", "dark"):
                    await shoot(b, k, w, h, tag, scheme, rec)
        await b.close()
    (OUT / "shots.json").write_text(json.dumps(rec, indent=1))
    print(json.dumps(rec, indent=1))


if __name__ == "__main__":
    asyncio.run(main())
