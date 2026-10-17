"""Drive the Low Water prototype headless on the CPU (no GPU, no window) for stills and video.

    python game/tools/drive.py --script game/tools/demo.json --out game/capture [--fps 30] [--video]

Starts game/serve.mjs, opens the page in headless Chromium with the GPU disabled, steps the game
in fixed frames through window.__lw.tick, plays the demo script, and writes PNG frames (and an
H.264 file with --video, through the imageio-ffmpeg binary).
"""
import argparse, base64, json, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAME = HERE.parent

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", default=str(HERE / "demo.json"))
    ap.add_argument("--out", default=str(GAME / "capture"))
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--port", type=int, default=8731)
    ap.add_argument("--video", action="store_true")
    ap.add_argument("--every", type=int, default=1, help="write every Nth frame")
    ap.add_argument("--keep-frames", action="store_true")
    a = ap.parse_args()
    out = Path(a.out); (out / "frames").mkdir(parents=True, exist_ok=True)
    for f in (out / "frames").glob("*.png"): f.unlink()
    srv = subprocess.Popen(["node", str(GAME / "serve.mjs"), "--port", str(a.port)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    time.sleep(1.0)
    from playwright.sync_api import sync_playwright
    steps = json.loads(Path(a.script).read_text(encoding="utf-8"))
    dt = 1.0 / a.fps
    n = 0
    rec = [True]
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, args=["--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas", "--disable-gpu-rasterization"])
            pg = b.new_page(viewport={"width": 1280, "height": 720})
            logs = []
            pg.on("console", lambda m: logs.append(m.text))
            pg.on("pageerror", lambda e: logs.append("PAGEERROR " + str(e)))
            pg.goto(f"http://127.0.0.1:{a.port}/?capture=1")
            pg.wait_for_function("window.__lw !== undefined", timeout=120000)
            def frame(save=True):
                nonlocal n
                pg.evaluate(f"window.__lw.tick({dt})")
                if not rec[0]: return
                if save and n % a.every == 0:
                    data = pg.evaluate("document.getElementById('c').toDataURL('image/png')")
                    (out / "frames" / f"f{n // a.every:05d}.png").write_bytes(base64.b64decode(data.split(",", 1)[1]))
                n += 1
            for s in steps:
                if "rec" in s: rec[0] = bool(s["rec"])
                if "say" in s: print(s["say"], pg.evaluate("window.__lw && Math.round(window.__lw.night.clock)"), flush=True)
                if "eval" in s: pg.evaluate(s["eval"])
                if "press" in s: pg.evaluate(f"window.__lw.press({json.dumps(s['press'])})")
                if "tap" in s: pg.evaluate(f"window.__lw.tap({s['tap'][0]}, {s['tap'][1]})")
                if "hold" in s: pg.evaluate(f"window.__lw.hold({json.dumps(s['hold'])}, true)")
                if "release" in s: pg.evaluate(f"window.__lw.hold({json.dumps(s['release'])}, false)")
                if "walk" in s: pg.evaluate(f"window.__lw.walkTo([{s['walk'][0]}, 0, {s['walk'][1]}])")
                for _ in range(int(s.get("frames", 0))): frame()
                if "read" in s:
                    # read the open scene at a reading pace: reveal a line, wait; close it when it ends
                    per = int(s["read"])
                    for _ in range(60):
                        if not pg.evaluate("window.__lw.talking") or pg.evaluate("window.__lw.optionsShown"): break
                        for _ in range(per): frame()
                        if pg.evaluate("!!(window.__lw.S.talk && window.__lw.S.shown >= window.__lw.S.talk.beat.lines.length && !window.__lw.S.talk.beat.options)"):
                            pg.evaluate("window.__lw.press('Space')"); frame(); break
                        pg.evaluate("window.__lw.reveal()")
                if "choose" in s: pg.evaluate(f"window.__lw.chooseLabel({json.dumps(s['choose'])})")
                if "go" in s: pg.evaluate(f"window.__lw.goTo({json.dumps(s['go'])})")
                if "until" in s:
                    for _ in range(int(s.get("max", 900))):
                        if pg.evaluate(s["until"]): break
                        frame()
                if "still" in s:
                    data = pg.evaluate("document.getElementById('c').toDataURL('image/png')")
                    (out / f"{s['still']}.png").write_bytes(base64.b64decode(data.split(",", 1)[1]))
            print("\n".join(l for l in logs if "PAGEERROR" in l or "rror" in l)[:4000])
            b.close()
    finally:
        srv.terminate()
    print(f"{n} frames")
    if a.video:
        import imageio_ffmpeg
        ff = imageio_ffmpeg.get_ffmpeg_exe()
        subprocess.run([ff, "-y", "-loglevel", "error", "-framerate", str(a.fps / a.every), "-i", str(out / "frames" / "f%05d.png"), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out / "low-water-prototype.mp4")], check=True)
        print("video", out / "low-water-prototype.mp4")
        if not a.keep_frames:
            for f in (out / "frames").glob("*.png"): f.unlink()

if __name__ == "__main__":
    main()
