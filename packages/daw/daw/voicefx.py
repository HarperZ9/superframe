# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A modulation chain for any voice: pitch and formants moved independently, harmoniser, channel vocoder,
breath, varispeed, and the pitched-and-chopped sampler moves.

Pitch and formants are separate controls. Pitch moves by a phase-vocoder stretch followed by varispeed, which
moves every partial by the ratio and returns the duration; that also moves the formants. The formants are then
put where they are asked to be: each frame is divided by its own true envelope and multiplied by the source's
envelope warped by the formant ratio (1 keeps the speaker's tract, 1.2 is a tract about 17 percent shorter).
The vocoder is the channel vocoder of Dudley (1939): log-spaced band-pass filters, the modulator's band
envelopes imposed on the carrier's bands, each carrier band normalised by its own envelope so the carrier's
tilt does not leak. Breath is noise shaped by the voice's own envelope and gated by its loudness, scaled to a
requested harmonics-to-noise ratio. The chop is a sampler on a beat grid: slices of the source, each optionally
pitched (varispeed, as a sampler repitches), reversed and gated, laid on exact sample boundaries, each with the
source's sha256 and its own.
"""
import hashlib
import math

import numpy as np
from scipy.signal import butter, sosfilt, sosfiltfilt

from . import spectral as S


def _fit(y, n):
    return y[:n] if len(y) >= n else np.pad(y, (0, n - len(y)))


def sha(x):
    return hashlib.sha256(np.ascontiguousarray(x, dtype=np.float64).tobytes()).hexdigest()


def reshape_formants(y, ref, fs, ratio=1.0, f0=None):
    """y with each frame's envelope replaced by ref's envelope moved by `ratio` (same length as y)."""
    f0 = f0 or S.estimate_f0(ref, fs)
    order = max(8, int(fs / (2 * f0)))
    Y, R = S.stft(y), S.stft(_fit(ref, len(y)))
    ey = S.true_envelope(np.abs(Y), order)
    er = S.true_envelope(np.abs(R), order)
    if ratio != 1.0:
        er = S.warp(er, ratio)
    gain = np.minimum(er / np.maximum(ey, 1e-12), 1e3)
    return S.istft(Y * gain, len(y))


def pitch_shift(x, fs, semitones, formant_ratio=1.0, f0=None):
    """Pitch moved by `semitones`; formants moved by formant_ratio (1: kept; None: moved with the pitch)."""
    r = 2.0 ** (semitones / 12.0)
    y = _fit(S.varispeed(S.stretch(x, r), r), len(x))
    if formant_ratio is None:
        return y
    return reshape_formants(y, x, fs, formant_ratio, f0)


def formant_shift(x, fs, ratio, f0=None):
    """Formants moved by `ratio` at the same pitch."""
    return reshape_formants(np.asarray(x, float), x, fs, ratio, f0)


def harmonize(x, fs, intervals=(0, 4, 7), gains=None, formant_ratio=1.0):
    """The voice plus pitch-shifted copies at each interval in semitones (0 is the dry voice)."""
    gains = gains or [1.0] * len(intervals)
    f0 = S.estimate_f0(x, fs)
    out = np.zeros(len(x))
    for st, g in zip(intervals, gains):
        out += g * (np.asarray(x, float) if st == 0 else pitch_shift(x, fs, st, formant_ratio, f0))
    return out / max(1.0, sum(abs(g) for g in gains))


def _bands(fs, n, lo, hi):
    e = np.geomspace(lo, min(hi, 0.45 * fs), n + 1)
    return [butter(4, [a, b], "bandpass", fs=fs, output="sos") for a, b in zip(e[:-1], e[1:])], e


def _follow(x, fs, hz):
    return np.maximum(sosfiltfilt(butter(2, hz, fs=fs, output="sos"), np.abs(x)), 0.0)


def vocoder(carrier, modulator, fs, bands=24, lo=80.0, hi=8000.0, smooth_hz=40.0):
    """Channel vocoder: the modulator's band envelopes on the carrier's bands."""
    n = min(len(carrier), len(modulator))
    c, m = np.asarray(carrier[:n], float), np.asarray(modulator[:n], float)
    filt, _ = _bands(fs, bands, lo, hi)
    out = np.zeros(n)
    for sos in filt:
        cb, mb = sosfilt(sos, c), sosfilt(sos, m)
        ec, em = _follow(cb, fs, smooth_hz), _follow(mb, fs, smooth_hz)
        out += cb * em / (ec + 1e-4 * (ec.max() + 1e-12))
    return out


def breath(x, fs, hnr_db, seed, f0=None):
    """Aspiration noise in the voice's own spectral shape, gated by its loudness, at a harmonics-to-noise ratio."""
    x = np.asarray(x, float)
    f0 = f0 or S.estimate_f0(x, fs)
    X = S.stft(x)
    env = S.true_envelope(np.abs(X), max(8, int(fs / (2 * f0))))
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(X.shape) + 1j * rng.standard_normal(X.shape)
    n = S.istft(noise * env, len(x))
    scale = math.sqrt(np.sum(x * x) * 10 ** (-hnr_db / 10) / max(np.sum(n * n), 1e-30))
    return x + scale * n


def chop(x, fs, bpm, steps, division=16, fade_ms=2.0):
    """A pattern of slices on a grid of 1/division notes. Each step is None (a rest) or a dict with
    slice (index on the same grid), st (semitones, varispeed), reverse (bool), gate (fraction of the step).
    Returns (audio, receipt rows)."""
    x = np.asarray(x, float)
    L = int(round(fs * 240.0 / (bpm * division)))
    src = sha(x)
    out, rows = np.zeros(L * len(steps)), []
    fade = int(fade_ms * fs / 1000)
    for k, s in enumerate(steps):
        if s is None:
            continue
        piece = x[s["slice"] * L:(s["slice"] + 1) * L]
        if s.get("reverse"):
            piece = piece[::-1]
        if s.get("st"):
            piece = S.varispeed(piece, 2.0 ** (s["st"] / 12.0))
        piece = _fit(piece, L).copy()
        g = int(round(s.get("gate", 1.0) * L))
        piece[g:] = 0.0
        if fade:
            ramp = np.linspace(0.0, 1.0, fade)
            piece[:fade] *= ramp
            piece[max(0, g - fade):g] *= ramp[::-1][:g - max(0, g - fade)]
        out[k * L:(k + 1) * L] = piece
        rows.append({"step": k, "start": k * L, "length": L, "slice": s["slice"], "st": s.get("st", 0.0),
                     "reverse": bool(s.get("reverse")), "gate": s.get("gate", 1.0), "source_sha256": src,
                     "slice_sha256": sha(piece)})
    return out, rows


OPS = {
    "pitch": lambda x, fs, p: pitch_shift(x, fs, p["semitones"], p.get("formant_ratio", 1.0)),
    "formant": lambda x, fs, p: formant_shift(x, fs, p["ratio"]),
    "harmonize": lambda x, fs, p: harmonize(x, fs, tuple(p["intervals"]), p.get("gains")),
    "breath": lambda x, fs, p: breath(x, fs, p["hnr_db"], p["seed"]),
    "varispeed": lambda x, fs, p: S.varispeed(x, p["ratio"]),
    "stretch": lambda x, fs, p: S.stretch(x, p["factor"]),
}


def chain(x, fs, steps):
    """Apply [(name, params), ...] in order; returns (audio, receipt) with the hash after every step."""
    y, rec = np.asarray(x, float), [{"step": "input", "sha256": sha(x)}]
    for name, p in steps:
        y = OPS[name](y, fs, p)
        rec.append({"step": name, "params": p, "sha256": sha(y), "samples": len(y)})
    return y, rec
