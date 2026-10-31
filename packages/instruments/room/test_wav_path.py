# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known-answer test of the real-recording path (CHECKS.json `knowninject`): no twin, only files.

Writes the 48 kHz sweep WAV, builds a 'recording' as the sweep through six planted modes (two 1 Hz apart),
with a 12345-sample delay, 16-bit quantisation and white noise, then runs receipt.from_wav on the two files.
Pass: every planted mode found within 0.05 Hz and its decay time within 5 percent; T60 within 15 percent of
the planted median. This test caught deviation D1 (circular band-filter ringing in the T60 and resampler).

    python -B test_wav_path.py OUTDIR
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import chain  # noqa: E402
import receipt  # noqa: E402
import roundtrip  # noqa: E402


def main(outdir):
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    fs = 48000
    receipt.write_sweep_wav(out / "sweep.wav", fs)
    x, _ = receipt.read_wav(out / "sweep.wav")
    h = roundtrip.planted_ir(fs=fs, seconds=2.5)
    y = chain.fftconv(np.concatenate([np.zeros(12345), x]), h)[:len(x) + 12345 + fs]
    y = y / np.max(np.abs(y)) * 0.3 + 1e-4 * np.random.default_rng(1).normal(size=len(y))
    with wave.open(str(out / "rec.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(fs)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())
    est = receipt.from_wav(out / "sweep.wav", out / "rec.wav")
    pm, pd = np.array(est.get("pencil_modes", [])), np.array(est.get("pencil_decay", []))
    rows = []
    for f, t60 in roundtrip.PLANTED:
        i = int(np.argmin(np.abs(pm - f))) if len(pm) else None
        got_f = float(pm[i]) if i is not None else None
        got_t = float(6.91 / pd[i]) if i is not None else None
        ok = i is not None and abs(got_f - f) <= 0.05 and abs(got_t / t60 - 1) <= 0.05
        rows.append({"f": f, "t60": t60, "found_f": got_f, "found_t60": got_t, "ok": ok})
    t_med = float(np.median([t for _, t in roundtrip.PLANTED]))
    res = {"test": "wav-path known answer", "modes": rows, "t60": est.get("t60"),
           "t60_ok": est.get("t60") is not None and abs(est["t60"] / t_med - 1) <= 0.15,
           "n_found": int(len(pm)), "spurious": int(len(pm) - len(rows))}
    res["pass"] = all(r["ok"] for r in rows) and res["t60_ok"]
    return res


def test_wav_path_recovers_the_planted_modes(tmp_path):
    r = main(tmp_path)
    assert r["pass"], r


if __name__ == "__main__":
    r = main(sys.argv[1] if len(sys.argv) > 1 else "wav-test")
    print(json.dumps(r, indent=1))
    sys.exit(0 if r["pass"] else 1)
