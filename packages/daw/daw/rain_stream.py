# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Rain as live engine events: the drops of a scene-physics record that leave a bubble, sent as they land.

    python -m daw.rain_stream [seconds] | buildc run packages/daw/bld/main.bld -- live

Each line is an event for the BuildLang host: engine time (s), kind 2 (a bubble), its Minnaert frequency (Hz),
damping constant, amplitude (with 1/r spreading to the record's listener), and the moment it was made on the
shared monotonic clock (time.perf_counter, QueryPerformanceCounter on Windows, as the host's clock). The drops,
their sizes, speeds and bubbles come from the same functions as the offline render (scene.py), so the live
and offline rain are one physics. Impact clicks are left to the offline render for now.
"""
import math
import sys
import time

import numpy as np

from . import scene as S


def bubble_events(record, seconds, rng):
    """(time heard, frequency, damping, amplitude) of every bubble the record's rain leaves in `seconds`."""
    c = S.nature.consts.water(293.15)["c"] if record["medium"] == "water" else 343.0
    lis = np.asarray(record["listener"], float)
    out = []
    for s in record["sources"]:
        if s["kind"] != "rain":
            continue
        t, d, v, pos = S.rain_events(s, seconds, rng)
        r = np.maximum(np.linalg.norm(pos - lis, axis=1), 0.05)
        for ti, di, ri in zip(t, d, r):
            radius = None
            if S.REGULAR[0] <= di <= S.REGULAR[1]:
                radius = 0.22e-3 * (1 + 0.1 * rng.standard_normal())
            elif di > 2.2 and rng.random() < 0.5:
                radius = rng.uniform(0.5e-3, 1.5e-3)
            if radius:
                out.append((ti + ri / c, S.nature.minnaert_frequency(radius), S.DELTA, 0.02 / ri))
    return sorted(out)


def stream(record, seconds):
    rng = np.random.default_rng(S.ss.xmur3(S.ss.substream(record["seed"], "rain")))
    events = bubble_events(record, seconds, rng)
    start = time.perf_counter()
    for t, f, delta, amp in events:
        wait = start + t - time.perf_counter()
        if wait > 0:
            time.sleep(wait)
        sys.stdout.write(f"{t:.6f} 2 {f:.3f} {delta} {amp:.6f} {time.perf_counter():.7f}\n")
        sys.stdout.flush()


if __name__ == "__main__":
    stream(S.RAIN_SCENE, float(sys.argv[1]) if len(sys.argv) > 1 else 5.0)
