# SPDX-License-Identifier: FSL-1.1-MIT
"""One check reconciles every backend against its reference, using only the contract.

Pixels: the reference is raw-native 0.4.0's CPU frame (a fresh run under
out/raw-native when present, otherwise the recorded copy in reference/). Sound:
the reference is the Python offline renderer. Tolerances, fixed before the
first comparison in the proof (3 October 2026):
  pixels: frame mean absolute difference <= 1 level (contract RGB8 bound),
          coverage mismatch <= 0.5 % of reference-covered pixels,
          AO RMSE <= 0.02 on pixels covered by both;
  sound:  <= 2 LSB at s16 and >= 60 dB SNR (contract PCM bound).
Identity is reported beside every verdict: MATCH only when the bytes are equal.

Usage: python check.py   (reads out/*, writes out/reconcile.json and
out/<backend>/receipt.reconciled.json)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import superstack as ss  # noqa: E402

OUT = HERE / "out"
RECORDED = HERE / "reference" / "raw-native-0.4.0"
PIXEL_EXTRA = {"coverage_mismatch_frac_max": 0.005, "ao_rmse_max": 0.02}
PIXEL_BACKENDS = ("python", "webgl2-gpu", "webgl2-swiftshader")
SOUND_BACKENDS = ("sound-js-exact", "sound-js-browser", "sound-webaudio")


def pnm(path: Path):
    data = path.read_bytes()
    parts, i = [], 0
    while len(parts) < 4:
        j = data.index(b"\n", i)
        parts += data[i:j].split()
        i = j + 1
    return parts[0].decode(), int(parts[1]), int(parts[2]), data[i:]


def raw_reference(d: Path):
    """frame RGB8, AO float32 top-down, mask u8 (0 or 1), from raw-native files."""
    _, w, h, frame = pnm(d / "frame.ppm")
    _, _, _, mbody = pnm(d / "mask.pgm")
    mask = bytes(1 if b else 0 for b in mbody)
    _, _, _, abody = pnm(d / "ao_rt.pfm")  # PFM rows run bottom-up
    row = w * 4
    ao = b"".join(abody[(h - 1 - y) * row:(h - y) * row] for y in range(h))
    return {"frame": frame, "ao": ao, "mask": mask, "width": w, "height": h}


def backend(d: Path):
    return {"frame": (d / "frame.rgb").read_bytes(), "ao": (d / "ao.f32").read_bytes(),
            "mask": (d / "mask.u8").read_bytes()}


def reconcile_pixels(ref, cand):
    block = ss.reconcile_rgb8(ref["frame"], cand["frame"])
    tol = block["tolerance"]
    if tol["verdict"] == "unverifiable":
        return block
    covered = sum(ref["mask"])
    mism = sum(1 for a, b in zip(ref["mask"], cand["mask"]) if a != b)
    both = bytes(1 if (a and b) else 0 for a, b in zip(ref["mask"], cand["mask"]))
    rmse = ss.f32_rmse(ref["ao"], cand["ao"], both)
    tol["metrics"].update({"coverage_mismatch_frac": mism / covered, "ao_rmse": ss.round6(rmse)})
    tol["bounds"] = {**tol["bounds"], **PIXEL_EXTRA}
    ok = (tol["verdict"] == "verified" and mism / covered <= PIXEL_EXTRA["coverage_mismatch_frac_max"]
          and rmse is not None and rmse <= PIXEL_EXTRA["ao_rmse_max"])
    tol["verdict"] = "verified" if ok else "refuted"
    return block


def reconciled_receipt(d: Path, ref_backend: str, ref_sha: str, block):
    """Re-seal the backend's receipt with its reference and reconcile block."""
    rec = json.loads((d / "receipt.json").read_text(encoding="utf-8"))
    rec["reconcile"] = {"reference": {"backend": ref_backend, "content_sha256": ref_sha}, **block}
    rec = ss.seal(rec)
    errs = ss.verify_receipt(rec)
    if errs:
        raise SystemExit(f"{d.name}: reconciled receipt invalid {errs}")
    (d / "receipt.reconciled.json").write_text(ss.canonical(rec), encoding="utf-8")


def main():
    fresh = OUT / "raw-native"
    ref_dir = fresh if (fresh / "frame.ppm").exists() else RECORDED
    ref = raw_reference(ref_dir)
    ref_sha = ss.sha256_hex(ref["frame"])
    report = {"pixel_reference": {"dir": ref_dir.relative_to(HERE).as_posix(), "content_sha256": ref_sha},
              "pixels": {}, "sound": {}}
    for name in PIXEL_BACKENDS:
        d = OUT / name
        if not (d / "frame.rgb").exists():
            continue
        block = reconcile_pixels(ref, backend(d))
        report["pixels"][name] = block
        reconciled_receipt(d, "raw-native-0.4.0-cpu", ref_sha, block)
    aref = OUT / "sound-reference" / "pcm.s16"
    if aref.exists():
        pcm_ref = aref.read_bytes()
        report["sound_reference"] = {"content_sha256": ss.sha256_hex(pcm_ref)}
        for name in SOUND_BACKENDS:
            p = OUT / name / "pcm.s16"
            if p.exists():
                block = ss.reconcile_pcm_s16(pcm_ref, p.read_bytes())
                report["sound"][name] = block
                reconciled_receipt(OUT / name, "python-stdlib-f64", ss.sha256_hex(pcm_ref), block)
    (OUT / "reconcile.json").write_text(json.dumps(report, indent=1, sort_keys=True), encoding="utf-8")
    for kind in ("pixels", "sound"):
        for name, b in report[kind].items():
            m = b["tolerance"]["metrics"]
            print(f"{kind:6} {name:20} {b['identity']:5} {b['tolerance']['verdict']:12} {json.dumps(m, sort_keys=True)}")
    return report


if __name__ == "__main__":
    main()
