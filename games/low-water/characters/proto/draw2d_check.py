# Serve the Low Water folder on localhost and open proto/draw2d_check.html in headless Chromium
# (GPU disabled); prints the page's timing line and saves a screenshot. Run at Idle priority.
import http.server, threading, functools, sys, os
from playwright.sync_api import sync_playwright
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8799), functools.partial(http.server.SimpleHTTPRequestHandler, directory=root))
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas", "--disable-gpu-rasterization"])
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); pg.on('console', lambda m: print('console:', m.text)); pg.on('pageerror', lambda e: print('pageerror:', e))
    pg.goto('http://127.0.0.1:8799/characters/proto/draw2d_check.html'); pg.wait_for_function('document.title === "done"', timeout=20000)
    print(pg.inner_text('#out')); pg.screenshot(path=os.path.join(root, 'characters', 'out', 'draw2d_check.png')); b.close()
srv.shutdown()
