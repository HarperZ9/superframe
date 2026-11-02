# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Open perceive.html in headless Chromium, visit every view at desktop and phone width, record page errors and
each view's text equivalents, and save screenshots to $RENDER_OUT/perceive/.

    python -I tests/shots.py
"""
import os
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

PAGE = (Path(__file__).resolve().parent.parent / "perceive.html").as_uri()
OUT = Path(os.environ.get("RENDER_OUT", "out/render")) / "perceive"
VIEWS = ["bb", "h", "na", "au", "mat", "bat", "rings", "elec", "mag", "pol", "heat", "geo", "dims", "laws"]


async def run():
    OUT.mkdir(parents=True, exist_ok=True)
    rec = {"errors": [], "views": {}}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, vp in (("desktop", {"width": 1440, "height": 1000}), ("phone", {"width": 390, "height": 844})):
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if name == "phone" else 1, reduced_motion="no-preference")
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e, n=name: rec["errors"].append(f"{n}: {e}"))
            pg.on("console", lambda m, n=name: rec["errors"].append(f"{n} console: {m.text}") if m.type == "error" else None)
            await pg.goto(PAGE, wait_until="load")
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=str(OUT / f"{name}-first.png"))
            for v in VIEWS:
                await pg.select_option("#pick", v)
                await pg.wait_for_timeout(500)
                el = pg.locator("#toy")
                await el.screenshot(path=str(OUT / f"{name}-{v}.png"))
                if name == "desktop":
                    rec["views"][v] = await pg.evaluate("({desc: document.querySelector('#desc').textContent, sound: document.querySelector('#sound-text').textContent, bits: document.querySelector('#lp-bits').textContent})")
            sw = await pg.evaluate("document.documentElement.scrollWidth - innerWidth")
            rec[name + "_sideways_px"] = sw
            await ctx.close()
        await b.close()
    (OUT / "shots.json").write_text(json.dumps(rec, indent=1), encoding="utf-8")
    print(json.dumps({"errors": rec["errors"][:20], "desktop_sideways": rec.get("desktop_sideways_px"), "phone_sideways": rec.get("phone_sideways_px")}, indent=1))


asyncio.run(run())
