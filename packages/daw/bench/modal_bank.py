# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Modal bank cost in numpy: the per-sample recursion (a real-time style loop) and the offline closed form.

    python -I modal_bank.py N [recursion|closed]
The closed form sums A exp(-d t) sin(w t) over modes in time blocks, which is how the offline renderer works.
"""
import json
import sys
import time

import numpy as np

N = int(sys.argv[1]) if len(sys.argv) > 1 else 1024
MODE = sys.argv[2] if len(sys.argv) > 2 else "closed"
FS, S = 48000, 96000
f = 50.0 + 15.0 * np.arange(N)
r = np.exp(-3.0 / FS)
t0 = time.perf_counter()
if MODE == "recursion":
    seconds = 0.1                      # the loop is slow; time a tenth and scale
    a1, a2 = 2 * r * np.cos(2 * np.pi * f / FS), r * r
    y1, y2, out = np.zeros(N), np.zeros(N), np.zeros(int(FS * seconds))
    for n in range(len(out)):
        y = a1 * y1 - a2 * y2 + (1.0 / N if n == 0 else 0.0)
        y2, y1 = y1, y
        out[n] = y.sum()
    wall = (time.perf_counter() - t0) * (2.0 / seconds)
else:
    out = np.zeros(S)
    w, block = 2 * np.pi * f, 2048
    for s in range(0, S, block):
        t = np.arange(s, min(s + block, S)) / FS
        out[s:s + len(t)] = (np.exp(-3.0 * t)[None, :] * np.sin(np.outer(w, t))).sum(0) / N
    wall = time.perf_counter() - t0
print(json.dumps({"lang": f"numpy-{MODE}", "modes": N, "seconds_audio": 2, "wall": round(wall, 4)}))
