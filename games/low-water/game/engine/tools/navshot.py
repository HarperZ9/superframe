import json, time, sys
from playwright.sync_api import sync_playwright
out = sys.argv[1]
shots = [("quay", "act1", "quay", [-1.2, 0, -2.6], [12.0, 0, -2.3]), ("brine", "act1", "brine", [4.9, 0, 1.2], [-3.4, 0, 0.6]), ("weigh", "act1", "weigh_in", [3.0, 0, -3.6], [-3.0, 0, 2.2])]
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=["--disable-gpu"])
    for name, content, place, pos, goal in shots:
        pg = b.new_page(viewport={"width": 1920, "height": 1080}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:8771/engine/play.html?capture=1&content={content}&debug=nav")
        pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw", timeout=120000)
        pg.evaluate("""(s) => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace(s.place); c.G.state.pos = s.pos; c.play(); if (c.play.P.talk) { c.play.P.talk = null; c.play.P.beat = null; c.play.render(); } }""", {"place": place, "pos": pos})
        pg.wait_for_function("(() => { const p = window.__lw.play; return p && p.cam.ready() && !!p.cam.arena(); })()", timeout=120000)
        time.sleep(2)
        ok = pg.evaluate(f"window.__lw.play.people.walkTo({json.dumps(goal)})")
        time.sleep(0.6); pg.screenshot(path=f"{out}/nav-{name}.png"); print(name, "walk", ok, errs); pg.close()
    b.close()
