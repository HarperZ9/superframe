# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Stage 9, data return: every reading leaves as a receipt on the existing measurement bus.

Format: one project-telos.measurement-bus/v1 event (the seventeen fields), with the every-dimension
`state` block (dimension, range, information, homeostasis), built by every-dimension/slice/bus.py itself,
plus one added key, `instrument`. A bus reader that ignores unknown keys still reads every event.
Schema of record: ../schemas/receipt.schema.json.

  instrument: {
    id, kind, build: {design_sha256, firmware_sha256, code_sha256},
    calibration: {state: PRIMARY | CALIBRATED | UNCAL, uncal: bool, record_sha256, reference, traceability, valid_until},
    conditions: {...the protocol and environment the value holds under},
    self_test: {loopback, known_inject, auto_zero: each {ran, pass, value}},
    sim: true when the reading came from the twin, not from the world
  }

The UNCAL flag follows the HP practice (CHECKS.json `uncal`): when any self-test fails, a calibration has
expired, or no reference has ever been used, the value still ships, flagged, and the bus status drops to
"estimated". A value is never silently dropped and never shown as calibrated when it is not.

Usage:
  python -B receipt.py sim            writes a receipt for a simulated room into ../examples/
  python -B receipt.py wav SWEEP REC  analyses a real recording made with any recorder (no capture code here)
