# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Bridge to the room meter (packages/instruments/room in this repository), run as a transducer.

measure: the impulse response of the planted six-mode room through the laptop speaker, air and mic twin
(roundtrip.r1_injection's path, one seed), band-limited to 40 to 150 Hz, with the planted truth.
modes: the modes the matrix pencil finds in an IR, complex amplitudes fitted to them by least squares (so
the modal record can be played back) and the resynthesis. Nothing here re-implements the meter: it imports chain, pencil and
roundtrip and calls them.

    python -I room_bridge.py measure [seed]     the band-limited IR of the planted room
    python -I room_bridge.py modes < req.json   modes of the IR in req.json ({h, fs, band_hz, t60})
"""
import json
import sys
from pathlib import Path

# packages/field/py -> packages/instruments/room (owned by the instruments package; called, not copied).
ROOM = Path(__file__).resolve().parents[2] / "instruments" / "room"
sys.path.insert(0, str(ROOM))

import numpy as np  # noqa: E402

import chain  # noqa: E402
import pencil  # noqa: E402
import roundtrip  # noqa: E402

BAND = (40.0, 150.0)


def fit_amplitudes(h, fs, freqs, decays, n):
    """Least-squares complex amplitudes for damped cosines and sines at the given poles, over n samples."""
    t = np.arange(n) / fs
    cols = []
    for f, d in zip(freqs, decays):
        env = np.exp(-d * t)
        cols += [env * np.cos(2 * np.pi * f * t), env * np.sin(2 * np.pi * f * t)]
    A = np.stack(cols, axis=1)
    coef, *_ = np.linalg.lstsq(A, h[:n], rcond=None)
    return coef, A @ coef


def measure(seed):
    """The planted room through the laptop chain twin, band-limited to 40 to 150 Hz."""
    rng = np.random.default_rng(seed)
    h_est, _h_true, clipped = roundtrip._through_chain(roundtrip.planted_ir(), rng)
    H = np.fft.rfft(h_est)
    f = np.fft.rfftfreq(len(h_est), 1 / chain.FS)
    H[(f < BAND[0]) | (f > BAND[1])] = 0
    n = int(1.5 * chain.FS)
    return {"fs": chain.FS, "seed": seed, "clipped": bool(clipped), "band_hz": BAND, "n": n,
            "h": np.fft.irfft(H, len(h_est))[:n].tolist(),
            "t60_nominal": float(np.median([p[1] for p in roundtrip.PLANTED])),
            "planted": [{"f": a, "t60": b, "decay_per_s": 6.91 / b} for a, b in roundtrip.PLANTED],
            "source": "roundtrip.planted_ir through roundtrip._through_chain (laptop speaker, 30 dBA), band-limited"}


def modes(req):
    """The transducer itself: an IR in, the matrix pencil's modes and their fitted amplitudes out."""
    h = np.asarray(req["h"], dtype=float)
    fm, dm = pencil.modes_in_band(h, req["fs"], req["band_hz"][0], req["band_hz"][1], req["t60"], sv_rel=1e-2)
    coef, synth = fit_amplitudes(h, req["fs"], fm, dm, len(h))
    return {"modes_hz": fm.tolist(), "decay_per_s": dm.tolist(), "amp": coef.tolist(), "synth": synth.tolist(),
            "method": "pencil.modes_in_band (sv_rel 1e-2) and least-squares amplitudes"}


if __name__ == "__main__":
    if sys.argv[1] == "measure":
        json.dump(measure(int(sys.argv[2]) if len(sys.argv) > 2 else 20261031), sys.stdout)
    else:
        json.dump(modes(json.load(sys.stdin)), sys.stdout)
