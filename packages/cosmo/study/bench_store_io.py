# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Throughput of the out-of-core particle store (ooc.Store with a path: memory-mapped .npy files), for the
1024^3 projection. Writes one float32 column of --gib GiB in chunks, flushes it, then reads it back in the
same chunks into fresh arrays (the copy ooc.SlabRunner makes when it loads a window).

    python packages/cosmo/study/bench_store_io.py --dir E:/scratch/io --gib 24 --out io.json

Pick --gib above the free host RAM so the read cannot come from the page cache. The file is deleted at
the end.
"""
import argparse
import json
import os
import time
from pathlib import Path

import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--gib", type=float, default=24.0)
    ap.add_argument("--chunk-mib", type=int, default=256)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    Path(a.dir).mkdir(parents=True, exist_ok=True)
    path = str(Path(a.dir) / "bench_col.npy")
    n = int(a.gib * 2 ** 30 / 4)
    step = a.chunk_mib * 2 ** 20 // 4
    src = np.random.default_rng(1).random(step, dtype=np.float32)
    col = np.lib.format.open_memmap(path, mode="w+", dtype=np.float32, shape=(n,))
    t0 = time.perf_counter()
    for i in range(0, n, step):
        j = min(n, i + step)
        col[i:j] = src[:j - i]
    col.flush()
    del col
    t_write = time.perf_counter() - t0
    col = np.load(path, mmap_mode="r")
    t0 = time.perf_counter()
    s = 0.0
    for i in range(0, n, step):
        piece = np.array(col[i:min(n, i + step)])
        s += float(piece[0])
    t_read = time.perf_counter() - t0
    del col
    os.remove(path)
    gb = n * 4 / 1e9
    res = {"gib": a.gib, "chunk_mib": a.chunk_mib, "write_seconds": t_write, "read_seconds": t_read,
           "write_gb_s": gb / t_write, "read_gb_s": gb / t_read, "dir": a.dir, "check": s}
    Path(a.out).write_text(json.dumps(res, indent=1))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
