# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Decoders. Images go through PIL; video and audio go through the ffmpeg binary that ships with
imageio-ffmpeg. Inputs are data: ffmpeg is called with an argument list (no shell), stdin closed,
a timeout, and output to a pipe, so decoded frames and samples stay in memory and are never saved.
"""
import io
import re
import subprocess

import numpy as np
from PIL import Image

from .config import use_libs

use_libs("design-parts")
from design_parts.imageio import normalise, to_array  # noqa: E402

Image.MAX_IMAGE_PIXELS = 200_000_000
SR = 22050


def ffmpeg_exe():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def _run(args, timeout=120):
    p = subprocess.run([ffmpeg_exe(), "-nostdin", "-hide_banner", "-v", "error"] + args,
                       stdin=subprocess.DEVNULL, capture_output=True, timeout=timeout, shell=False)
    return p.stdout, p.stderr.decode("utf-8", "replace")


def duration(path):
    p = subprocess.run([ffmpeg_exe(), "-nostdin", "-hide_banner", "-i", path], stdin=subprocess.DEVNULL,
                       capture_output=True, timeout=60, shell=False)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", p.stderr.decode("utf-8", "replace"))
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else None


def image_array(path_or_img, side=256):
    """Float RGB in [0, 1] through the design-parts normaliser (512, JPEG q80), then `side`."""
    im = path_or_img
    if isinstance(path_or_img, str):
        im = Image.open(path_or_img)
        if getattr(im, "is_animated", False):
            im.seek(0)
        im = im.convert("RGB")
    if isinstance(im, np.ndarray):
        return to_array(im, side=side)
    return to_array(normalise(im), side=side)


def gif_frames(path, n=5):
    im = Image.open(path)
    k = getattr(im, "n_frames", 1)
    out = []
    for i in sorted({int(j) for j in np.linspace(0, k - 1, min(n, k))}):
        im.seek(i)
        out.append(im.convert("RGB").copy())
    return out


def video_frames(path, n=5):
    """Up to n frames spread over the clip, as PIL images held in memory."""
    d = duration(path) or 1.0
    out = []
    for t in np.linspace(0.05, 0.95, n) * d:
        raw, _ = _run(["-ss", f"{t:.3f}", "-i", path, "-frames:v", "1", "-vf",
                       "scale=512:512:force_original_aspect_ratio=decrease", "-f", "image2pipe",
                       "-vcodec", "png", "pipe:1"], timeout=60)
        if raw:
            out.append(Image.open(io.BytesIO(raw)).convert("RGB"))
    return out


def frames(path, media_type, n=5):
    if media_type == "image/gif":
        return gif_frames(path, n)
    if media_type.startswith("video/"):
        return video_frames(path, n)
    return [Image.open(path).convert("RGB")]


def audio(path, sr=SR, max_s=120.0):
    """Mono float32 samples of the first max_s seconds; empty when the file has no audio stream."""
    raw, _ = _run(["-t", str(max_s), "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "pipe:1"],
                  timeout=180)
    return np.frombuffer(raw, dtype="<f4").astype(np.float64) if raw else np.zeros(0)


def read_wav(path):
    import soundfile as sf
    x, sr = sf.read(path, dtype="float64", always_2d=True)
    return x.mean(1), sr
