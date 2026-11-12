"""A live fight in the engine shell, captured frame by frame at 1080p, for judging feel.

    python game/engine/combat/tools/feel_capture.py --out <dir> [--style shadow] [--seeds 11,12,13]

Opens play.html?capture=1 through game/serve.mjs in headless Chromium (GPU off) with a
hand-cranked animation frame, so every frame is exactly 1/60 s of game time however slow the CPU renders. Puts Lamb on
Lamp Quay, opens the lamplighters' talk and starts the wardens' fight on the same plate (e.wardens,
with met.crake set so its talk exit is offered), Lamb at a mid-game build (tools/kite.mjs STYLES) and
played by tools/showcase.mjs: catches, sidesteps and rolls; kiting that draws the lunge and the
thrown stone; strings, charged heavies and the running strike. Foes by combat's AI.

First a dry pass per seed (no pictures) keeps the first seed whose fight shows a catch, an evade, a
lunge, a throw and a string; then the real pass writes frames/, fight.mp4 (60 fps, through the
imageio-ffmpeg binary already installed), stills at each first event, and capture.json with every
event and the showcase's own log. Run through tools/idle.sh for Idle priority.
"""
import argparse, json, subprocess, time, shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAME = HERE.parents[2]
FRAME_MS = 1000 / 60

SETUP = """async ([style, seed, stage, shakeScale]) => { window.__stage = !!stage;
  if (shakeScale != null) { const { IMPACT } = await import('/engine/ui/fightcam.mjs'); IMPACT.shakeScale = shakeScale; }
  const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false });
  c.G.setPlace('quay'); c.G.state.pos = [16.1, 0, -2.9]; c.G.state.flags.push('met.crake'); c.play();
  if (c.play.P.talk) { c.play.P.talk = null; c.play.P.beat = null; c.play.render(); }
  const { STYLES } = await import('/engine/combat/data/styles.mjs');
  const { createShowcase } = await import('/engine/combat/tools/showcase.mjs');
  const C = c.G.ext.combat, start = C.start.bind(C), step = C.step.bind(C), show = createShowcase();
  window.__show = show; window.__ev = [];
  C.start = (id, o) => { const W = start(id, { ...(o || {}), lamb: STYLES[style] }); W.seed = seed >>> 0; return W; };
  C.step = (input) => { const W = C.current && C.current.W;
    // --stage: a staged trigger for the readability check, labelled as such in capture.json: from 1.5 s
    // into the flight until one lunge and one stone have fired (or 8 s), every opponent's kiting clock
    // is held at its threshold, so the answers fire wherever the rules allow (distance, sight, a straight
    // line, cooldowns); everything else is the live fight
    const answered = (k) => (window.__ev || []).some((e) => e.type === 'punish' && e.how === k);
    if (window.__stage && W && W.tick >= 90 && W.tick < 480 && !(answered('lunge') && answered('throw'))) for (const F of W.fighters) if (F.team !== 'lamb' && F.mem) { F.mem.pur = F.mem.pur || { clock: 0, cut: 0, thrown: 0, lunged: 0, chase: 0, rest: 0 }; F.mem.pur.clock = Math.max(F.mem.pur.clock, 210); window.__staged = (window.__staged || 0) + 1; }
    const ev = step(W && !W.result ? show(W) : input);
    for (const e of ev) if (['parry','evade','punish','hit','flinch','stagger','knockdown','block','guardbreak','weakpoint','ledgefall','talk.offer','trip','move'].includes(e.type)) window.__ev.push(e); return ev; };
  return true; }"""

START_FIGHT = """() => { const p = window.__lw.play; p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop'); p.fightThen('e.wardens'); return true; }"""

