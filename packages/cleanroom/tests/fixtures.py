# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Synthetic sources with answers set by construction. No saved artifact is used in a test."""
import io
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from cleanroom.config import use_libs  # noqa: E402

use_libs("design-parts")
from design_parts import generate  # noqa: E402


def textured(seed, size=512):
    """A busy, photo-like picture: generated shapes over 1/f noise with random strokes."""
    rng = np.random.default_rng(seed)
    p = {"palette_count": 5, "harm_m1": 0.3, "hue_cos": np.cos(seed), "hue_sin": np.sin(seed), "L_key": 55,
         "L_range": 70, "chroma_mean": 40, "neg_space": 0.3, "prim_count": 25, "straight_share": 0.5,
         "prim_size_cv": 0.8, "sym_lr": 0.0, "focal_x": 0.5, "focal_y": 0.5, "line_weight": 3,
         "self_sim": 0.1, "orth_share": 0.3, "spec_slope": -2.0}
    base = generate.render(p, size=size, seed=seed)
    fy, fx = np.fft.fftfreq(size)[:, None], np.fft.fftfreq(size)[None, :]
    f = np.hypot(fy, fx)
    f[0, 0] = 1
    n = np.real(np.fft.ifft2(f ** -1.0 * np.exp(2j * np.pi * rng.random((size, size)))))
    n = (n - n.mean()) / n.std()
    a = np.clip(base * 0.75 + 0.12 * n[..., None] + 0.08 * rng.random((size, size, 3)), 0, 1)
    im = Image.fromarray((a * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for _ in range(60):
        x0, y0 = rng.integers(0, size, 2)
        x1, y1 = np.clip([x0 + rng.integers(-120, 120), y0 + rng.integers(-120, 120)], 0, size - 1)
        d.line([int(x0), int(y0), int(x1), int(y1)], fill=tuple(int(v) for v in rng.integers(0, 255, 3)),
               width=int(rng.integers(1, 5)))
    return im


def save_jpeg(im, path, q=92):
    im.save(path, "JPEG", quality=q)
    return path


def light_edit(im):
    """Brightness +4%, a 10%-area box painted over, a 6% crop rescaled back, JPEG q85."""
    w, h = im.size
    a = np.asarray(im, float) * 1.04
    e = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    ImageDraw.Draw(e).rectangle([int(w * .1), int(h * .1), int(w * .1 + w * .316), int(h * .1 + h * .316)],
                                fill=(200, 40, 40))
    e = e.crop((int(w * .03), int(h * .03), int(w * .97), int(h * .97))).resize((w, h), Image.LANCZOS)
    buf = io.BytesIO()
    e.save(buf, "JPEG", quality=85)
    return Image.open(io.BytesIO(buf.getvalue())).convert("RGB")


def paste_region(base_im, donor_im, share):
    """Paste an intact square of donor_im covering `share` of base_im's area."""
    w, h = base_im.size
    s = int((share * w * h) ** 0.5)
    out = base_im.copy()
    out.paste(donor_im.resize((w, h)).crop((40, 40, 40 + s, 40 + s)), (w - s - 20, h - s - 20))
    return out


def tone_wav(path, seconds=10.0, sr=22050, seed=0):
    import soundfile as sf
    rng = np.random.default_rng(seed)
    t = np.arange(int(seconds * sr)) / sr
    notes = rng.choice([220, 247, 262, 294, 330, 349, 392], size=int(seconds * 4))
    f = notes[(t * 4).astype(int).clip(0, len(notes) - 1)]
    x = 0.4 * np.sin(2 * np.pi * np.cumsum(f) / sr) + 0.05 * rng.normal(size=len(t))
    sf.write(path, x, sr, subtype="PCM_16")
    return path
