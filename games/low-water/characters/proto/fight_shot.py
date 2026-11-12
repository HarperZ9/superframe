# Headless (GPU off) still of an in-world fight with the character figures, at 1280x720 and 1920x1080.
#   python proto/fight_shot.py [port] [steps]      writes stills/09-fight-inworld.png and -1080.png
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); port = int(sys.argv[1]) if len(sys.argv) > 1 else 8750
srv = subprocess.Popen(['node', os.path.join(root, 'game', 'serve.mjs'), '--port', str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROME_EXE') or None, args=["--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas"])
        for (w, h, name) in [(1280, 720, os.environ.get('SHOT_NAME', '09-fight-inworld') + '.png'), (1920, 1080, os.environ.get('SHOT_NAME', '09-fight-inworld') + '-1080.png')]:
            pg = b.new_page(viewport={'width': w, 'height': h}); logs = []
            if os.environ.get('FIG_LOOK') is not None: pg.add_init_script(f"globalThis.__lwFigureLook = {repr(os.environ['FIG_LOOK'])};")
            pg.on('console', lambda m: logs.append(m.type + ': ' + m.text)); pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
            pg.goto(f'http://127.0.0.1:{port}' + (os.environ.get('SHOT_URL') or '/characters/proto/fight_shot.html?shot=fight')); pg.wait_for_timeout(int(sys.argv[2]) if len(sys.argv) > 2 else 5000)
            pg.screenshot(path=os.path.join(root, 'characters', 'stills', name)); print(name); print('\n'.join(l for l in logs if 'error' in l.lower())[:2000]); pg.close()
        b.close()
finally:
    srv.terminate()
