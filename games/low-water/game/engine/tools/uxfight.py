"""A new player's first fight, in real time (the UX walk for fights): Act 1 from New game, the prologue
taken by its first options, then the lamplighters on the quay ("Stand your ground"), played by a
player who presses nothing for the first seconds, as someone new does, then walks for the nearest way
out with the keys. Stills every second and the page's text (what the player can read), at 1280 x 720.
    python game/engine/tools/uxfight.py --port 8771 --out game/capture/ux-fight-<date> [--look glyph]
"""
import argparse, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=8771); ap.add_argument("--out", required=True); ap.add_argument("--look", default=""); ap.add_argument("--mode", default="talk", help="talk (press the offer when it shows) or out (walk for the nearest OUT)")
    ap.add_argument("--act", default="act1", help="act1, or act2 / act3 with the earlier acts' state carried in (a fresh Act 1)")
    ap.add_argument("--scene", default="quay|1.6,0,-1.9|quay.lamplighters.stop|Stand your ground", help="place|x,y,z|start node|option that starts the fight")
    ap.add_argument("--clock", default="", help="hh:mm to stand at before the scene (the night's own hour)")
    ap.add_argument("--archetype", default="p.wader")
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True); log = []; seen_offer = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--disable-gpu"]); pg = b.new_page(viewport={"width": 1280, "height": 720}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{a.port}/engine/play.html?capture=1" + (f"&look={a.look}" if a.look else ""))
        pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw", timeout=120000)
        if a.act == "act1":
            pg.get_by_role("button", name="New game").first.click(); time.sleep(1)
            pg.get_by_role("button", name="Begin the night").first.click(); time.sleep(3)
        else:  # carried in: Act 1 (and Act 2) handed on by the end screen's "On to the next night"
            pg.evaluate(f"() => {{ const c = window.__lw; c.newGame(5); c.G.create({{ archetype: '{a.archetype}', enter: false }}); c.goNextAct(); }}")
            pg.wait_for_url("**carry=1", timeout=60000); pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw && window.__lw.G", timeout=120000)
            if a.act == "act3":
                time.sleep(1); pg.evaluate("() => window.__lw.goNextAct()"); time.sleep(1)
                pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw && window.__lw.G && /act3/.test(location.search)", timeout=120000)
            time.sleep(2)
        # the prologue and the berth, by first options, until the talk closes on the quay
        for k in range(40):
            if not pg.evaluate("() => !!(window.__lw.play && window.__lw.play.P.talk)"): break
            go = pg.get_by_role("button", name="Go on")
            if go.count() and go.first.is_visible(): go.first.click()
            else:
                opts = pg.locator(".talk button.opt, .talk .options button")
                if opts.count(): opts.first.click()
                else: pg.keyboard.press("Enter")
            time.sleep(0.4)
        # walk up to the lamplighters as a player would (the people layer's own walk), and start the scene
        place, pos, start, option = a.scene.split("|")
        hm = [int(x) for x in a.clock.split(":")] if a.clock else None
        pg.evaluate("""(s) => { const c = window.__lw, p = c.play, G = c.G; if (s.hm) { const t = (s.hm[0] < 12 ? s.hm[0] + 24 : s.hm[0]) * 60 + s.hm[1]; if (t > G.clock()) G.env.advance(t - G.clock()); }
          if (p.P.talk) { p.P.talk = null; p.P.beat = null; } G.setPlace(s.place); G.state.pos = s.pos; p.render(); p.startTalk(s.start); }""", {"place": place, "pos": [float(v) for v in pos.split(",")], "start": start, "hm": hm})
        time.sleep(1.2); pg.screenshot(path=str(out / "00-the-choice.png"))
        opts = pg.locator(".talk button.opt, .talk .options button"); labels = [opts.nth(i).inner_text() for i in range(opts.count())]
        log.append({"t": 0, "options": labels})
        for k in range(8):  # through the scene to the option that starts the fight
            if pg.get_by_role("button", name=option).count(): break
            go = pg.get_by_role("button", name="Go on")
            if go.count() and go.first.is_visible(): go.first.click(); time.sleep(0.4); continue
            break
        pg.get_by_role("button", name=option).first.click()
        t0 = time.time()
        held = set()
        def steer():
            # the way out walked as the bench walks it: the nearest exit, by the fight's own paths (combat/sim/paths.mjs
            # go), and that step turned into the movement keys by where it lands on the screen (2026-10-21: steering at
            # the OUT label once a second blundered into props)
            d = pg.evaluate("""async () => { const { go } = await import('/engine/combat/sim/paths.mjs'); const p = window.__lw.play, W = window.__lw.G.ext.combat.current && window.__lw.G.ext.combat.current.W; if (!W || W.result) return null;
              const L = W.lamb(), ex = W.field.arena.exits || []; if (!ex.length) return null;
              const c = ex.map(([x0, z0, x1, z1]) => [(x0 + x1) / 2, (z0 + z1) / 2]).sort((a, b) => Math.hypot(a[0] - L.x, a[1] - L.z) - Math.hypot(b[0] - L.x, b[1] - L.z))[0];
              let m = W.field.inExit(L.x, L.z) ? { mx: c[0] - L.x, mz: c[1] - L.z } : go(W, L, c[0], c[1]); const n = Math.hypot(m.mx, m.mz) || 1; if (W.field.inExit(L.x, L.z) && n < 0.3) { const a = W.tick * 0.15; m = { mx: Math.cos(a), mz: Math.sin(a) }; }
              const a = p.cam.toScreen([L.x, 0, L.z]), b = p.cam.toScreen([L.x + m.mx / n, 0, L.z + m.mz / n]); return a && b ? [b[0] - a[0], b[1] - a[1]] : null; }""")
            want = set()
            if d:
                n = (d[0] ** 2 + d[1] ** 2) ** 0.5 or 1
                if abs(d[0]) / n > 0.38: want.add("d" if d[0] > 0 else "a")
                if abs(d[1]) / n > 0.38: want.add("s" if d[1] > 0 else "w")
            for k in held - want: pg.keyboard.up(k)
            for k in want - held: pg.keyboard.down(k)
            held.clear(); held.update(want)
        for s in range(1, 13):
            while time.time() - t0 < s:
                if a.mode == "out" and s > 1: steer(); time.sleep(0.15)
                else: time.sleep(0.05)
            st = pg.evaluate("""() => { const W = window.__lw.G.ext.combat.current && window.__lw.G.ext.combat.current.W; if (!W) return null; const L = W.lamb();
              return { tick: W.tick, foes: W.fighters.filter(F => F.team !== 'lamb').map(F => [+F.x.toFixed(2), +F.z.toFixed(2)]), lamb: [+L.x.toFixed(2), +(L.y || 0).toFixed(2), +L.z.toFixed(2)], inExit: W.field.inExit(L.x, L.z), exits: W.field.arena.exits.map(e => e.map(v => +v.toFixed(1))), hp: +L.hp.toFixed(1), composure: +(L.composure || 0).toFixed(2), talk: W.talk && W.talk.label, result: W.result && W.result.outcome,
                offer: !document.querySelector('.talkoffer').hidden ? document.querySelector('.talkoffer').innerText : null,
                marks: [...document.querySelectorAll('.waymark')].map(m => m.textContent), keysOpen: !!document.querySelector('.fightkeys[open]'), layout: (document.querySelector('.fightlayer') || {}).layout || null }; }""")
            log.append({"t": s, **(st or {})}); pg.screenshot(path=str(out / f"{s:02d}s.png")); print(s, json.dumps(st), flush=True)
            if st and st.get("result"): break
            # a new player reads the card for about a second, then presses the key it shows (T)
            if a.mode == "talk" and st and st.get("offer") and not seen_offer.get("t"): seen_offer["t"] = s
            if a.mode == "talk" and seen_offer.get("t") and s >= seen_offer["t"] + 1: pg.keyboard.press("t")
        b.close()
    (out / "fight.json").write_text(json.dumps({"log": log, "errors": errs}, indent=1), encoding="utf8")

if __name__ == "__main__": main()
