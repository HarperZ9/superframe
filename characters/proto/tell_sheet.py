# Screenshot of proto/tell_sheet.html (the tell shapes), headless, GPU off. python proto/tell_sheet.py [port] [out]
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); port = int(sys.argv[1]) if len(sys.argv) > 1 else 8831
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, 'characters', 'out', 'tells.png')
srv = subprocess.Popen(['node', os.path.join(root, 'game', 'serve.mjs'), '--port', str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROME_EXE') or None, args=['--disable-gpu']); pg = b.new_page(viewport={'width': 1500, 'height': 560})
        pg.on('pageerror', lambda e: print('PAGEERROR', e)); pg.goto(f'http://127.0.0.1:{port}/characters/proto/tell_sheet.html'); pg.wait_for_function("document.title === 'ready'", timeout=60000)
        pg.screenshot(path=out); print(out); b.close()
finally:
    srv.terminate()
