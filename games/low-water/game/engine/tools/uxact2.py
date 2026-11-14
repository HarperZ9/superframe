"""A new player's first hour of Act 2 (the UX walk, second night): Act 1's state carried in, the
daylight page taken by its first options and its hotspots in order, then the night until the first
fight. A still and the page's text every few steps, and one at each new place, at 1280 x 720.
    python game/engine/tools/uxact2.py --port 8771 --out game/capture/ux-act2-<date>
"""
import argparse, json, re, time
from pathlib import Path
from playwright.sync_api import sync_playwright

STATE = """() => { const c = window.__lw, p = c.play, G = c.G; return { clock: G.clock(), place: G.state.place, area: G.state.area, talking: !!(p && p.P.talk), node: p && p.P.talk && p.P.talk.node,
  options: p && p.P.beat && p.P.beat.options ? p.P.beat.options.map(o => o.label) : null, hotspots: G.world.hotspots().map(h => h.label), fight: !!document.querySelector('.fightlayer') }; }"""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=8771); ap.add_argument("--out", required=True); ap.add_argument("--steps", type=int, default=60); ap.add_argument("--through", action="store_true", help="play on through fights (the offered words after a second, else wait it out) instead of stopping at the first"); ap.add_argument("--until", default="", help="stop when the conversation reaches a node matching this regex"); ap.add_argument("--act", default="act2", help="act2, or act3 (carried through Act 2 at once)"); ap.add_argument("--archetype", default="p.condoler")
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True); log = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--disable-gpu"]); pg = b.new_page(viewport={"width": 1280, "height": 720}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{a.port}/engine/play.html?capture=1&content=act1")
        pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw", timeout=120000)
        pg.evaluate("() => { const c = window.__lw; c.newGame(5); c.G.create({ archetype: '" + a.archetype + "', enter: false }); c.goNextAct(); }")
        pg.wait_for_url("**carry=1", timeout=60000); pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw && window.__lw.G", timeout=120000)
        if a.act == "act3":
            time.sleep(1); pg.evaluate("() => window.__lw.goNextAct()"); time.sleep(1)
            pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw && window.__lw.G && /act3/.test(location.search)", timeout=120000)
        time.sleep(2); n = [0]; last_place = [None]
        def shot(tag):
            n[0] += 1; stem = f"{n[0]:03d}-{tag}"; pg.screenshot(path=str(out / f"{stem}.png")); (out / f"{stem}.txt").write_text(pg.evaluate("() => document.body.innerText"), encoding="utf8"); return stem
        hot_i = 0; recent = []
        for k in range(a.steps):
            try: st = pg.evaluate(STATE)
            except Exception as e:  # the page is moving to the next act: wait for it
                pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw && window.__lw.G", timeout=120000); continue
            if st["fight"]:
                time.sleep(2); log.append({"k": k, "shot": shot("fight"), **st})
                if not a.through: break
                t0 = time.time(); presses = []  # a new player: presses T a second after the words are offered, else holds on
                FS = "() => { const W = window.__lw.G.ext.combat.current && window.__lw.G.ext.combat.current.W; if (!W) return null; const L = W.lamb(); return { s: +(W.tick / 60).toFixed(1), hp: +L.hp.toFixed(1), comp: +(L.composure || 0).toFixed(2), talk: !!W.talk, result: W.result && W.result.outcome }; }"
                while time.time() - t0 < 90 and pg.evaluate("() => !!document.querySelector('.fightlayer')"):
                    if pg.evaluate("() => { const o = document.querySelector('.talkoffer'); return !!(o && !o.hidden); }"): time.sleep(1); presses.append(pg.evaluate(FS)); pg.keyboard.press("t")
                    time.sleep(0.5)
                time.sleep(1.5); st = pg.evaluate(STATE); log.append({"k": k, "shot": shot("after-fight"), "fight_secs": round(time.time() - t0), "presses": presses, **st}); continue
            if a.until and st["node"] and re.search(a.until, st["node"]): log.append({"k": k, "shot": shot("until"), **st}); break
            log.append({"k": k, "step": 1, **st}) if not (st["place"] != last_place[0] or k % 12 == 0) else None
            if st["place"] != last_place[0]: last_place[0] = st["place"]; log.append({"k": k, "shot": shot(f"place-{st['place']}"), **st})
            elif k % 12 == 0: log.append({"k": k, "shot": shot("step"), **st})
            if st["talking"]:
                go = pg.get_by_role("button", name="Go on")
                if go.count() and go.first.is_visible(): go.first.click()
                else:
                    opts = pg.locator(".talk button.opt:not([disabled]), .talk .options button:not([disabled])")  # a spent check is shown but not pressable
                    if opts.count():
                        recent.append(st["node"]); del recent[:-8]
                        # a player going round the same scene a third time takes its last option (the way out of it)
                        # (the last one not yet said: the last of all is often a said wait, and the Brine walk stood at the stove for four hours)
                        fresh = [i for i in range(opts.count()) if "said" not in opts.nth(i).inner_text().lower()]
                        pick = (fresh[-1] if fresh else opts.count() - 1) if recent.count(st["node"]) >= 3 else min(hot_i % 2, opts.count() - 1)
                        try: opts.nth(pick).click(timeout=5000)
                        except Exception as e: log.append({"k": k, "stuck": str(e).splitlines()[0], **st}); pg.keyboard.press("Enter")
                    else: pg.keyboard.press("Enter")
            else:
                hs = pg.locator(".here button.act")
                if hs.count():
                    try: hs.nth(hot_i % max(1, min(3, hs.count()))).click(timeout=5000)
                    except Exception as e: log.append({"k": k, "stuck": str(e).splitlines()[0], **st})
                    hot_i += 1
                else: pg.keyboard.press("Enter")
            time.sleep(0.35)
        b.close()
    (out / "walk.json").write_text(json.dumps({"log": log, "errors": errs}, indent=1), encoding="utf8"); print(len(log), "stills;", len(errs), "errors")

if __name__ == "__main__": main()