STATE = """() => { const C = window.__lw.G.ext.combat, W = C.current && C.current.W, p = window.__lw.play;
  const scr = (F) => { const s = p.cam.toScreen([F.x, W.field.cellAt(F.x, F.z).h, F.z]); return s ? [Math.round(s[0]), Math.round(s[1])] : null; };
  return { fighting: p.root.classList.contains('fighting'), tick: W ? W.tick : null, result: W ? W.result : null,
    lamb: W ? scr(W.lamb()) : null, foes: W ? W.fighters.filter((F) => F.team !== 'lamb' && !F.out).map(scr) : [],
    // the impact camera's applied offset and zoom this frame (ui/fightcam.mjs sets them on the layers)
    cam: (() => { const el = [...document.querySelectorAll('canvas, img, div')].find((e) => e.style.translate || (e.style.scale && e.style.scale !== '1')); return el ? [el.style.translate || '', el.style.scale || ''] : null; })(),
    offer: (() => { const o = document.querySelector('.talkoffer'); return o ? { hidden: o.hidden, text: o.textContent.trim().slice(0, 80) } : null; })() }; }"""


def kinds(ev):
    k = set()
    for e in ev:
        t = e.get("type")
        if t == "punish": k.add("punish:" + e.get("how", ""))
        elif t == "parry" and e.get("id") == "lamb": k.add("catch")
        elif t == "evade" and e.get("id") == "lamb": k.add("evade")
        elif t == "move" and e.get("id") == "lamb" and str(e.get("move", "")).endswith("light_2"): k.add("string")
        elif t == "talk.offer": k.add("talk.offer")
    return k


