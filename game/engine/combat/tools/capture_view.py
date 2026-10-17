"""Stills of the shell's fight view (ui/fight.mjs) through a whole fight, headless on the CPU.

    python game/engine/combat/tools/capture_view.py --node floor.salvors.fight --out <dir> [--pilot]

Opens combat/tools/fightview.html through game/serve.mjs in headless Chromium (GPU off), steps
the engine loop from here (drive=1), screenshots the page every --every steps, then the result
card, then finishes the fight and records the outcome node and the clock. Run through
tools/idle.sh for Idle priority.
"""
import argparse, json, subprocess, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAME = HERE.parents[2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--node", default="floor.salvors.fight")
    ap.add_argument("--archetype", default="p.ledger")
    ap.add_argument("--pilot", action="store_true")
    ap.add_argument("--every", type=int, default=60, help="fixed steps between stills")
    ap.add_argument("--max", type=int, default=60 * 120)
    ap.add_argument("--port", type=int, default=8746)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.png"): f.unlink()
    srv = subprocess.Popen(["node", str(GAME / "serve.mjs"), "--port", str(a.port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    from playwright.sync_api import sync_playwright
    logs, shots = [], []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, args=["--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas", "--disable-gpu-rasterization"])
            pg = b.new_page(viewport={"width": 1600, "height": 900})
            pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
            pg.on("pageerror", lambda e: logs.append("PAGEERROR " + str(e)))
            url = f"http://127.0.0.1:{a.port}/engine/combat/tools/fightview.html?node={a.node}&archetype={a.archetype}&drive=1" + ("&pilot=1" if a.pilot else "")
            pg.goto(url)
            pg.wait_for_function("document.documentElement.dataset.ready === '1'", timeout=120000)
            raf = "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
            start = pg.evaluate("__fv.G.env.clock()")
            steps, st = 0, None
            while steps < a.max:
                st = pg.evaluate(f"__fv.step({a.every})"); steps += a.every
                pg.evaluate(raf)
                f = out / f"s{steps:05d}.png"; pg.screenshot(path=str(f)); shots.append(f.name)
                if st["result"]: break
            pg.evaluate(raf); pg.screenshot(path=str(out / "result.png"))
            after = pg.evaluate("__fv.finish()")
            pg.evaluate(raf); pg.screenshot(path=str(out / "after.png"))
            events = pg.evaluate("__fv.log.filter(e => !['fight.move', 'fight.shake'].includes(e.name)).map(e => [e.t, e.name, e.id || '', e.move || e.key || e.outcome || ''])")
            b.close()
    finally:
        srv.terminate()
    rec = {"node": a.node, "pilot": a.pilot, "steps": steps, "real_seconds": steps / 60, "clock_start": start, "state": st, "after": after,
           "events": events, "console": [l for l in logs if "error" in l.lower()][:20], "shots": shots}
    (out / "view.json").write_text(json.dumps(rec, indent=1), encoding="utf-8")
    print(json.dumps({k: rec[k] for k in ("node", "pilot", "steps", "real_seconds", "clock_start", "state", "after", "console")}))


if __name__ == "__main__":
    main()
