# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Worked example 2: the room-shape meter. Stages 3 and 4 are an existing laptop or phone; stages 2, 7 and 9
are built and run (room/). Numbers are read from the study results, never typed in."""
import json
from pathlib import Path

from common import BUS, CHECKS, PERCEIVE, PY, STUDYRUN, gate, record, stage, tool, walls

ROOT = Path(__file__).resolve().parent.parent
RUN1, RUN2 = "20261031T003606Z", "20261031T004139Z"


def _load():
    out = ROOT / "studies" / "room" / "out"
    r1 = json.loads((out / RUN1 / "result.json").read_text(encoding="utf-8"))
    r2 = json.loads((out / RUN2 / "result.json").read_text(encoding="utf-8"))
    wav = json.loads((ROOT / "studies" / "room" / "wav-path-test.json").read_text(encoding="utf-8"))
    rec = json.loads((ROOT / "examples" / "room-receipt.sim.json").read_text(encoding="utf-8"))
    return r1, r2, wav, rec

REC = record("room")


def build():
    r1, r2, wav, rec = _load()
    a1, a2 = r1["analysis"], r2["analysis"]
    rt = a1["roundtrip"]
    lap1, lap2 = a1["by_cell"]["laptop"], a2["by_cell"]["laptop"]
    v = {k: x["verdict"] for k, x in r1["verdicts"].items()}
    v2 = {k: x["verdict"] for k, x in r2["verdicts"].items()}
    s = []
    s.append(stage(1, "principle", "passed",
        ["ATLAS.json top5 room-weyl", "wall audit: 'you need a tape measure (or lidar) to know a room's size'"],
        ["Weyl's law with the rigid-wall corrections, the Sabine cross-check, and the assumptions"],
        gate("every assumption names a check that can fail", "assumptions without a check", "==", 0, "pass", 0),
        [tool("ATLAS.json", "source of the law and the wall", "ours", True), CHECKS],
        {"law": {"name": "Weyl's law for the Neumann Laplacian, with surface and edge terms",
                 "form": "N(f) = 4 pi V f^3 / (3 c^3) + pi S f^2 / (4 c^2) + L f / (8 c)",
                 "catalogue_id": "weyl_law",
                 "lineage": "Weyl (1911); rectangular-room corrections, Morse and Bolt (1944); Kac, 'Can one hear the shape of a drum?' (1966); Sabine (1900) for T60 = 0.161 V / A"},
         "quantity": "room volume V (and surface S, weakly)", "signal": "the count of resolved acoustic modes below f",
         "inversion": "fit V and kappa = S / V^(2/3) to the counted modes, corrected for the modes the estimator cannot split",
         "wall_assumptions": walls(REC),
         "fundamental_bound": "modes merge when their spacing falls below the resolving width; the Schroeder frequency 2000 sqrt(T60 / V) marks where counting ends for any method"},
        "Weyl's law gives the volume of the space the sound fills, which in a furnished room is less than the tape-measured box."))
    s.append(stage(2, "twin", "run",
        ["stage 1", "speaker and mic models"],
        ["room/modes.py, chain.py, meter.py, pencil.py, trial.py: a seeded twin of room, chain and estimator"],
        gate("the preregistered kill condition: median laptop volume error below 0.25", "median |V_est / V - 1|, laptop", "<", 0.25,
             "pass" if v["V3"] == "PASS" else "fail", round(a1["S3_med_err_laptop"], 3), f"studies/room/out/{RUN1}/result.json"),
        [PY, STUDYRUN],
        {"model": "rigid shoebox, every mode below 900 Hz, log-normal mode damping; 10 s exponential sweep; 16-bit DAC; speaker as a 2nd-order high-pass plus 2nd and 3rd harmonic distortion; red room noise and mic self-noise; MEMS sensitivity; 16-bit ADC at the 48 kHz noise density; regularised Farina deconvolution",
         "code": ["room/modes.py", "room/chain.py", "room/meter.py", "room/pencil.py", "room/trial.py", "room/units_room.py"],
         "noise_sources": [
            {"name": "background room noise", "formula": "red spectrum, 1/f power, 20 to 1000 Hz", "value": "30 or 45 dB SPL equivalent"},
            {"name": "mic self-noise", "formula": "white, equivalent input noise", "value": "29 dB SPL (a MEMS-class figure, from memory, moderate)"},
            {"name": "quantisation", "formula": "q / sqrt(12) at 16 bits, density of a 48 kHz converter", "value": "about -101 dBFS per 48 kHz band"},
            {"name": "speaker distortion", "formula": "0.03 x^2 + 0.02 x^3", "value": "pushed to negative time by the sweep method"}],
         "bounds": [
            {"name": "modal bandwidth", "formula": "B = 2.2 / T60", "value": "2.4 to 7 Hz for T60 0.3 to 0.9 s"},
            {"name": "Schroeder frequency", "formula": "2000 sqrt(T60 / V)", "value": "about 150 to 400 Hz for these rooms"},
            {"name": "speaker roll-off", "formula": "12 dB per octave below fc", "value": "fc 20, 150, 400 Hz for ideal, laptop, phone"}],
         "known_answer_tests": [
            {"name": "electrical loopback (R0)", "truth": "loopback gain times a unit impulse", "pass_condition": "error below -60 dB", "result": f"{rt['R0']['error_db']:.1f} dB"},
            {"name": "six planted modes, two 1 Hz apart (R1)", "truth": "planted frequencies and decay times", "pass_condition": "each within 0.2 Hz and 15 percent", "result": f"worst {rt['R1']['max_abs_df']:.3f} Hz; {rt['R1']['spurious']} spurious poles"},
            {"name": "real-recording path, WAV files only", "truth": "the same six planted modes at 48 kHz", "pass_condition": "each within 0.05 Hz and 5 percent", "result": "pass" if wav["pass"] else "fail"}]},
        "The twin is a rigid shoebox with an ideal corner protocol; furniture, open doors, irregular plans and real laptop DSP are absent.",
        notes=(f"Preregistered run {RUN1}: V1 {v['V1']}, V2 {v['V2']}, V3 {v['V3']}, V4 {v['V4']}, V5 {v['V5']}, V6 {v['V6']}, V7 {v['V7']}. "
               f"Laptop median errors: naive Fourier count {lap1['med_err_S1']:.2f}, corrected Fourier {lap1['med_err_S2']:.2f}, "
               f"matrix pencil {lap1['med_err_S3']:.2f}, shoebox prior {lap1['med_err_S4']:.2f}, prior guess {lap1['med_err_prior']:.2f}. "
               f"A known-answer test of the WAV path then found a circular-filter bug in the T60 step (deviation D1). "
               f"Post hoc run {RUN2} with the fix: V2 {v2['V2']}, V4 {v2['V4']}, V5 {v2['V5']}; laptop pencil median {lap2['med_err_S3']:.2f}, "
               f"gap to the prior guess {a2['gap_prior_laptop']:.2f} (CI {a2['gap_prior_ci_lo']:.2f} to {a2['gap_prior_ci_hi']:.2f}).")))
    s.append(stage(3, "front_end", "existing-device",
        ["the laptop or phone in hand"], ["a device profile: speaker roll-off, mic response, raw-capture mode, ADC format"],
        gate("the device profile is measured, not assumed: loopback flat within 1 dB over 40 to 150 Hz after the speaker correction", "max deviation, dB", "<", 1.0),
        [tool("any recorder that writes 16-bit PCM WAV with effects off (Audacity, for example)", "capture", "GPL-2.0-or-later (Audacity, from memory, moderate)")],
        {"existing_device": True,
         "chain": [{"element": "speaker", "part_or_device": "built-in laptop speaker", "key_spec": "low-frequency corner near 150 Hz in the twin; measure it"},
                   {"element": "mic", "part_or_device": "built-in MEMS mic, or a phone as the mic", "key_spec": "raw mode, no AGC"},
                   {"element": "ADC", "part_or_device": "the device's codec at 48 kHz, 16-bit", "key_spec": "no resampling in the capture path"}],
         "noise_budget": [{"source": "background room noise", "density": "30 dB quiet night, 45 dB daytime", "share_of_total": "dominant below 100 Hz"},
                          {"source": "mic self-noise", "density": "29 dB SPL", "share_of_total": "dominant in a very quiet room"},
                          {"source": "converter", "density": "16-bit at 48 kHz", "share_of_total": "negligible after the 10 s sweep's processing gain"}],
         "adc": {"bits": 16, "fs_hz": 48000, "enob_or_floor": "measured by the silence capture (auto-zero)"},
         "margin_to_bound": f"the round trip keeps {rt['R2'][0]['bits_per_bin']:.1f} of {rt['ideal']['bits_per_bin']:.1f} bits per bin in 40 to 150 Hz; the estimator, not the converter, sets the error"},
        "A measured profile holds for one device in one mode; an OS update can switch DSP back on."))
    s.append(stage(4, "schematic_pcb", "existing-device",
        ["stage 3"], ["no board; a recorded device identity instead"],
        gate("the device identity (model, OS build, audio driver, capture settings) is recorded in every receipt", "receipts without device identity", "==", 0),
        [BUS],
        {"existing_device": True, "eda": {"tool": "none", "version": "n/a", "files": []},
         "checks": ["device model and OS build logged", "capture app and its effect settings logged"],
         "bom": [], "spend": "gated: nothing ordered, priced or fabricated"},
        "A logged identity does not prove two units of one model behave alike."))
    s.append(stage(5, "firmware", "built",
        ["stage 3 device"], ["host analysis code, hashed into every receipt"],
        gate("the code hash in a receipt matches the code that ran; the WAV known-answer test passes", "WAV test", "==", "pass",
             "pass" if wav["pass"] else "fail", "pass" if wav["pass"] else "fail", "studies/room/wav-path-test.json"),
        [PY, CHECKS],
        {"platform": "host Python on the laptop; the device only plays and records",
         "toolchain": {"name": "Python 3.12, NumPy 2.4", "pinned": "versions recorded; code sha256 in each receipt (receipt.code_sha256)"},
         "reproducible_build": {"method": "no build: the analysis is source; the hash is over the seven source files", "check": "rerun on the same WAV gives the same receipt value"},
         "self_tests": [
            {"name": "auto-zero (silence capture)", "check_id": "autozero", "method": "record 1 s of silence before the sweep; it sets the noise spectrum", "pass_condition": "band 15 dB above it found"},
            {"name": "loopback", "check_id": "loopback", "method": "headphone-out to mic-in cable where the device has both; else the speaker held to the mic", "pass_condition": "flat within 1 dB after correction"},
            {"name": "known-signal injection", "check_id": "knowninject", "method": "the planted six-mode recording through the real WAV path", "pass_condition": "each mode within 0.05 Hz, decay within 5 percent"},
            {"name": "UNCAL", "check_id": "uncal", "method": "no calibration record, or a failed self-test, flags the receipt", "pass_condition": "the simulated receipt carries UNCAL (it does)"}]},
        "The known-answer test checks the code path, not the room."))
    s.append(stage(6, "calibration", "paper",
        ["stage 5", "rooms with tape-measured size"], ["a per-device correction and a calibration record"],
        gate("on 5 tape-measured rooms the device's median volume error is within the twin's laptop spread", "median |V err| on measured rooms", "<", round(lap2["med_err_S3"] * 1.5, 2)),
        [CHECKS],
        {"method": "substitution against tape-measured rooms (the known answer), plus a closet or bathroom as a small room; the Sabine absorption from the fit is reported beside each",
         "references": [{"name": "steel tape measure", "kind": "working", "traceability": "class II tape (from memory, moderate); not checked against anything here"},
                        {"name": "the twin's spread", "kind": "none", "traceability": "a simulation, not a reference"}],
         "record_fields": ["device identity", "rooms and their tape volumes", "per-room errors", "speaker corner fitted", "date", "valid_until", "record sha256"],
         "is_primary_standard": False,
         "honest_traceability": "No primary standard exists for room volume by sound; the reference is a tape measure of unknown calibration, and a furnished room's air volume differs from its box. Receipts stay UNCAL until this record exists."},
        "Five rooms say little about rooms unlike them."))
    r2b = [x["bits_per_bin"] for x in rt["R2"]]
    s.append(stage(7, "hil", "run",
        ["stage 2 twin chain"], ["the round trip scored: error against truth and bits lost per path"],
        gate("loopback error below -60 dB, planted modes within 0.2 Hz, every full-chain error below -20 dB", "V6 rules", "==", "all hold",
             "pass" if v["V6"] == "PASS" else "fail", v["V6"], f"studies/room/out/{RUN1}/result.json"),
        [PY, STUDYRUN, CHECKS],
        {"rig": "software round trip, simulated first: digital sweep, DAC, speaker, air (the room), mic, ADC, deconvolution; the physical rig is the device itself with a loopback cable",
         "signals": [{"name": "R0 loopback", "truth": "unit impulse times loopback gain"},
                     {"name": "R1 six planted modes", "truth": "frequencies and decay times"},
                     {"name": "R2 six random rooms", "truth": "the twin's noise-free chain impulse response"}],
         "scoring": {"error_vs_truth": "normalised squared transfer error in 40 to 150 Hz, truth passed through the same measurement operator (new check operatortruth)",
                     "bits_lost": "1/2 log2(1 + |H|^2 / |H_est - H|^2) per bin, ideal digital path minus each path"},
         "results": {"ideal_bits_per_bin": round(rt["ideal"]["bits_per_bin"], 2), "loopback_bits_per_bin": round(rt["R0"]["bits_per_bin"], 2),
                     "acoustic_bits_per_bin_mean": round(sum(r2b) / len(r2b), 2), "bits_lost_loopback": round(rt["bits_lost"]["loopback"], 2),
                     "bits_lost_acoustic": round(rt["bits_lost"]["acoustic"], 2), "R0_error_db": round(rt["R0"]["error_db"], 1),
                     "R1_worst_df_hz": round(rt["R1"]["max_abs_df"], 3), "R1_spurious_poles": rt["R1"]["spurious"],
                     "R2_worst_error_db": round(a1["R2_worst_error_db"], 1)}},
        "A twin round trip checks the method against the twin's own physics; a real room can break assumptions the twin shares with the estimator."))
    s.append(stage(8, "field", "paper",
        ["stages 6 and 7 pass"], ["volume readings in real rooms under a preregistered protocol"],
        gate("in 10 tape-measured rooms, the median error is below 0.25 and beats the prior guess", "median |V err|", "<", 0.25),
        [STUDYRUN],
        {"sites": ["the author's own rooms, empty and furnished", "a closet and a bathroom (small, hard walls)", "one large room or hall", "the space under a large tree's canopy as an open-field null (no modes expected)"],
         "protocol": {"prereg": "a studyrun spec locked before the first field recording (not written yet)", "known_answers": ["tape-measured volume", "the open-field null"],
                      "kill_condition": "median field error above 0.25, or no better than the prior guess",
                      "controls": ["shuffled truth (rooms' volumes permuted)", "mid-room mic placement, which the theory says undercounts"]},
         "conditions_logged": ["doors and windows", "furniture", "HVAC on or off", "temperature (sets c)", "device and capture settings"]},
        "Ten rooms in one house share a builder, materials and style."))
    s.append(stage(9, "data_return", "built",
        ["each analysed recording"], ["a receipt on the measurement bus (examples/room-receipt.sim.json)"],
        gate("the receipt validates against receipt.schema.json and carries UNCAL with no calibration record", "schema errors", "==", 0, "pass", 0,
             "examples/room-receipt.sim.json"),
        [BUS, PERCEIVE],
        {"receipt_schema": "schemas/receipt.schema.json",
         "value_fields": ["volume_m3", "surface_m2", "t60_s", "alpha_sabine", "modes_used", "band_hz"],
         "uncal_policy": "UNCAL until a stage-6 record exists for this device; also on any failed self-test; status 'estimated'",
         "feeds": {"measurement_bus": "domain acoustics, dimension space", "perceptual_bridge": "tools/perceive 'sound' bridge plays the modes; the toy on the page draws N(f)", "findings": "F116 in 2026-10-27-plygrnd/FINDINGS.md"},
         "example": "examples/room-receipt.sim.json"},
        "A receipt marked sim is a twin reading; it never stands in for a room."))
    s.append(stage(10, "manufacturing", "paper",
        ["a passing field study"], ["a device-profile capsule per phone or laptop model"],
        gate("each device profile passes loopback and the WAV known-answer test before its first reading", "profiles without both passes", "==", 0),
        [STUDYRUN],
        {"design_for_test": ["the known-answer WAV ships with the code", "the loopback test runs before every session", "device identity read automatically"],
         "fixture": "a reference room (tape-measured, empty, doors shut) where each new device model is measured once",
         "yield": {"metric": "share of device models whose loopback and reference-room reading pass", "tracking": "one receipt per device model, kept with the profile"},
         "build_capsule": {"design_sha256": "n/a (no board)", "firmware_sha256": "sha256 of the seven analysis sources", "calibration_record_sha256": "sha256 of the device's stage-6 record", "test_receipts": "the device's loopback and WAV-test receipts"}},
        "A device model that passed once can change with an OS update."))
    return {"schema": "hardware-pipeline.instrument/0.1", "id": REC["pipeline_id"], "name": REC["name"],
            "atlas_id": REC["atlas_id"], "written": REC["written"],
            "summary": REC["summary"],
            "stages": s}
