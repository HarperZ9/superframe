# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Process-pool helpers: render a parameter vector and measure the render (picklable, top level)."""
import numpy as np
from PIL import Image

from . import extract, generate
from .imageio import to_array


def render_measure(job):
    """job = (params: dict, seed, palette_fixed, grid, save_path or None) -> feature dict."""
    p, seed, pal, grid, save = job
    a = generate.render(p, seed=seed, palette_fixed=pal, grid=grid)
    if save:
        Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(save)
    f, _ = extract.measure_all(to_array(a), do_wallpaper=False)
    return f


def run(jobs, workers=16):
    from concurrent.futures import ProcessPoolExecutor
    with ProcessPoolExecutor(workers) as ex:
        return list(ex.map(render_measure, jobs, chunksize=4))