"""
import datetime as dt
import hashlib
import json
import sys
import wave
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "bus"))
import bus  # noqa: E402

import chain  # noqa: E402
import meter  # noqa: E402
import trial  # noqa: E402

SCHEMA = "instrument-reading/0.1 (extends every-dimension.state/0.1, extends project-telos.measurement-bus/v1)"
CODE = ["modes.py", "chain.py", "meter.py", "pencil.py", "trial.py", "roundtrip.py", "receipt.py"]


def code_sha256():
    h = hashlib.sha256()
    for name in CODE:
        h.update(name.encode() + b"\0" + (HERE / name).read_bytes())
    return "sha256:" + h.hexdigest()


def calibration_state(self_test, cal_record=None):
    failed = [k for k, v in self_test.items() if v.get("ran") and not v.get("pass")]
    if cal_record is None or failed:
        return {"state": "UNCAL", "uncal": True, "record_sha256": None if cal_record is None else bus.sha(cal_record),
                "reference": None if cal_record is None else cal_record.get("reference"),
                "traceability": "none: no reference used yet" if cal_record is None else cal_record.get("traceability"),
                "why": "no calibration record" if cal_record is None else "self-test failed: " + ", ".join(failed),
                "valid_until": None}
    return {"state": cal_record.get("state", "CALIBRATED"), "uncal": False, "record_sha256": bus.sha(cal_record),
            "reference": cal_record["reference"], "traceability": cal_record["traceability"],
            "valid_until": cal_record.get("valid_until"), "why": None}


def reading(est, *, run_id, conditions, self_test, cal_record=None, sim=True, design_sha256=None):
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    cal = calibration_state(self_test, cal_record)
    s3 = est["S3"]
    value = {"volume_m3": s3["V"], "surface_m2": s3["S"], "t60_s": est["t60"],
             "alpha_sabine": est.get("alpha_sabine"), "modes_used": len(est.get("pencil_modes", [])),
             "band_hz": [est["f_lo"], est["f_hi"]]}
    unc = {"volume_rel_median": 0.16, "volume_rel_q90": 0.42, "t60_rel_median": 0.011,
           "basis": "twin study room-shape-meter, laptop speaker, |V_est / V - 1| over 80 simulated rooms "
                    "(run 20261031T004139Z, post hoc after deviation D1); a twin spread, not a field calibration"}
    status = "estimated" if cal["uncal"] else "calibrated"
    ev = bus.event(run_id, 0, "room.volume", domain="acoustics", dimension="space",
                   coordinate_space="room interior", units={"volume": "m^3", "surface": "m^2", "t60": "s"},
                   value_shape="object", value=value, rng=[5.0, 600.0], uncertainty=unc,
                   source="room-shape meter (Weyl mode count, matrix pencil)", timestamp=now,
                   information={"modes_in_band": len(est.get("pencil_modes", [])),
                                "estimator": "Poisson-corrected Weyl count"},
                   homeostasis=None, status=status)
    ev["actor"] = "instrument.room-shape-meter"
    ev["provenance"]["generated_by"] = "hardware-pipeline/room/receipt.py"
    ev["instrument"] = {"id": "room-shape-meter/laptop-0", "kind": "room-weyl",
                        "build": {"design_sha256": design_sha256, "firmware_sha256": None, "code_sha256": code_sha256()},
                        "calibration": cal, "conditions": conditions, "self_test": self_test, "sim": sim}
    ev["event_hash"] = bus.sha({k: v for k, v in ev.items() if k != "event_hash"})
    return ev


def read_wav(path):
    with wave.open(str(path), "rb") as w:
        n, fs, sw, ch = w.getnframes(), w.getframerate(), w.getsampwidth(), w.getnchannels()
        raw = w.readframes(n)
    if sw != 2:
        raise ValueError(f"{path}: 16-bit PCM expected, got {8 * sw}-bit")
    x = np.frombuffer(raw, "<i2").astype(float).reshape(-1, ch)[:, 0] / 32768.0
    return x, fs


def write_sweep_wav(path, fs=48000):
    """The test signal to play: the same 10 s exponential sweep, 16-bit mono, with 3 s of silence after."""
    x, _ = chain.sweep(trial.F1, trial.F2, trial.T_SWEEP, fs=fs)
    x = np.concatenate([np.zeros(fs), x, np.zeros(3 * fs)])
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(fs)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def from_wav(sweep_path, rec_path):
    """A real recording: align it to the reference sweep, deconvolve, resample to the twin's 4 kHz, analyse.
    The sweep file is only checked for its sample rate; the reference is regenerated from code."""
    _, fs = read_wav(sweep_path)
    y, fs2 = read_wav(rec_path)
    if fs != fs2:
        raise ValueError("sweep and recording sample rates differ")
    x_ref, inv = chain.sweep(trial.F1, trial.F2, trial.T_SWEEP, fs=fs)
    lag = int(np.argmax(np.abs(chain.fftconv(y, x_ref[::-1])))) - len(x_ref) + 1
    h = chain.deconvolve(y[max(lag, 0):], x_ref, inv, trial.F1, trial.F2, fs=fs, length=3 * fs)
    n_out = int(round(len(h) * chain.FS / fs))
    H = np.fft.rfft(h, 2 * len(h))          # zero-padded so the resampler's ringing lands in the pad
    h4 = np.fft.irfft(H[: n_out + 1], 2 * n_out)[:n_out] * (n_out / len(h))
    return meter.analyse(h4, chain.FS)


def sim_example(seed=20261030):
    rng = np.random.default_rng(seed)
    import roundtrip
    rt = roundtrip.run_all(seed=seed, n_full=1)
    r = trial.run(rng, speaker="laptop", noise_dba=30.0)
    st = {"loopback": {"ran": True, "pass": rt["gates"]["R0_error_below_-60dB"], "value": rt["R0"]["error_db"]},
          "known_inject": {"ran": True, "pass": rt["gates"]["R1_all_modes_within_tol"], "value": rt["R1"]["max_abs_df"]},
          "auto_zero": {"ran": True, "pass": True, "value": "silence capture before the sweep sets the noise floor"}}
    cond = {"protocol": "corner to opposite corner, 0.1 to 0.3 m off the walls, doors and windows shut, laptop DSP off",
            "sweep": {"f1_hz": trial.F1, "f2_hz": trial.F2, "seconds": trial.T_SWEEP}, "speaker": "laptop (fc 150 Hz)",
            "background_dba": 30.0, "truth_for_this_sim": {"volume_m3": r["V"], "t60_s": r["t60"]}}
    ev = reading(r["est"], run_id="room-sim-" + str(seed), conditions=cond, self_test=st, sim=True)
    pkt = bus.packet(ev["run_id"], 0, [ev], ev["timestamp"])
    pkt["schema"] = SCHEMA
    pkt["receipt_hash"] = bus.sha({k: v for k, v in pkt.items() if k != "receipt_hash"})
    return pkt


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "wav":
        print(json.dumps(from_wav(sys.argv[2], sys.argv[3]), indent=1, default=float))
    elif len(sys.argv) > 1 and sys.argv[1] == "sweep":
        write_sweep_wav(sys.argv[2])
        print("wrote", sys.argv[2])
    else:
        pkt = sim_example()
        out = HERE.parent / "examples" / "room-receipt.sim.json"
        out.write_text(json.dumps(pkt, indent=1, default=float) + "\n", encoding="utf-8")
        print(bus.model_view(pkt))
        print("wrote", out)
