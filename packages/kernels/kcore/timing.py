# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Timing with the GPU clock's memory in mind.

Le et al. (arXiv 2607.08307, abstract read 2026-10-30) report that NVIDIA clocks track roughly the
previous 80 ms of workload, so back-to-back timings are not independent. Every arm here gets a
warm-up, the arms run interleaved in a seeded random order, each call follows a cool-down gap longer
than that window, and each arm reports its median with a bootstrap 95 % interval of the median.
"""
import random
import statistics
import time


def _boot_median(xs, rng, n=400):
    meds = sorted(statistics.median(rng.choices(xs, k=len(xs))) for _ in range(n))
    return meds[int(0.025 * n)], meds[int(0.975 * n) - 1]


def measure(arms, reps=9, warmup=2, gap_s=0.1, seed=0):
    """arms: {name: callable returning elapsed seconds}. Returns {name: {median, ci95, n}}."""
    rng = random.Random(seed)
    for fn in arms.values():
        for _ in range(warmup):
            fn()
    order = [name for name in arms for _ in range(reps)]
    rng.shuffle(order)
    got = {name: [] for name in arms}
    for name in order:
        time.sleep(gap_s)
        got[name].append(arms[name]())
    return {name: {"median": statistics.median(v), "ci95": _boot_median(v, rng), "n": len(v)}
            for name, v in got.items()}
