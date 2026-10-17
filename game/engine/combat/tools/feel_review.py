"""Close-up review material from a feel capture (tools/feel_capture.py): a follow camera on Lamb, a
quarter-speed reel of each named move, and contact sheets, so feel can be judged frame by frame.

    python game/engine/combat/tools/feel_review.py <capture dir>

Writes close.mp4 (800 x 450 around Lamb, shown at 1600 x 900, 60 fps), moves-slow.mp4 (each move
from 20 frames before to 40 after, at quarter speed, labelled), sheet-<move>.png (every second frame
of the same span), and review.json (frame numbers used). Reads frames/ and capture.json only.
"""
import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw

W, H = 800, 450


def main():
    d = Path(sys.argv[1]); rec = json.loads((d / "capture.json").read_text(encoding="utf-8"))
    track = {f: (l, foes) for f, l, foes in rec["track"]}
    frames = sorted(int(p.stem[1:]) for p in (d / "frames").glob("f*.png"))
    # follow Lamb, smoothed over a quarter second, held when Lamb is off screen
    centre, cx, cy = {}, 960.0, 540.0
    for f in frames:
        l = track.get(f, (None, None))[0]
        if l: cx += (l[0] - cx) * 0.12; cy += (l[1] - 80 - cy) * 0.12
        centre[f] = (min(1920 - W / 2, max(W / 2, cx)), min(1080 - H / 2, max(H / 2, cy)))
    def crop(f, label=None):
        x, y = centre[f]; im = Image.open(d / "frames" / f"f{f:05d}.png").crop((int(x - W / 2), int(y - H / 2), int(x + W / 2), int(y + H / 2))).resize((W * 2, H * 2), Image.NEAREST)
        if label: ImageDraw.Draw(im).text((16, 12), label, fill="white")
        return im
    close = d / "close"; close.mkdir(exist_ok=True)
    for i, f in enumerate(frames): crop(f, f"frame {f}").save(close / f"c{i:05d}.png")
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    enc = lambda src, dst, fps=60: subprocess.run([ff, "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(src), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(dst)], check=True)
    enc(close / "c%05d.png", d / "close.mp4")
    # the named moves: Lamb's first of each, and the world's answers
    want = {"catch (parry)": lambda e: e["type"] == "move" and e.get("id") == "lamb" and str(e.get("move", "")).endswith(":catch"),
            "sidestep (dodge)": lambda e: e["type"] == "move" and e.get("id") == "lamb" and str(e.get("move", "")).endswith(":step"),
            "roll or dash": lambda e: e["type"] == "move" and e.get("id") == "lamb" and ":roll" in str(e.get("move", "")),
            "string (light 1-2-3)": lambda e: e["type"] == "move" and e.get("id") == "lamb" and str(e.get("move", "")).endswith("light_1"),
            "heavy": lambda e: e["type"] == "move" and e.get("id") == "lamb" and str(e.get("move", "")).endswith(":heavy"),
            "running strike": lambda e: e["type"] == "move" and e.get("id") == "lamb" and str(e.get("move", "")).endswith(":run"),
            "lunge (answer to kiting)": lambda e: e["type"] == "punish" and e.get("how") == "lunge",
            "thrown stone (answer to kiting)": lambda e: e["type"] == "punish" and e.get("how") == "throw",
            "Lamb hit": lambda e: e["type"] == "hit" and e.get("id") == "lamb",
            "Lamb lands a blow": lambda e: e["type"] == "hit" and e.get("by") == "lamb"}
    picks = {}
    for name, test in want.items():
        e = next((e for e in rec["events"] if test(e) and e["t"] + 40 <= frames[-1]), None)
        if e: picks[name] = e["t"]
    slow = d / "slow"; slow.mkdir(exist_ok=True); for_old = list(slow.glob("*.png"))
    for p in for_old: p.unlink()
    k = 0
    for name, t in picks.items():
        span = [f for f in range(t - 20, t + 41) if f in centre]
        for f in span:
            im = crop(f, f"{name}  frame {f} ({f - t:+d})  quarter speed")
            for _ in range(4): im.save(slow / f"s{k:05d}.png"); k += 1
        sh = [crop(f) for f in span[::2]]; cols = 8; rows = (len(sh) + cols - 1) // cols; tw, th = W // 2, H // 2
        S = Image.new("RGB", (tw * cols, th * rows)); dr = ImageDraw.Draw(S)
        for i, (f, im) in enumerate(zip(span[::2], sh)): S.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th)); dr.text(((i % cols) * tw + 4, (i // cols) * th + 4), f"{f - t:+d}", fill="white")
        S.save(d / f"sheet-{name.split(' ')[0]}.png")
    if k: enc(slow / "s%05d.png", d / "moves-slow.mp4")
    (d / "review.json").write_text(json.dumps({"picks": picks, "frames": [frames[0], frames[-1]]}, indent=1), encoding="utf-8")
    print(json.dumps(picks))


if __name__ == "__main__":
    main()
