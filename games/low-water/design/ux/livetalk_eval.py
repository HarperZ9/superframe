"""Talk panel in a live world: two panel widths, measured headless (UI and UX lead, UI-SYSTEM 7.6).

    python design/ux/livetalk_eval.py        (run through design/ux/idle_eval.sh at Idle priority)

For each panel width (wide: clamp(24rem, 33.4vw, 40rem); slim: clamp(21rem, 27vw, 34rem)) and each
screen (1280x720, 1280x800, 1920x1080) it opens the live quay conversation (the lamplighters stop
Lamb) and the Brine interrogation (Merrow), as game/engine/tools/scene_capture.py does, and measures:
the share of the plate left free, metres of lookahead to the right of the subject, the warning that
gives at a walk (1.5 m/s) and a run (3.6 m/s), how many people on the plate are hidden by the panel and
whether each hidden one has an edge mark, the talk column's characters per line, whether the options
fit without scrolling, and whether the lie tab shows with its seconds while a lie is open. Writes
design/ux/shots/live-*.png and design/ux/shots/livetalk.json.
"""
import json, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "shots"
PORT = 8743

MEASURE = """(variant) => { const c = window.__lw, p = c.play, G = c.G, cam = p.cam;
  const scene = p.root.querySelector('.scene').getBoundingClientRect(), panel = p.root.querySelector('aside.talk').getBoundingClientRect();
  const free = (panel.left - scene.left) / scene.width, L = G.state.pos, s = cam.toScreen(L), ppm = cam.scaleAt(L) || 1;
  const look = s ? Math.max(0, (panel.left - scene.left) - s[0]) / ppm : null;
  const figs = p.people.figures().filter(f => f.who !== 'lamb').map(f => ({ who: f.who, s: cam.toScreen(f.at) })).filter(f => f.s);
  const hidden = figs.filter(f => f.s[0] > panel.left - scene.left - 4 || f.s[0] < 0).map(f => f.who);
  const marked = [...document.querySelectorAll('.edgemark:not([hidden]) .ename')].map(e => e.textContent);
  const log = p.root.querySelector('.log'), cs = getComputedStyle(log), probe = document.createElement('span');
  probe.textContent = 'the harbour office quietly, Shelf. Twenty years'; probe.style.font = cs.font; probe.style.visibility = 'hidden'; document.body.append(probe);
  const charW = probe.getBoundingClientRect().width / probe.textContent.length; probe.remove();
  const opts = p.root.querySelector('.opts');
  return { variant, w: innerWidth, h: innerHeight, free: +free.toFixed(3), lookM: look == null ? null : +look.toFixed(1), walkS: look == null ? null : +(look / 1.5).toFixed(1), runS: look == null ? null : +(look / 3.6).toFixed(1),
    people: figs.length, hidden, marked, chars: Math.round((log.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / charW), optsFit: opts.scrollHeight <= opts.clientHeight + 1, ruleTalkX: G.rs.rules['camera-talk-x'],
    lambX: s ? +(s[0] / (panel.left - scene.left)).toFixed(3) : null,
    subjectX: (() => { const who = p.people.talkingWithWho, f = who && p.people.figures().find(x => x.who === who), a = f && cam.toScreen(f.at); return s && a ? +(((s[0] + a[0]) / 2) / (panel.left - scene.left)).toFixed(3) : null; })(),
    camLeft: cam.frameNow() ? cam.frameNow().left : null }; }"""

def run():
    OUT.mkdir(parents=True, exist_ok=True)
    srv = subprocess.Popen(["node", str(ROOT / "game" / "serve.mjs"), "--port", str(PORT)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    time.sleep(1.0)
    rows = []
    from playwright.sync_api import sync_playwright
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(headless=True, args=["--disable-gpu", "--disable-gpu-compositing", "--disable-gpu-rasterization"])
            for (w, h) in ([(1280, 720)] if "--quick" in sys.argv else [(1280, 720), (1280, 800), (1920, 1080)]):
                for variant in ["wide", "slim"]:
                    for scene in ["quay", "brine"]:
                        pg = b.new_page(viewport={"width": w, "height": h})
                        errs = []
                        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "").split(chr(10))[1].strip() if e.stack and len(e.stack.split(chr(10))) > 1 else str(e)))
                        pg.goto(f"http://127.0.0.1:{PORT}/engine/play.html?capture=1", timeout=120000)
                        pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw", timeout=180000)
                        pg.evaluate(f"document.documentElement.dataset.panel = '{variant}'")
                        pg.evaluate("""(pl) => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false });
                          c.G.setPlace(pl); if (pl === 'quay') c.G.state.pos = [-0.4, 0, -2.4]; c.play(); if (c.play.P.talk) { c.play.P.talk = null; c.play.P.beat = null; c.play.render(); } }""", "quay" if scene == "quay" else "brine")
                        pg.wait_for_function("(() => { const p = window.__lw.play; return p && p.cam.ready() && !!p.cam.arena(); })()", timeout=180000)
                        if scene == "quay":
                            pg.evaluate("() => { const p = window.__lw.play; p.people.talkingWith('fewell'); p.cam.focus([-0.9, 0, -0.9]); p.startTalk('quay.lamplighters.stop'); }")
                        else:
                            pg.evaluate("window.__lw.G.state.pos = [-2.4, 0.01, -0.5]")
                            pg.evaluate("() => { const p = window.__lw.play, G = window.__lw.G; G.state.flags.push('merrow.wet_thigh'); p.people.talkingWith('merrow'); p.cam.focus([-3.2, 0, -0.3]); p.startTalk('x1.merrow.start'); }")
                            time.sleep(1.0)
                            pg.evaluate("() => { const p = window.__lw.play; p.choose(p.P.beat.options.findIndex(o => /what the Low Company lost/.test(o.label))); }")
                        time.sleep(3.0)
                        m = pg.evaluate(MEASURE, variant); m["scene"] = scene
                        # a threat behind the panel: move the second person far to the right of the subject (as if arriving)
                        m["threat"] = None if "--nothreat" in sys.argv else pg.evaluate("""() => { const c = window.__lw, p = c.play, cam = p.cam, A = c.G.world.area();
                          const L = c.G.state.pos, sc = p.root.querySelector('.scene').getBoundingClientRect(), pl = p.root.querySelector('aside.talk').getBoundingClientRect().left - sc.left;
                          for (let dx = 1; dx < 40; dx += 0.5) { const at = [L[0] + dx, L[1], L[2]], s = cam.toScreen(at); if (s && s[0] > pl + 30 && s[0] < sc.width - 30) { (A.figures ||= []).push({ id: 'keel', at, face: -1 }); return { who: 'keel', at, dx }; } }
                          return null; }""")
                        time.sleep(0.6)
                        m["threatMarked"] = pg.evaluate("[...document.querySelectorAll('.edgemark:not([hidden]) .ename')].map(e => e.textContent)")
                        if scene == "brine":
                            try: pg.wait_for_function("!!window.__lw.G.interrog.openLie()", timeout=15000)
                            except Exception as e: m["lieWait"] = type(e).__name__
                            time.sleep(0.6)
                            m["lieTab"] = pg.evaluate("(() => { const t = document.querySelector('.lietab'); return t && !t.hidden ? t.textContent : null; })()")
                        m["errors"] = errs[:3]
                        pg.screenshot(path=str(OUT / f"live-{scene}-{variant}-{w}x{h}.png"))
                        rows.append(m); print(json.dumps(m), flush=True)
                        pg.close()
            b.close()
    finally:
        srv.kill()
    (OUT / "livetalk.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")

if __name__ == "__main__":
    run()
