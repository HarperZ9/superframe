# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One room-meter trial end to end: room twin, signal chain, deconvolution, estimate, error against truth.

Speakers (low-frequency corner fc of a 2nd-order roll-off):
  ideal 20 Hz (a measurement loudspeaker), laptop 150 Hz, phone 400 Hz. The corner values are typical
  small-driver figures from memory, moderate confidence; the stage-3 spec says to measure the real one.
"""
import numpy as np

import chain
import meter
import modes

SPEAKERS = {"ideal": 20.0, "laptop": 150.0, "phone": 400.0}
F1, F2, T_SWEEP = 20.0, 1000.0, 10.0
FMAX_MODES = 900.0


def true_chain_ir(h_room, fc, scale, n):
    d = np.zeros(n)
    d[0] = 1.0
    hp = chain.biquad_highpass(d, fc) if fc > 0 else d
    return scale * chain.fftconv(hp, h_room)[:n]


def run(rng, speaker="laptop", noise_dba=30.0, dims=None, t60=None, method="all"):
    dims = dims or modes.random_room(rng)
    t60 = t60 or float(rng.uniform(0.3, 0.9))
    src, mic = modes.corner_positions(dims, rng)
    h_room, info = modes.impulse_response(dims, src, mic, t60, chain.FS, FMAX_MODES, rng)
    x, inv = chain.sweep(F1, F2, T_SWEEP)
    tail = np.zeros(int(2.5 * t60 * chain.FS) + chain.FS)
    y, clipped, scale = chain.record(np.concatenate([x, tail]), h_room, SPEAKERS[speaker], rng,
                                     noise_dba=noise_dba)
    L = len(h_room) + chain.FS
    h_est = chain.deconvolve(y, x, inv, F1, F2, length=L)
    est = meter.analyse(h_est, chain.FS, method=method)
    g = modes.geometry(dims)
    h_true = true_chain_ir(h_room, SPEAKERS[speaker], scale, len(h_room))
    t60_true = meter.schroeder_t60(h_room, chain.FS)[0]
    alpha_true = 0.161 * g["V"] / (g["S"] * t60_true)
    res = {"dims": [float(d) for d in dims], "V": g["V"], "S": g["S"], "t60_param": t60, "t60": t60_true, "alpha": alpha_true,
           "speaker": speaker, "noise_dba": noise_dba, "clipped": clipped, "est": est,
           "n_modes_true_in_band": None}
    if est.get("ok"):
        f = info["freqs"]
        res["n_modes_true_in_band"] = int(((f >= est["f_lo"]) & (f <= est["f_hi"])).sum())
        for k in ("S1", "S2", "S3", "S4"):
            fit = est.get(k)
            res["errV_" + k] = (fit["V"] / g["V"] - 1) if fit else float("nan")
        res["errS_S3"] = est["S3"]["S"] / g["S"] - 1
        res["errT60"] = est["t60"] / t60_true - 1
        res["errAlpha"] = est["alpha_sabine"] / alpha_true - 1
    res["_h"] = (h_true, h_est, scale)
    return res
