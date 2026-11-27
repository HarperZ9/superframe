# SPDX-License-Identifier: MIT
"""Serve the repo and run examples/browser.html in headless Chromium.

Writes examples/out/<webgl2-dir>/{frame.rgb, ao.f32, mask.u8, receipt.json}
and examples/out/sound-js-browser, examples/out/sound-webaudio (pcm.s16,
receipt.json). Needs `pip install playwright` and `playwright install chromium`.
SUPERSTACK_GPU=1 asks Chromium for the hardware GPU (ANGLE on D3D11 on
Windows); otherwise Chromium falls back to SwiftShader.
"""
from __future__ import annotations

import base64
import functools
import http.server
import json
import os
import sys
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / "out"
sys.path.insert(0, str(ROOT))
import superstack as ss  # noqa: E402

GPU = os.environ.get("SUPERSTACK_GPU") == "1"
GL_DIR = "webgl2-gpu" if GPU else "webgl2-swiftshader"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json"}

    def log_message(self, *a):
        pass


def write(dirname, files, rec):
    d = OUT / dirname
    d.mkdir(parents=True, exist_ok=True)
    for k, v in files.items():
        (d / k).write_bytes(v)
    errs = ss.verify_receipt(rec)
    if errs:
        raise SystemExit(f"{dirname}: receipt invalid {errs}")
    (d / "receipt.json").write_text(ss.canonical(rec), encoding="utf-8")


def main():
    from playwright.sync_api import sync_playwright

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/examples/browser.html"
    with sync_playwright() as p:
        extra = ["--use-angle=d3d11", "--enable-gpu"] if GPU and sys.platform == "win32" else (["--enable-gpu"] if GPU else [])
        b = p.chromium.launch(args=["--ignore-gpu-blocklist", "--autoplay-policy=user-gesture-required", *extra])
        page = b.new_page()
        logs = []
        page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
        page.goto(url)
        res = page.evaluate("window.__examples")
        version = b.version
        b.close()
    srv.shutdown()
    scene = json.loads((HERE / "pixels" / "scene.json").read_text(encoding="utf-8"))
    sound = json.loads((HERE / "sound" / "sound.json").read_text(encoding="utf-8"))
    px, au = res["pixels"], res["audio"]
    if "error" not in px:
        files = {"frame.rgb": base64.b64decode(px["frame"]), "ao.f32": base64.b64decode(px["ao"]),
                 "mask.u8": base64.b64decode(px["mask"])}
        if px["sceneSha256"] != ss.canonical_sha256(scene) or px["contentSha256"] != ss.sha256_hex(files["frame.rgb"]):
            raise SystemExit("browser and Python disagree on a hash")
        rec = ss.make_receipt(producer="superstack-example-gl2", version="0.1.0", backend="webgl2", scene=scene,
                              content=files["frame.rgb"],
                              media={"kind": "image", "width": 256, "height": 256, "format": "rgb8", "transfer": "srgb-u8",
                                     "device": {**px["info"], "chromium": version}},
                              outputs={k: ss.sha256_hex(v) for k, v in files.items()},
                              does_not_prove=["Checked on one adapter and driver only.",
                                              "GLSL cos, sin and sqrt precision is implementation-defined."])
        write(GL_DIR, files, rec)
    for name, key, backend in (("sound-js-browser", "exact", "js-f64-browser"), ("sound-webaudio", "webaudio", "webaudio-offline")):
        if "error" in au:
            break
        if au["sceneSha256"] != ss.canonical_sha256(sound) or au["seedU32"] != ss.xmur3(sound["seed"]):
            raise SystemExit("browser and Python disagree on the sound scene or seed")
        pcm = base64.b64decode(au[key]["pcm"])
        media = {"kind": "audio", "content": "music", "rate": sound["rate"], "channels": 1, "format": "s16le",
                 "frames": len(pcm) // 2, "duration_flicks": len(pcm) // 2 * ss.flicks_per_sample(sound["rate"]),
                 "access": {"autoplay": False, "captions": None, "transcript": False, "reduced_sound": "silent"}}
        rec = ss.make_receipt(producer="superstack-example-sound-browser", version="0.1.0", backend=backend,
                              scene=sound, content=pcm, media=media, outputs={"pcm.s16": ss.sha256_hex(pcm)},
                              does_not_prove=["Rendered offline in headless Chromium; a live AudioContext on a device "
                                              "adds resampling and output latency this check does not see."])
        write(name, {"pcm.s16": pcm}, rec)
    print(json.dumps({"chromium": version, "pixels_error": px.get("error"), "audio_error": au.get("error"),
                      "device": px.get("info"), "logs": logs[:10]}, indent=2))
    return 0 if "error" not in px and "error" not in au else 1


if __name__ == "__main__":
    sys.exit(main())
