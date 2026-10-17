"""One continuous scene in the engine shell, captured headless (no GPU, no window).

    python game/engine/tools/scene_capture.py --port 8742 --out <dir>

Opens play.html?capture=1 (Act 1 with the area wiring) through a running game/serve.mjs, puts
Lamb on Lamp Quay, and plays: a walk to the lamplighters, their conversation (the capture opens
it at quay.lamplighters.stop, which the script reaches from Gorm in play), "Stand your ground"
into the in-world fight on the same plate (Lamb played by combat's scripted pilot; foes by combat's AI), the
fight's outcome in the talk panel, the panel closed, and a walk on. Writes a video of the whole
run (Playwright's recorder), stills at each beat, and a log of what the page reported.
"""
import argparse, json, time
from pathlib import Path

JS_STATE = """() => { const c = window.__lw, p = c && c.play; if (!p) return null;
  const G = c.G, cam = p.cam, L = G.state.pos;
  return { area: G.state.area, place: G.state.place, pos: L && L.map(v => +v.toFixed(2)), ready: cam.ready(), ground: !!cam.arena(),
    walking: p.people.walking(), talking: !!p.P.talk, fighting: p.root.classList.contains('fighting'),
    options: p.P.beat && p.P.beat.options ? p.P.beat.options.map(o => o.label) : null, done: !!(p.P.beat && p.P.beat.done),
    clock: G.clock(), figures: p.people.figures().map(f => f.who) }; }"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8754)
    ap.add_argument("--out", required=True)
    ap.add_argument("--figures", default="", help="plain for the ink figures")
    ap.add_argument("--scene", default="fight", help="fight (walk, talk, fight, walk) or live (talk while the world runs, then walk off)")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    log = []
    def note(*x):
        s = " ".join(str(v) for v in x); log.append(s); print(s, flush=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--disable-gpu", "--disable-gpu-compositing", "--disable-gpu-rasterization"])
        ctx = b.new_context(viewport={"width": 1280, "height": 720}, record_video_dir=str(out), record_video_size={"width": 1280, "height": 720})
        pg = ctx.new_page()
        pg.on("console", lambda m: log.append(f"console.{m.type}: {m.text}"))
        pg.on("pageerror", lambda e: note("PAGEERROR", e))
        pg.on("response", lambda r: note("HTTP", r.status, r.url) if r.status >= 400 else None)
        q = "capture=1" + (f"&figures={a.figures}" if a.figures else "")
        pg.goto(f"http://127.0.0.1:{a.port}/engine/play.html?{q}")
        pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw", timeout=120000)
        pg.evaluate("""() => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false });
          c.G.setPlace('quay'); c.G.state.pos = [-6.2, 0, -2.3]; c.play(); if (c.play.P.talk) { c.play.P.talk = null; c.play.P.beat = null; c.play.render(); } }""")
        pg.wait_for_function("(() => { const p = window.__lw.play; return p && p.cam.ready() && !!p.cam.arena(); })()", timeout=180000)
        st = lambda: pg.evaluate(JS_STATE)
        def still(name): pg.screenshot(path=str(out / f"{name}.png")); note("still", name, json.dumps(st()))
        def wait(cond, secs):
            t0 = time.time()
            while time.time() - t0 < secs:
                if pg.evaluate(f"(() => {{ const p = window.__lw.play; return {cond}; }})()"): return True
                time.sleep(0.2)
            return False
        time.sleep(1.5); still("01-quay")
        if a.scene == "live":
            # capture only: Strand walks about within 2 m (wander), so the world visibly moves around the talk
            pg.evaluate("(() => { const f = window.__lw.G.world.area().figures.find(x => x.id === 'strand'); if (f) f.wander = 2; })()")
            pg.evaluate("window.__lw.play.people.walkTo([-0.4, 0, -2.4], () => {})"); wait("!p.people.walking()", 30)
            pg.evaluate("() => { const p = window.__lw.play; p.people.talkingWith('fewell'); p.cam.focus([-0.9, 0, -0.9]); p.startTalk('quay.lamplighters.stop'); }")
            c0 = pg.evaluate("window.__lw.G.clock()")
            time.sleep(1.0); still("02-talk-opens")
            time.sleep(9.0); still("03-talk-world-runs"); note("clock ran during the talk:", pg.evaluate("window.__lw.G.clock()") - c0, "min")
            pg.mouse.click(5, 5)  # the page, not an option, has the keyboard
            pg.keyboard.down("KeyA"); time.sleep(0.6); still("04-walking-off"); time.sleep(1.4); pg.keyboard.up("KeyA")
            time.sleep(0.5); still("05-walked-off")
            ctx.close(); b.close(); (out / "capture.log").write_text(chr(10).join(log), encoding="utf-8"); return
        # 1. walk to the lamplighters
        ok = pg.evaluate("window.__lw.play.people.walkTo([-0.4, 0, -2.4], () => {})"); note("walk to the lamplighters:", ok)
        time.sleep(1.2); still("02-walking")
        wait("!p.people.walking()", 30); still("03-arrived")
        # 2. their conversation
        pg.evaluate("() => { const p = window.__lw.play; p.people.talkingWith('fewell'); p.cam.focus([-0.9, 0, -0.9]); p.startTalk('quay.lamplighters.stop'); }")
        time.sleep(2.0); still("04-talk")
        # 3. stand your ground: the fight starts from the conversation, on the same plate
        i = pg.evaluate("window.__lw.play.P.beat.options.findIndex(o => /Stand your ground/.test(o.label))"); note("fight option", i)
        # Lamb's hands in the fight: combat's scripted player (combat/tools/pilot.mjs, its capture driver)
        pg.evaluate("""async () => { const { createPilot } = await import('/engine/combat/tools/pilot.mjs'); const C = window.__lw.G.ext.combat, step = C.step.bind(C), pilot = createPilot();
          C.step = (input) => step(C.current && !C.current.W.result ? pilot(C.current.W) : input); }""")
        pg.evaluate(f"window.__lw.play.choose({i})")
        time.sleep(1.5); still("05-fight-start")
        t0, shot = time.time(), 0
        while time.time() - t0 < 120 and pg.evaluate("window.__lw.play.root.classList.contains('fighting')"):
            time.sleep(0.35)
            if time.time() - t0 > 6 * (shot + 1) and shot < 3: shot += 1; still(f"06-fight-{shot}")
        note("fight over after", round(time.time() - t0, 1), "s")
        time.sleep(2.5); still("07-outcome")
        # 4. the outcome read, the panel closes (the capture closes it; in play the hub menu's way out
        # does) and Lamb walks on
        for _ in range(6):
            if pg.evaluate("!!(window.__lw.play.P.beat && window.__lw.play.P.beat.done)"): pg.evaluate("window.__lw.play.close()"); time.sleep(1.0)
        pg.evaluate("() => { const p = window.__lw.play; p.P.talk = null; p.P.beat = null; p.P.ended = null; p.render(); }")
        time.sleep(0.8)
        ok = pg.evaluate("window.__lw.play.people.walkTo([-4.5, 0, -2.4], () => {})"); note("walk on:", ok)
        time.sleep(1.5); still("08-walking-on")
        wait("!p.people.walking()", 30); still("09-end")
        note("figures on screen:", json.dumps(pg.evaluate("window.__lw.play.people.figures().map(f => ({ who: f.who, at: f.at, s: window.__lw.play.cam.toScreen(f.at) }))")))
        note("fighters:", json.dumps(pg.evaluate("(() => { const C = window.__lw.G.ext.combat; const W = C.current && C.current.W; return W ? W.fighters.map(F => [F.id, F.team]) : null; })()")))
        ctx.close(); b.close()
    (out / "capture.log").write_text("\n".join(log), encoding="utf-8")

if __name__ == "__main__":
    main()
