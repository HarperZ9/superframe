# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Worked example 3 (optional, added on the coordinator's request): a DIY photoelastic polariscope.
A screen is already a polarised source; one polariser sheet and a phone camera complete it. On paper."""
from common import BUS, CHECKS, PERCEIVE, PY, STUDYRUN, gate, record, stage, tool, walls

OPENCV = tool("OpenCV", "image registration and fringe tracing (R&D only; shipped code is ours)", "Apache-2.0", False,
              "Bradski (2000), Intel; now OpenCV.org")

REC = record("polariscope")


def build():
    s = []
    s.append(stage(1, "principle", "paper",
        ["the 1908 Brockhaus 'Licht' plate the author saved (figures 5 and 6: cooled and pressed glass)", "law catalogue"],
        ["the stress-optic law, its inversion and its assumptions"],
        gate("every assumption names a check that can fail", "assumptions without a check", "==", 0, "pass", 0),
        [CHECKS],
        {"law": {"name": "stress-optic law (temporary birefringence)", "form": "delta = 2 pi t C (sigma1 - sigma2) / lambda; fringe order N = t (sigma1 - sigma2) / f_sigma, with f_sigma = lambda / C",
                 "catalogue_id": None,
                 "lineage": "Brewster (1816), stressed glass between polarisers; Maxwell (1853), the stress-optic relation; Coker and Filon, A Treatise on Photo-Elasticity (1931); Frocht, Photoelasticity (1941), the disc calibration; Michel-Levy (1888), the interference-colour chart"},
         "quantity": "principal stress difference sigma1 - sigma2 across a transparent part, and the principal directions",
         "signal": "fringe order (isochromatics) and extinction bands (isoclinics) seen through crossed polarisers",
         "inversion": "sigma1 - sigma2 = N f_sigma / t, with f_sigma measured on a calibration disc of the same sheet",
         "wall_assumptions": walls(REC),
         "fundamental_bound": "white-light colours wash out past about 4 to 5 orders (from memory, moderate); fringe-order resolution about 0.1 by colour, about 0.02 with phase stepping"},
        "Fringes give the difference of principal stresses, not each stress; separating them needs a second method."))
    s.append(stage(2, "twin", "paper",
        ["stage 1", "the screen's spectrum and the camera's spectral response, each to be measured"],
        ["a Jones-calculus twin: retardation to the RGB the camera records, for this screen"],
        gate("the twin's colour-to-order map recovers a planted retardation ramp within 0.1 order up to order 3", "max |N_est - N_planted|", "<", 0.1),
        [PY, PERCEIVE],
        {"model": "plane and circular polariscope as Jones matrices; per wavelength, I = sin^2(2 theta) sin^2(delta / 2) (plane) or sin^2(delta / 2) (circular); integrate over the screen's spectral power times each camera channel's sensitivity",
         "code": ["planned: polariscope/twin.py; the page's toy already runs the white-light case in the browser"],
         "noise_sources": [
            {"name": "camera shot and read noise", "formula": "sqrt(electrons) plus read noise per pixel", "value": "small next to colour ambiguity at these light levels"},
            {"name": "screen spectral lines", "formula": "three narrow primaries instead of a continuum", "value": "colours differ from the Michel-Levy chart; the twin fixes that"},
            {"name": "imperfect polarisers", "formula": "extinction ratio", "value": "unknown; measured as the dark level with no part"}],
         "bounds": [
            {"name": "colour washout", "formula": "coherence of the source over the retardation", "value": "about 4 orders in white light"},
            {"name": "single-primary counting", "formula": "intensity sin^2(pi N) in one primary", "value": "dozens of orders countable, sign ambiguous"}],
         "known_answer_tests": [{"name": "planted retardation ramp", "truth": "a linear N from 0 to 5", "pass_condition": "within 0.1 order to N = 3", "result": None}]},
        "A twin built on measured spectra still assumes ideal sheets and no stray light."))
    s.append(stage(3, "front_end", "existing-device",
        ["a laptop or phone screen", "a phone camera"], ["the optical chain and its settings"],
        gate("extinction with crossed polarisers and no part: dark level below 2 percent of the open level in every channel", "dark / open", "<", 0.02),
        [tool("phone camera in manual mode (fixed exposure, white balance, ISO)", "detector", "existing device")],
        {"existing_device": True,
         "chain": [{"element": "source and polariser", "part_or_device": "the screen itself, showing white, then pure green", "key_spec": "linearly polarised output"},
                   {"element": "specimen", "part_or_device": "clear polycarbonate parts (high sensitivity; acrylic shows few fringes)", "key_spec": "thin, flat, stress-free when annealed"},
                   {"element": "analyser", "part_or_device": "one linear polariser sheet; circular: two pairs of cinema 3D glasses (each lens a linear polariser plus a quarter-wave film; from memory, moderate)", "key_spec": "extinction measured"},
                   {"element": "detector", "part_or_device": "phone camera, RAW where available", "key_spec": "fixed exposure and white balance"}],
         "noise_budget": [{"source": "colour ambiguity between orders", "density": "about 0.1 order", "share_of_total": "dominant"},
                          {"source": "camera noise", "density": "below 0.02 order after spatial averaging", "share_of_total": "small"}],
         "adc": {"bits": None, "fs_hz": None, "enob_or_floor": "the camera's RAW depth, 10 to 12 bits typical (from memory, low)"},
         "margin_to_bound": "colour is the limit; phase stepping with marked analyser angles buys about 5 times"},
        "One phone's colour pipeline is not another's; RAW avoids most of it."))
    s.append(stage(4, "schematic_pcb", "existing-device",
        ["stage 3"], ["a printed jig and a BOM of one sheet"],
        gate("BOM lines without alternate", "count", "==", 0, "pass", 0),
        [tool("OpenSCAD", "printable load frame and disc holder", "GPL-2.0 (from memory, moderate)", False, "Marius Kintel and Clifford Wolf (2010)")],
        {"existing_device": True, "eda": {"tool": "OpenSCAD for the jig; no circuit", "version": "current", "files": ["planned: frame.scad"]},
         "checks": ["frame fits the screen", "load points 4-point bend span marked"],
         "bom": [{"ref": "P1", "part": "linear polariser sheet", "function": "analyser", "lifecycle": "commodity", "lifecycle_source": "n/a", "alternates": ["polarised sunglasses (unknown axis; check over the screen)", "cinema 3D glasses"]},
                 {"ref": "S1", "part": "polycarbonate offcut, 2 to 3 mm", "function": "calibration disc and beam", "lifecycle": "commodity", "lifecycle_source": "n/a", "alternates": ["epoxy casting", "gelatin (very sensitive, soft)"]},
                 {"ref": "W1", "part": "water bottles as weights", "function": "known load", "lifecycle": "existing", "lifecycle_source": "n/a", "alternates": ["kitchen-scale-weighed stones"]}],
         "spend": "gated: nothing ordered, priced or fabricated"},
        "A jig that fits proves nothing about the stress it applies."))
    s.append(stage(5, "firmware", "paper",
        ["stage 3"], ["capture and analysis code with self-tests"],
        gate("the dark-frame and zero-load tests run before every capture set", "capture sets without both", "==", 0),
        [PY, OPENCV],
        {"platform": "phone captures; host Python analysis",
         "toolchain": {"name": "Python and NumPy; OpenCV only for R&D registration", "pinned": "versions and code sha256 in each receipt"},
         "reproducible_build": {"method": "source, hashed", "check": "same images give the same fringe map"},
         "self_tests": [{"name": "dark frame (auto-zero)", "check_id": "autozero", "method": "crossed sheets, no part", "pass_condition": "dark below 2 percent of open"},
                        {"name": "zero-load image", "check_id": "artifactcontrol", "method": "the unloaded part", "pass_condition": "residual fringes recorded and subtracted"},
                        {"name": "analytic specimen", "check_id": "analyticspecimen", "method": "disc in diametral compression", "pass_condition": "fringe pattern matches the closed-form field within 0.1 order"}]},
        "Passing self-tests says the optics and code behave, not that a part is safe."))
    s.append(stage(6, "calibration", "paper",
        ["stage 5", "known loads"], ["f_sigma for this sheet, with its uncertainty"],
        gate("f_sigma from the disc and from the beam agree within their combined uncertainty", "|f_disc - f_beam| / u_c", "<", 2.0),
        [PY, CHECKS],
        {"method": "two specimens of one sheet. Disc of diameter D in diametral compression P: at the centre sigma1 - sigma2 = 8 P / (pi D t), so f_sigma = 8 P / (pi D N_centre) (Frocht). Beam in four-point bending: sigma = M y / I between the inner loads, fringes run parallel to the neutral axis with a linear order gradient",
         "references": [{"name": "load from water bottles", "kind": "working", "traceability": "volume times density (1 L of water near 0.998 kg at 20 C) or a kitchen scale of unknown calibration"},
                        {"name": "ruler and calipers for D and t", "kind": "working", "traceability": "unchecked"},
                        {"name": "closed-form disc and beam fields", "kind": "primary", "traceability": "elasticity theory: the shape of the field is exact; its scale rests on P, D and t"}],
         "record_fields": ["sheet and batch", "D, t", "loads", "N at each load", "f_sigma and its fit residual", "temperature", "date", "record sha256"],
         "is_primary_standard": False,
         "honest_traceability": "The fringe pattern's shape is a known answer from theory; its scale is only as good as a water bottle and a ruler. Readings say UNCAL until the disc and beam agree."},
        "Two specimens from one sheet share its errors."))
    s.append(stage(7, "hil", "paper",
        ["stage 6"], ["a screen-to-camera round trip with planted retardation"],
        gate("a planted retardation pattern shown on a second screen layer is read back within 0.1 order", "max order error", "<", 0.1),
        [PY],
        {"rig": "digital to analog to digital: the screen displays the colours the twin predicts for a planted retardation map; the camera records them; the analysis must return the planted map. Then the physical disc under a known load closes the loop through real plastic",
         "signals": [{"name": "planted ramp, displayed", "truth": "the planted N map"}, {"name": "disc under load", "truth": "Frocht's closed-form N map"}],
         "scoring": {"error_vs_truth": "pixel-wise |N_est - N_true|", "bits_lost": "log2 of distinguishable orders before and after the camera, per pixel"},
         "results": None},
        "A displayed planted map tests the camera and colour map, not the polariser sheets."))
    s.append(stage(8, "field", "paper",
        ["stage 7 pass"], ["stress maps of real parts under a preregistered protocol"],
        gate("on 3 parts with a closed-form answer (disc, ring, notched beam) the mapped stress agrees within 15 percent", "median relative error", "<", 0.15),
        [STUDYRUN],
        {"sites": ["the author's bench, daylight off", "plastic offcuts: disc, ring, notched beam", "a clear plastic tree-tie or guard under its own clamp load (a real use)"],
         "protocol": {"prereg": "a studyrun spec before the first field capture (not written yet)", "known_answers": ["disc", "ring", "notched-beam stress concentration factor"],
                      "kill_condition": "median error above 15 percent on the known-answer parts",
                      "controls": ["zero-load image of each part", "the analyser rotated 90 degrees (fringes must invert)"]},
         "conditions_logged": ["temperature", "time under load", "screen brightness and colour", "camera settings"]},
        "Agreement on textbook shapes does not cover parts with complex 3D stress."))
    s.append(stage(9, "data_return", "paper",
        ["each analysed capture"], ["a receipt per part and load"],
        gate("each receipt validates against receipt.schema.json", "invalid receipts", "==", 0),
        [BUS, PERCEIVE],
        {"receipt_schema": "schemas/receipt.schema.json",
         "value_fields": ["max_fringe_order", "sigma_diff_MPa_at_points", "f_sigma_N_per_mm", "load_N", "time_under_load_s", "image_sha256"],
         "uncal_policy": "UNCAL until the disc and beam calibrations agree; also when the zero-load image was not taken",
         "feeds": {"measurement_bus": "domain mechanics, dimension space", "perceptual_bridge": "tools/perceive 'polarisation' bridge", "findings": "a FINDINGS entry when the field study runs"},
         "example": None},
        "An image hash proves which photograph was read, not what stress the part held."))
    s.append(stage(10, "manufacturing", "paper",
        ["a passing field study"], ["a kit: sheet, printed frame, calibration disc, analysis code"],
        gate("each kit's disc reads within 0.1 order of the reference kit's disc at the same load", "kits outside tolerance", "==", 0),
        [STUDYRUN],
        {"design_for_test": ["each kit ships its own calibration disc", "the dark-frame test runs on first use"],
         "fixture": "a reference load frame and one reference disc kept as the kit standard",
         "yield": {"metric": "share of kits whose disc passes", "tracking": "one receipt per kit"},
         "build_capsule": {"design_sha256": "frame .scad and sheet spec", "firmware_sha256": "analysis code sha256", "calibration_record_sha256": "the kit's disc record", "test_receipts": "first-use dark-frame and disc receipts"}},
        "A kit standard is only a shared reference, not an absolute one."))
    return {"schema": "hardware-pipeline.instrument/0.1", "id": REC["pipeline_id"], "name": REC["name"],
            "atlas_id": REC["atlas_id"], "written": REC["written"],
            "summary": REC["summary"],
            "stages": s}
