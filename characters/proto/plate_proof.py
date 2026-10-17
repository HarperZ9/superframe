# Stills of the figures on the real v2 plates in the engine shell, headless (no GPU, no window), at
# 1920x1080, for the lighting, shadow and occlusion checks (characters/PROGRESS.md step 57).
#   python proto/plate_proof.py <tag> [port]    writes stills/proof/<view>-<tag>.png and a log
# Views: the Brine bar (Lamb at the counter with Sabine and Merrow), the Brine by a wall and a table,
# Lamp Quay by the stairs and a bench, and Lamp Quay among the lamplighters (four or more close).
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
tag = sys.argv[1] if len(sys.argv) > 1 else 'now'; port = int(sys.argv[2]) if len(sys.argv) > 2 else 8793
out = os.path.join(root, 'characters', 'stills', 'proof'); os.makedirs(out, exist_ok=True)
VIEWS = [  # name, plate, Lamb's point, the point the camera holds (None: Lamb)
    ('brine-bar', 'brine', [-0.1, 0, -1.7], None),
    ('brine-wall-table', 'brine', [4.1, 0, 0.1], None),
    ('quay-stairs-bench', 'quay', [-6.2, 0, -2.3], None),
    ('quay-crowd', 'quay', [-0.4, 0, -2.4], None),
    ('quay-fight-crowd', 'quay', [-0.4, 0, -2.4], 'fight'),   # the lamplighters' fight: three bodies close
    ('brine-crowd', 'brine', [2.9, 0, 1.3], 'crowd'),           # four more people packed round Lamb on the Brine's lit floor
    ('quay-crowd4', 'quay', [-3.4, 0, -2.6], 'crowd'),         # the same on the quay by the bench and post
]
# 'crowd': the page's person drawer is wrapped so that, with Lamb, four extra people stand within a metre
# of Lamb (the drawer under test draws them exactly as scene people; only their placing is the proof's)
CROWD = """async () => { const F = await import('/engine/ui/figures.mjs'), p = window.__lw.play, cam = p.cam, base = F.personDrawer();
  const extra = [['gorm', [0.7, 0, 0.35]], ['hobb', [-0.55, 0, 0.5]], ['wenna', [0.35, 0, -0.6]], ['keel', [-0.7, 0, -0.35]]];
  F.setPersonDrawer((g, f, a) => { if (f.who !== 'lamb') return base(g, f, a);
    const list = [{ f, a }, ...extra.map(([who, d], k) => { const at = [a.at[0] + d[0], a.at[1], a.at[2] + d[2]], s = cam.toScreen(at);
      return { f: { who, at, face: k * 1.7, walking: false }, a: { ...a, x: s[0], y: s[1], ppm: cam.scaleAt(at), at, face: k * 1.7, walking: false, running: false, gesture: null, depth: cam.depthOf(at) } }; })];
    list.sort((u, v) => v.a.depth - u.a.depth); for (const q of list) base(g, q.f, q.a); }); }"""
only = os.environ.get('VIEWS'); VIEWS = [v for v in VIEWS if not only or v[0] in only.split(',')]
srv = subprocess.Popen(['node', os.path.join(root, 'game', 'serve.mjs'), '--port', str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.5)
log = []
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, executable_path=os.environ.get('CHROME_EXE') or None, args=['--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-rasterization'])
        for (name, plate, pos, hold) in VIEWS:
            pg = b.new_page(viewport={'width': 1920, 'height': 1080})
            pg.on('console', lambda m: log.append(f'{name} console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e: log.append(f'{name} PAGEERROR {e}'))
            if os.environ.get('SHADOW_DEBUG'): pg.add_init_script("globalThis.__lwShadowDebug = true;")
            pg.goto(f'http://127.0.0.1:{port}/engine/play.html?capture=1')
            pg.wait_for_function("document.documentElement.dataset.ready === '1' && window.__lw", timeout=120000)
            pg.evaluate("""([plate, pos]) => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false });
              c.G.setPlace(plate); c.G.state.pos = pos; c.play(); if (c.play.P.talk) { c.play.P.talk = null; c.play.P.beat = null; c.play.render(); } }""", [plate, pos])
            pg.wait_for_function("(() => { const p = window.__lw.play; return p && p.cam.ready() && !!p.cam.arena(); })()", timeout=180000)
            pg.evaluate("(pos) => { window.__lw.G.state.pos = pos; }", pos)
            if hold == 'fight':   # as game/engine/tools/scene_capture.py: the conversation, then "Stand your ground"
                pg.evaluate("() => { const p = window.__lw.play; p.people.talkingWith('fewell'); p.cam.focus([-0.9, 0, -0.9]); p.startTalk('quay.lamplighters.stop'); }"); time.sleep(2.0)
                i = pg.evaluate("window.__lw.play.P.beat.options.findIndex(o => /Stand your ground/.test(o.label))"); pg.evaluate(f"window.__lw.play.choose({i})"); time.sleep(4.0)
            if hold == 'crowd': pg.evaluate(CROWD)
            # until every figure has been exposed from its plate (the plate's buffers load once, a few seconds cold)
            t0 = time.time()
            while time.time() - t0 < 40 and not pg.evaluate("(() => { const s = globalThis.__lwFigureStats; return !!s && Object.values(s).length > 0 && Object.values(s).every(v => v.plate); })()"): time.sleep(0.5)
            time.sleep(2.0)
            if os.environ.get('PROBE'):   # the plate's ground under and around Lamb's feet, as the shadow pass reads it
                log.append(f'{name} probe ' + json.dumps(pg.evaluate("""async () => { const { plateCtx } = await import('/characters/runtime/platectx.mjs'), p = window.__lw.play, cam = p.cam, pj = cam.place();
                  const at = window.__lw.G.state.pos, s = cam.toScreen(at), ppm = cam.scaleAt(at), area = cam.area(), lights = pj.lights[(area && area.variant) || pj.variants[0]];
                  const P = plateCtx({ plate: pj.place, at, x: s[0], y: s[1], ppm, cam: pj.camera, lights }); if (!P) return 'no ctx';
                  const out = { at, s, ppm, zoom: P.zoom, feet: P.pointAt(s[0], s[1]) }; for (const [dx, dy] of [[40, 0], [-40, 0], [0, 20], [0, -20], [80, 10]]) out[dx + ',' + dy] = P.pointAt(s[0] + dx, s[1] + dy);
                  out.camPoint = cam.pointAt(s[0], s[1]); return out; }""")))
            log.append(f'{name} stats ' + json.dumps(pg.evaluate("({ fig: globalThis.__lwFigureStats, shadow: globalThis.__lwShadowStats })")))
            figs = pg.evaluate("window.__lw.play.people.figures().map(f => ({ who: f.who, at: f.at.map(v => +v.toFixed(2)) }))")
            f = os.path.join(out, f'{name}-{tag}.png'); pg.screenshot(path=f); log.append(f'still {name}-{tag} figures {json.dumps(figs)}'); print(f, len(figs), 'figures', flush=True)
            pg.close()
        b.close()
finally:
    srv.terminate()
    with open(os.path.join(out, f'log-{tag}.txt'), 'w', encoding='utf-8') as fh: fh.write('\n'.join(log))
