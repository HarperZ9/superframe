# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Assemble the study's frames into GIFs and frame strips (Pillow, research tooling only), then
remove the loose frames. python -B study/make_gifs.py"""
import os
from pathlib import Path

from PIL import Image

OUT = Path(os.environ.get("CRT_STUDY_OUT", "out/crt-study"))


def strip(frames, path, every=4):
    pick = frames[::every]
    w, h = pick[0].size
    s = Image.new("RGB", (w * len(pick) + 4 * (len(pick) - 1), h), (0, 0, 0))
    for i, f in enumerate(pick):
        s.paste(f, (i * (w + 4), 0))
    s.save(path)


def gif(prefix, name, ms):
    paths = sorted(OUT.glob(f"_{prefix}-*.png"))
    frames = [Image.open(p).convert("RGB") for p in paths]
    frames[0].save(OUT / f"{name}.gif", save_all=True, append_images=frames[1:], duration=ms, loop=0, optimize=True)
    strip(frames, OUT / f"{name}-strip.png")
    for p in paths:
        p.unlink()
    return len(frames)


if __name__ == "__main__":
    print("roll", gif("roll", "shutter-250-rolling", 120))
    print("ball", gif("ball", "trail-ball", 90))
