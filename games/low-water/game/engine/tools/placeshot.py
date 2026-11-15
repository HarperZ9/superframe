"""Stills of wired areas in the shell: python placeshot.py --port 8771 --out DIR --shots shots.json
shots: [{name, content, place, pos?, clock?, look?, w?, h?}]. Writes DIR/<name>.png and DIR/report.json
with each person's on-screen height (cam.scaleAt x 1.75 m) and the area's camera scale."""
import argparse, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

SETUP = """async (s) => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false });
  c.G.setPlace(s.place); if (s.pos) c.G.state.pos = s.pos;
  if (s.clock != null) { const d = s.clock - c.G.clock(); if (d > 0) c.G.env.advance(d); }
  if (s.flags) for (const f of s.flags) c.G.state.flags.push(f);
  c.play(); if (c.play.P.talk) { c.play.P.talk = null; c.play.P.beat = null; c.play.render(); } }"""
MEASURE = """() => { const c = window.__lw, p = c.play, cam = p.cam, G = c.G;
  const h = (at) => +(cam.scaleAt(at) * 1.75).toFixed(0);
  return { area: G.state.area, place: G.state.place, clock: G.clock(), zoom: cam.root ? null : null,
    lamb: G.state.pos && h(G.state.pos), people: p.people.figures().map(f => ({ who: f.who, at: f.at.map(v => +v.toFixed(2)), px: h(f.at), pose: f.pose })) }; }"""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=8771); ap.add_argument("--out", required=True); ap.add_argument("--shots", required=True)
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    shots = json.loads(Path(a.shots).read_text()); rep = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--disable-gpu", "--disable-gpu-compositing", "--disable-gpu-rasterization"])
        for s in shots:
            ctx = b.new_context(viewport={"width": s.get("w", 1920), "height": s.get("h", 1080)}); pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            q = f"capture=1&content={s.get('content', 'act1')}" + (f"&look={s['look']}" if s.get("look") else "")
            pg.goto(f"http://127.0.0.1:{a.port}/engine/play.html?{q}")
            pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw", timeout=120000)
            pg.evaluate(SETUP, s)
            try: pg.wait_for_function("(() => { const p = window.__lw.play; return p && p.cam.ready(); })()", timeout=120000)
            except Exception as e: errs.append(f"not ready: {e}")
            time.sleep(s.get("settle", 3.0))
            pg.screenshot(path=str(out / f"{s['name']}.png"))
            m = pg.evaluate(MEASURE); m["name"] = s["name"]; m["errors"] = errs; rep.append(m); print(json.dumps(m), flush=True)
            ctx.close()
        b.close()
    (out / "report.json").write_text(json.dumps(rep, indent=1))

if __name__ == "__main__": main()
