# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Pilot 2 (exploratory, seeds 1 and 2): choose the band rule and resolving widths before the lock."""
import sys
import numpy as np
sys.dont_write_bytecode = True
import chain, meter, pencil, trial  # noqa: E401,E402
cache = []
for seed in (1, 2):
    rng = np.random.default_rng(seed)
    for sp in ("ideal", "laptop", "phone"):
        for k in range(6):
            r = trial.run(rng, speaker=sp, method="fast")
            h = r["_h"][1]
            t60, ti = meter.schroeder_t60(h, chain.FS)
            f, s, n = meter.spectrum(h, chain.FS, ti["cut_s"])
            flo = meter.f_low(f, s, n)
            bw = 2.2 / t60
            pk = meter.pick_peaks(f, s, n, flo, 250, bw)
            pm, _ = pencil.modes_in_band(h, chain.FS, flo, 250, t60, sv_rel=1e-2)
            cache.append((r["V"], r["S"], t60, flo, bw, pk, pm, sp))
print("rooms", len(cache))
for fhi in (100, 150, 200, 250):
    for name, which, dels in (("S1", 5, [0.0]), ("S2", 5, [1.0, 1.5, 2.0]), ("S3", 6, [0.0, 0.3, 0.5, 0.8])):
        for d in dels:
            err = []
            for c in cache:
                fit = meter.poisson_fit(c[which], c[3], fhi, d * c[4])
                err.append(abs(fit["V"] / c[0] - 1) if fit else np.nan)
            err = np.array(err)
            print(fhi, name, d, "median", round(float(np.nanmedian(err)), 3), "fail", int(np.isnan(err).sum()),
                  "within25", round(float(np.nanmean(err < 0.25)), 2))
