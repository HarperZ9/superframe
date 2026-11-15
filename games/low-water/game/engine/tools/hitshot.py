import json, time, sys
from playwright.sync_api import sync_playwright
out = sys.argv[1]
LIVE = """() => { const W = window.__lw.G.ext.combat.world || (window.__lw.G.ext.combat.current && window.__lw.G.ext.combat.current()); return null; }"""
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=["--disable-gpu"]); pg = b.new_page(viewport={"width": 1920, "height": 1080}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:8771/engine/play.html?capture=1&content=act1&debug=hits")
    pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw", timeout=120000)
    pg.evaluate("""() => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace('quay'); c.G.state.pos = [3.3, 0, -2.3]; c.play(); if (c.play.P.talk) { c.play.P.talk = null; c.play.P.beat = null; c.play.render(); } }""")
    pg.wait_for_function("(() => { const p = window.__lw.play; return p && p.cam.ready() && !!p.cam.arena(); })()", timeout=120000)
    time.sleep(1.5)
    pg.evaluate("""() => { const c = window.__lw, p = c.play; c.G.loop.paused = true; p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop'); const i = p.P.beat.options.findIndex((o) => /Stand your ground/.test(o.label)); p.choose(i); }""")
    time.sleep(1.0)
    print(pg.evaluate("() => Object.keys(window.__lw.G.ext.combat)"))
    n = 0
    for k in range(900):
        pg.evaluate("() => window.__lw.G.loop.step()")
        st = pg.evaluate("""() => { const C = window.__lw.G.ext.combat, W = C.current && C.current.W; if (!W || !W.fighters) return null; return W.fighters.filter(F => F.act).map(F => { const m = W.moves[F.act.id]; return { id: F.id, mv: F.act.id, f: F.act.f, live: m.hits.some(h => F.act.f >= h.at[0] && F.act.f <= h.at[1]) }; }); }""")
        if st is None and k == 0: print("no world handle"); break
        if st and any(x["live"] for x in st) and k % 3 == 0:
            time.sleep(0.15); pg.screenshot(path=f"{out}/hits-{n}.png"); print(k, st); n += 1
            if n >= 3: break
    print("errors", errs); b.close()
