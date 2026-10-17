"""Capture the combat arena headless on the CPU (no GPU, no window) for judging feel.

    python game/engine/combat/tools/capture.py --scenario pair --seed 3 --seconds 40 --out <dir>

Starts game/serve.mjs on a local port, opens the arena in headless Chromium with the GPU off,
lets the scripted pilot drive Lamb, steps the fixed loop through window.__arena.tick, and writes
PNG frames, a contact sheet, a JSON log of the fight's events, and an H.264 file with --video.
Run it through tools/idle.sh so it runs at Idle priority. Nothing leaves the machine.
"""
import argparse, base64, json, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAME = HERE.parents[2]


def sheet(frames, out, cols=6, width=1920):
    from PIL import Image
    ims = [Image.open(f) for f in frames]
    w = width // cols; h = int(w * ims[0].height / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    S = Image.new("RGB", (w * cols, h * rows), (10, 6, 8))
    for i, im in enumerate(ims):
        S.paste(im.resize((w, h)), ((i % cols) * w, (i // cols) * h))
    S.save(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", default="pair")
    ap.add_argument("--seed", type=int, default=3)
    ap.add_argument("--seconds", type=float, default=40)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--every", type=int, default=1, help="write every Nth frame")
    ap.add_argument("--sheet-every", type=int, default=60, help="frames between contact-sheet cells")
    ap.add_argument("--port", type=int, default=8742)
    ap.add_argument("--out", required=True)
    ap.add_argument("--video", action="store_true")
    a = ap.parse_args()
    out = Path(a.out); fr = out / "frames"; fr.mkdir(parents=True, exist_ok=True)
    for f in fr.glob("*.png"): f.unlink()
    srv = subprocess.Popen(["node", str(GAME / "serve.mjs"), "--port", str(a.port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    from playwright.sync_api import sync_playwright
    logs, written = [], []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, args=["--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas", "--disable-gpu-rasterization"])
            pg = b.new_page(viewport={"width": 1280, "height": 720})
            pg.on("console", lambda m: logs.append(m.text))
            pg.on("pageerror", lambda e: logs.append("PAGEERROR " + str(e)))
            pg.goto(f"http://127.0.0.1:{a.port}/engine/combat/arena/?capture=1&pilot=1&scenario={a.scenario}&seed={a.seed}")
            pg.wait_for_function("window.__arena !== undefined", timeout=120000)
            n = int(a.seconds * a.fps); ended = None
            for i in range(n):
                pg.evaluate(f"window.__arena.tick({1.0 / a.fps})")
                if i % a.every == 0:
                    data = pg.evaluate("document.getElementById('c').toDataURL('image/png')")
                    f = fr / f"f{i:05d}.png"; f.write_bytes(base64.b64decode(data.split(",", 1)[1])); written.append(f)
                if ended is None and pg.evaluate("!!window.__arena.W.result"):
                    ended = i
                if ended is not None and i - ended > a.fps * 3:
                    break
            summary = pg.evaluate("window.__arena.summary()")
            events = pg.evaluate("window.__arena.log")
            b.close()
    finally:
        srv.terminate()
    (out / "fight.json").write_text(json.dumps({"scenario": a.scenario, "seed": a.seed, "summary": summary, "events": events, "console": logs}, indent=1), encoding="utf-8")
    step = max(1, a.sheet_every // a.every)
    sheet(written[::step], out / "sheet.png")
    if a.video:
        import imageio_ffmpeg
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-framerate", str(a.fps // a.every), "-i", str(fr / "f%05d.png"),
                        "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", str(out / "arena.mp4")], check=True)
    print(json.dumps(summary), "frames", len(written), "errors", [l for l in logs if "ERROR" in l.upper()][:5])


if __name__ == "__main__":
    main()
