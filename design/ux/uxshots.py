"""UI and UX lead's stills and input tests for the engine shell, headless on the CPU (no GPU, no
window). Run at Idle priority:  game/tools/idle_drive.sh is for drive.py; this one is run with
  powershell Start-Process python -ArgumentList design/ux/uxshots.py <names...> with PriorityClass Idle.

Each case: a URL on the local server, a viewport, and steps. Steps are tuples:
  ("key", "Tab")  ("down", "KeyK") ("up", "KeyK")  ("pad", index, ms)  ("stick", x, y, ms)
  ("click", selector)  ("move", x, y)  ("wait", ms)  ("eval", js)  ("shot", name)  ("expect", js, label)
A simulated gamepad replaces navigator.getGamepads (window.__pad). Output: design/ux/shots/*.png and
a log of expectations (design/ux/shots/results.txt).
"""
import json, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "shots"
PORT = 8741
PAD_JS = """
window.__pad = { id: 'sim pad', index: 0, connected: true, mapping: 'standard', timestamp: 0,
  buttons: Array.from({length: 17}, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0],
  vibrationActuator: { playEffect: (t, o) => { (window.__rumbles ||= []).push(o); return Promise.resolve('complete'); } } };
navigator.getGamepads = () => [window.__pad];
"""

def run(cases, only):
    OUT.mkdir(parents=True, exist_ok=True)
    srv = subprocess.Popen(["node", str(ROOT / "game" / "serve.mjs"), "--port", str(PORT)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    time.sleep(1.0)
    results = []
    from playwright.sync_api import sync_playwright
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, args=["--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas", "--disable-gpu-rasterization"])
            for c in cases:
                if only and c["name"] not in only: continue
                w, h = c.get("size", (1920, 1080))
                pg = b.new_page(viewport={"width": w, "height": h})
                logs = []
                pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
                pg.on("pageerror", lambda e: logs.append("PAGEERROR " + str(e)))
                pg.add_init_script(PAD_JS)
                pg.goto(f"http://127.0.0.1:{PORT}{c['url']}")
                pg.wait_for_function("document.documentElement.dataset.ready === '1'", timeout=120000)
                pg.wait_for_timeout(400)
                for s in c.get("steps", []):
                    k = s[0]
                    if k == "key": pg.keyboard.press(s[1]); pg.wait_for_timeout(120)
                    elif k == "down": pg.keyboard.down(s[1])
                    elif k == "up": pg.keyboard.up(s[1])
                    elif k == "pad":
                        pg.evaluate(f"(() => {{ const b = window.__pad.buttons[{s[1]}]; b.pressed = true; b.value = 1; }})()")
                        pg.wait_for_timeout(s[2] if len(s) > 2 else 120)
                        pg.evaluate(f"(() => {{ const b = window.__pad.buttons[{s[1]}]; b.pressed = false; b.value = 0; }})()")
                        pg.wait_for_timeout(120)
                    elif k == "stick":
                        pg.evaluate(f"window.__pad.axes[0] = {s[1]}; window.__pad.axes[1] = {s[2]};"); pg.wait_for_timeout(s[3]); pg.evaluate("window.__pad.axes[0] = 0; window.__pad.axes[1] = 0;"); pg.wait_for_timeout(120)
                    elif k == "click": pg.click(s[1]); pg.wait_for_timeout(150)
                    elif k == "move": pg.mouse.move(s[1], s[2], steps=4); pg.wait_for_timeout(120)
                    elif k == "wait": pg.wait_for_timeout(s[1])
                    elif k == "eval": pg.evaluate(s[1]); pg.wait_for_timeout(100)
                    elif k == "shot": pg.screenshot(path=str(OUT / f"{s[1]}.png"))
                    elif k == "expect":
                        ok = pg.evaluate(s[1]); results.append(f"{'PASS' if ok else 'FAIL'}  {c['name']}: {s[2]}  ({json.dumps(ok)[:120]})")
                errs = [l for l in logs if "PAGEERROR" in l or l.startswith("error")]
                results.append(f"{'PASS' if not errs else 'FAIL'}  {c['name']}: no page errors" + ("" if not errs else "  " + " | ".join(errs)[:400]))
                pg.close()
            b.close()
    finally:
        srv.kill()
    (OUT / "results.txt").write_text("\n".join(results) + "\n", encoding="utf-8")
    print("\n".join(results))

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent)); from cases import CASES
    run(CASES, set(sys.argv[1:]))
