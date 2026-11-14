"""The first twenty minutes as a new player, driven headless at 1280 x 720 (the UX walk).

    python game/engine/tools/uxwalk.py --port 8771 --out game/capture/ux-walk-<date>

Title, New game, character creation, Begin the night, the prologue on the ferry (first option each
time until the arrival), the quay in the open, the Daybook, the pause page and saves, then the first
fight (the lamplighters' "Stand your ground"). Each step writes a still and the page's visible text
(<step>.txt), and walk.json logs the steps, page errors and timings, for reading frame by frame.
"""
import argparse, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=8771); ap.add_argument("--out", required=True)
    ap.add_argument("--look", default="")
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    log, errs = [], []
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--disable-gpu"])
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        n = [0]

        def shot(name, note=""):
            n[0] += 1; stem = f"{n[0]:02d}-{name}"
            pg.screenshot(path=str(out / f"{stem}.png"))
            txt = pg.evaluate("() => document.body.innerText")
            (out / f"{stem}.txt").write_text(txt, encoding="utf8")
            log.append({"step": stem, "note": note, "t": round(time.time() - t0, 1)}); print(stem, note, flush=True)

        def click(text, timeout=8000):
            loc = pg.get_by_role("button", name=text).first
            loc.wait_for(timeout=timeout); loc.click()

        t0 = time.time()
        q = "capture=1" + (f"&look={a.look}" if a.look else "")
        pg.goto(f"http://127.0.0.1:{a.port}/engine/play.html?{q}")
        pg.wait_for_function("document.documentElement.dataset.ready === '1'", timeout=120000)
        time.sleep(2); shot("title", f"ready after {round(time.time() - t0, 1)} s")
        click("New game"); time.sleep(1.2); shot("create")
        cards = pg.locator("button.card");
        if cards.count() > 1: cards.nth(1).click(); time.sleep(0.5); shot("create-chosen", "the second precedent")
        click("Begin the night"); time.sleep(4); shot("prologue-open")
        # the prologue: take the first option (or Go on) until the talk closes or 30 beats pass
        for k in range(30):
            busy = pg.evaluate("() => { const p = window.__lw && window.__lw.play; return !!(p && p.P.talk); }")
            if not busy: break
            opts = pg.locator(".talk button.opt, .talk .options button")
            go = pg.get_by_role("button", name="Go on")
            if go.count() and go.first.is_visible(): go.first.click()
            elif opts.count(): opts.first.click()
            else: pg.keyboard.press("Enter")
            time.sleep(0.6)
            if k in (1, 4, 8, 14, 22): shot(f"prologue-{k}")
        time.sleep(2); shot("open-world", "the talk closed")
        pg.keyboard.press("Tab"); time.sleep(1); shot("daybook"); pg.keyboard.press("Escape"); time.sleep(0.6)
        pg.keyboard.press("Escape"); time.sleep(1); shot("pause")
        sv = pg.get_by_role("button", name="Save")
        if sv.count(): sv.first.click(); time.sleep(1); shot("save")
        pg.keyboard.press("Escape"); time.sleep(0.5); pg.keyboard.press("Escape"); time.sleep(0.8)
        # the first fight, as the visual check starts it
        ok = pg.evaluate("""() => { const c = window.__lw, p = c.play; if (!p) return 'no play'; c.G.setPlace('quay'); c.G.state.pos = [3.3, 0, -2.3]; p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop');
          const i = p.P.beat && p.P.beat.options ? p.P.beat.options.findIndex((o) => /Stand your ground/.test(o.label)) : -1; if (i < 0) return 'no option'; p.choose(i); return 'ok'; }""")
        time.sleep(3); shot("fight-start", ok); time.sleep(6); shot("fight-6s")
        b.close()
    (out / "walk.json").write_text(json.dumps({"steps": log, "errors": errs}, indent=1), encoding="utf8")
    print("errors:", len(errs))


if __name__ == "__main__":
    main()