def session(pw, port, style, seed, out=None, max_frames=60 * 60, stage=False, shake=None, windows=None):
    b = pw.chromium.launch(headless=True, args=["--disable-gpu", "--disable-gpu-compositing", "--disable-gpu-rasterization"])
    ctx = b.new_context(viewport={"width": 1920, "height": 1080})
    pg = ctx.new_page(); logs = []
    pg.on("console", lambda m: logs.append(f"console.{m.type}: {m.text}"))
    pg.on("pageerror", lambda e: logs.append(f"PAGEERROR {e}"))
    # a hand-cranked animation frame: once the fight starts, every rAF callback (the engine loop, the fight
    # layer's shake and drawing, the weather) waits in a queue and runs once per captured frame, with a
    # timestamp 1/60 s on from the last, however long the CPU takes to draw it
    pg.add_init_script("""(() => { const real = window.requestAnimationFrame.bind(window); window.__rafQ = []; window.__manual = false; window.__rafT = 0;
      window.requestAnimationFrame = (cb) => { if (window.__manual) { window.__rafQ.push(cb); return 1; } return real(cb); };
      window.__crank = (ms) => { if (!window.__manual) { window.__manual = true; window.__rafT = performance.now(); return 0; } window.__rafT += ms; const q = window.__rafQ; window.__rafQ = []; for (const cb of q) cb(window.__rafT); return q.length; }; })()""")
    pg.goto(f"http://127.0.0.1:{port}/engine/play.html?capture=1", wait_until="commit")
    def until(js, secs, step=100):
        t0 = time.time()
        while time.time() - t0 < secs:
            try:
                if pg.evaluate(js): return True
            except Exception: pass
            time.sleep(step / 1000)
        return False
    if not until("document.documentElement.dataset.ready === '1' && !!window.__lw", 240): raise RuntimeError("shell not ready: " + " | ".join(logs[-5:]))
    pg.evaluate(SETUP, [style, seed, stage, shake])
    if not until("(() => { const p = window.__lw.play; return p && p.cam.ready() && !!p.cam.arena(); })()", 300): raise RuntimeError("plate not ready")
    time.sleep(0.5)
    pg.evaluate("window.__crank(0)"); time.sleep(0.2)  # from here the page moves only when cranked
    pg.evaluate(START_FIGHT)
    frames, firsts, offer_seen, track, cams = 0, {}, None, [], []
    fdir = None
    if out:
        fdir = out / "frames"; shutil.rmtree(fdir, ignore_errors=True); fdir.mkdir(parents=True)
    while frames < max_frames:
        n = 1 if out else 30
        pg.evaluate(f"(() => {{ for (let i = 0; i < {n}; i++) window.__crank(1000 / 60); }})()"); frames += n
        st = pg.evaluate(STATE)
        if out: track.append([frames, st["lamb"], st["foes"]]); cams.append([frames, st.get("cam")])
        if out and (not windows or any(a <= frames <= b for a, b in windows)):
            pg.screenshot(path=str(fdir / f"f{frames:05d}.png"))
            ev = pg.evaluate("window.__ev.length")
            got = kinds(pg.evaluate("window.__ev"))
            for k in got:
                if k not in firsts and (fdir / f"f{frames:05d}.png").exists():
                    firsts[k] = frames; shutil.copy(fdir / f"f{frames:05d}.png", out / f"first-{k.replace(':', '-')}.png")
            if st["offer"] and not st["offer"]["hidden"] and offer_seen is None and (fdir / f"f{frames:05d}.png").exists():
                offer_seen = {"frame": frames, "text": st["offer"]["text"]}; shutil.copy(fdir / f"f{frames:05d}.png", out / "talk-offer-visible.png")
        if not st["fighting"] and st["tick"] is None and frames > 120: break
        if st["result"]:
            if out:
                for _ in range(90 if not windows else 0): pg.evaluate("window.__crank(1000 / 60)"); frames += 1; pg.screenshot(path=str(fdir / f"f{frames:05d}.png"))
            break
    ev = pg.evaluate("window.__ev"); staged = pg.evaluate("window.__staged || 0")
    res = pg.evaluate(STATE)
    ctx.close(); b.close()
    return {"seed": seed, "frames": frames, "result": res["result"], "kinds": sorted(kinds(ev)), "events": ev, "firsts": firsts, "offer": offer_seen, "track": track, "cams": cams, "staged": staged, "console": [l for l in logs if "error" in l.lower()][:20]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--style", default="shadow")
    ap.add_argument("--seeds", default="11,12,13,14,15,16")
    ap.add_argument("--port", type=int, default=8761)
    ap.add_argument("--stage", action="store_true", help="staged trigger for the kiting answers (see SETUP)")
    ap.add_argument("--shake-scale", type=float, default=None, help="the impact camera's IMPACT.shakeScale for this capture")
    ap.add_argument("--windows", default="", help="only picture these frames, e.g. 590-640,1010-1060 (no video)")
    ap.add_argument("--no-dry", action="store_true", help="use the first seed without a dry pass")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    srv = subprocess.Popen(["node", str(GAME / "serve.mjs"), "--port", str(a.port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    from playwright.sync_api import sync_playwright
    need = {"catch", "evade", "punish:lunge", "punish:throw", "string"}
    try:
        with sync_playwright() as pw:
            chosen, tries = None, []
            wins = [tuple(int(v) for v in w.split("-")) for w in a.windows.split(",") if w] or None
            if a.no_dry: chosen = int(a.seeds.split(",")[0])
            for s in ([] if a.no_dry else [int(x) for x in a.seeds.split(",")]):
                r = session(pw, a.port, a.style, s, stage=a.stage, shake=a.shake_scale)
                tries.append({"seed": s, "kinds": r["kinds"], "result": r["result"], "console": r["console"]}); print("dry", s, r["kinds"], r["result"], flush=True)
                if need <= set(r["kinds"]): chosen = s; break
            if chosen is None: chosen = max(tries, key=lambda t: len(need & set(t["kinds"])))["seed"]
            r = session(pw, a.port, a.style, chosen, out=out, stage=a.stage, shake=a.shake_scale, windows=wins)
    finally:
        srv.terminate()
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    if not a.windows: subprocess.run([ff, "-y", "-loglevel", "error", "-framerate", "60", "-i", str(out / "frames" / "f%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(out / "fight.mp4")], check=True)
    rec = {"style": a.style, "seed": chosen, "shake_scale": a.shake_scale, "windows": a.windows, "dry": tries, **{k: r[k] for k in ("frames", "result", "kinds", "firsts", "offer", "console")}, "events": r["events"], "track": r["track"], "cams": r["cams"], "staged": r["staged"]}
    (out / "capture.json").write_text(json.dumps(rec, indent=1), encoding="utf-8")
    print(json.dumps({k: rec[k] for k in ("style", "seed", "frames", "result", "kinds", "firsts", "offer", "console")}))


if __name__ == "__main__":
    main()
