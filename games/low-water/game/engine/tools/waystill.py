"""Stills of a fight's ways through as a player sees them (ui/fightways.mjs): the lamplighters on the
quay, Lamb standing still (no blows), at 2 s (the ways out chalked on the ground) and at 5.5 s (the
warrant's talk exit open: the tell over Lamb and the offer with its Composure line), in painted and
glyph modes.
    python game/engine/tools/waystill.py --port 8771 --out game/capture/ways-2026-10-21
"""
import argparse, time
from pathlib import Path
from playwright.sync_api import sync_playwright

START = """() => { const c = window.__lw, p = c.play; c.G.loop.paused = true; p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop');
  const i = p.P.beat.options.findIndex((o) => /Stand your ground/.test(o.label)); p.choose(i); return i; }"""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=8771); ap.add_argument("--out", required=True)
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--disable-gpu"])
        for look in ["", "glyph"]:
            pg = b.new_page(viewport={"width": 1920, "height": 1080}); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(f"http://127.0.0.1:{a.port}/engine/play.html?capture=1&content=act1" + (f"&look={look}" if look else ""))
            pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw", timeout=120000)
            pg.evaluate("""() => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.condoler', enter: false }); c.G.setPlace('quay'); c.G.state.pos = [3.3, 0, -2.3]; c.play(); if (c.play.P.talk) { c.play.P.talk = null; c.play.P.beat = null; c.play.render(); } }""")
            pg.wait_for_function("(() => { const p = window.__lw.play; return p && p.cam.ready() && !!p.cam.arena(); })()", timeout=120000)
            time.sleep(1.5)
            pg.evaluate(START); time.sleep(0.8)
            name = look or "painted"
            for secs, tag in [(2, "ways"), (5.6, "talk")]:
                pg.evaluate(f"() => {{ const G = window.__lw.G, W = G.ext.combat.current && G.ext.combat.current.W; while (W && !W.result && W.tick < {int(secs * 60)}) G.loop.step(); }}")
                time.sleep(0.9); pg.screenshot(path=str(out / f"{name}-{tag}.png"))
                print(name, tag, pg.evaluate("() => { const W = window.__lw.G.ext.combat.current && window.__lw.G.ext.combat.current.W; return W ? { tick: W.tick, talk: W.talk && W.talk.node, exits: W.field.arena.exits.length, result: W.result } : null; }"), errs[:2])
            pg.close()
        b.close()

if __name__ == "__main__": main()
