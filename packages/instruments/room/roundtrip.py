# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Stage 7, the round trip scored like a capsule: digital -> analog -> digital, bits lost and error against truth.

Three paths, each against a truth the twin knows exactly:
  ideal            the 16-bit sweep deconvolved with no analog stage: the reference every path is scored
                   against for bits lost.
  R0 loopback      DAC wired to ADC. Truth: the loopback gain times a unit impulse. Checks the sweep, the converters and the
                   deconvolution with no air in the way (HP's loopback self-test, CHECKS.json `loopback`).
  R1 injection     a planted room of six known modes (two of them 1 Hz apart) through the laptop speaker,
                   the air and the mic. Truth: the planted frequencies and decay rates (CHECKS.json
                   `knowninject`). Gate: every planted mode read back within 0.2 Hz, decay within 15 percent.
  R2 full chain    a random shoebox through the laptop chain. Truth: the twin's noise-free chain IR.

Truth for every path is passed through the same measurement operator (the exact float64 sweep and its
deconvolution), so the shared band-limiting of the sweep is not counted as damage.

Scores per path:
  error    normalised squared error of the transfer function in 40 to 150 Hz, in dB
  bits     per frequency bin, the linear-Gaussian information kept, 1/2 log2(1 + |H|^2 / |H_est - H|^2),
           averaged over the band; bits lost by a path are the ideal digital path's bits minus its own.
           Same estimator family as every-dimension/slice/infobits.py (linear, Gaussian, per bin).
"""
import numpy as np

import chain
import meter
import modes
import pencil
import trial

BAND = (40.0, 150.0)
PLANTED = [(47.0, 0.7), (48.0, 0.7), (63.5, 0.9), (88.0, 0.6), (101.0, 0.8), (131.0, 0.5)]


def _score(h_est, h_true, fs=chain.FS):
    n = min(len(h_est), len(h_true))
    m = 1 << int(np.ceil(np.log2(4 * n)))
    E, T = np.fft.rfft(h_est[:n], m), np.fft.rfft(h_true[:n], m)
    f = np.fft.rfftfreq(m, 1 / fs)
    b = (f >= BAND[0]) & (f <= BAND[1])
    err = np.sum(np.abs(E[b] - T[b]) ** 2) / np.sum(np.abs(T[b]) ** 2)
    bits = 0.5 * np.log2(1 + np.abs(T[b]) ** 2 / (np.abs(E[b] - T[b]) ** 2 + 1e-300))
    return {"error_db": float(10 * np.log10(err + 1e-300)), "bits_per_bin": float(np.mean(bits)),
            "n_bins": int(b.sum())}


def _measured_truth(h_true, length):
    """Truth as the measurement operator sees it: the exact sweep through the true IR, deconvolved in
    float64 with no converter, speaker distortion or noise. The band-limiting of the sweep is then shared by
    truth and estimate, so the score isolates what the analog path destroys."""
    x, inv = _sweep()
    y = chain.fftconv(np.concatenate([x, np.zeros(length)]), h_true)[:len(x) + length]
    return chain.deconvolve(y, x, inv, trial.F1, trial.F2, length=length)


def _sweep():
    return chain.sweep(trial.F1, trial.F2, trial.T_SWEEP)


def ideal_digital(rng):
    """The reference path: 16-bit sweep deconvolved with no analog stage at all."""
    x, inv = _sweep()
    xq, _ = chain.quantise(np.concatenate([x, np.zeros(chain.FS)]))
    h = chain.deconvolve(xq, x, inv, trial.F1, trial.F2, length=chain.FS)
    d = np.zeros(chain.FS)
    d[0] = 1.0
    return _score(h, _measured_truth(d, chain.FS))


def r0_loopback(rng):
    x, inv = _sweep()
    y, clipped, g = chain.loopback(np.concatenate([x, np.zeros(chain.FS)]), rng)
    h = chain.deconvolve(y, x, inv, trial.F1, trial.F2, length=chain.FS)
    d = np.zeros(chain.FS)
    d[0] = g
    return {**_score(h, _measured_truth(d, chain.FS)), "clipped": clipped}


def planted_ir(fs=chain.FS, seconds=2.5):
    t = np.arange(int(seconds * fs)) / fs
    h = np.zeros_like(t)
    for f, t60 in PLANTED:
        h += np.cos(2 * np.pi * f * t) * np.exp(-6.91 / t60 * t)
    return h


def _through_chain(h_room, rng, speaker="laptop", noise_dba=30.0):
    x, inv = _sweep()
    tail = np.zeros(len(h_room) + chain.FS)
    y, clipped, scale = chain.record(np.concatenate([x, tail]), h_room, trial.SPEAKERS[speaker], rng,
                                     noise_dba=noise_dba)
    h_est = chain.deconvolve(y, x, inv, trial.F1, trial.F2, length=len(h_room) + chain.FS)
    h_true = trial.true_chain_ir(h_room, trial.SPEAKERS[speaker], scale, len(h_room))
    return h_est, _measured_truth(h_true, len(h_room)), clipped


def r1_injection(rng):
    h_room = planted_ir()
    h_est, h_true, clipped = _through_chain(h_room, rng)
    t60 = float(np.median([p[1] for p in PLANTED]))
    fm, dm = pencil.modes_in_band(h_est, chain.FS, 40.0, 150.0, t60, sv_rel=1e-2)
    rows = []
    for f, t in PLANTED:
        if len(fm) == 0:
            rows.append({"f": f, "found": None, "df": None, "decay_err": None, "ok": False})
            continue
        i = int(np.argmin(np.abs(fm - f)))
        d_true = 6.91 / t
        df, de = float(fm[i] - f), float(dm[i] / d_true - 1)
        rows.append({"f": f, "found": float(fm[i]), "df": df, "decay_err": de,
                     "ok": abs(df) <= 0.2 and abs(de) <= 0.15})
    extra = int(len(fm) - len({int(np.argmin(np.abs(fm - f))) for f, _ in PLANTED})) if len(fm) else 0
    return {**_score(h_est, h_true), "modes": rows, "all_ok": all(r["ok"] for r in rows),
            "max_abs_df": max(abs(r["df"]) for r in rows if r["df"] is not None),
            "spurious": extra, "clipped": clipped}


def r2_full(rng, speaker="laptop", noise_dba=30.0):
    dims = modes.random_room(rng)
    t60 = float(rng.uniform(0.3, 0.9))
    src, mic = modes.corner_positions(dims, rng)
    h_room, _ = modes.impulse_response(dims, src, mic, t60, chain.FS, trial.FMAX_MODES, rng)
    h_est, h_true, clipped = _through_chain(h_room, rng, speaker, noise_dba)
    return {**_score(h_est, h_true), "V": modes.geometry(dims)["V"], "clipped": clipped,
            "t60_est": meter.schroeder_t60(h_est, chain.FS)[0]}


def run_all(seed=20261030, n_full=6):
    rng = np.random.default_rng(seed)
    ideal = ideal_digital(rng)
    r0 = r0_loopback(rng)
    r1 = r1_injection(rng)
    r2 = [r2_full(rng) for _ in range(n_full)]
    b2 = float(np.mean([r["bits_per_bin"] for r in r2]))
    return {"ideal": ideal, "R0": r0, "R1": r1, "R2": r2,
            "bits_lost": {"loopback": ideal["bits_per_bin"] - r0["bits_per_bin"],
                          "acoustic": ideal["bits_per_bin"] - b2},
            "gates": {"R0_error_below_-60dB": r0["error_db"] < -60, "R1_all_modes_within_tol": r1["all_ok"],
                      "R2_error_below_-20dB": all(r["error_db"] < -20 for r in r2)}}


if __name__ == "__main__":
    import json
    print(json.dumps(run_all(), indent=1, default=float))
