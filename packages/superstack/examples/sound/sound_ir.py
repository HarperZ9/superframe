# SPDX-License-Identifier: FSL-1.1-MIT
"""superstack.sound/1 reference renderer (offline, exact path, stdlib only).

The score comes from the seed rule: xmur3(seed) feeds mulberry32, and each
voice draws one note from the scale. Time is integer samples at the scene
rate, which divides the flick clock exactly. Output is float64 samples, then
the canonical s16le PCM that the receipt hashes.

Usage: python sound_ir.py sound.json OUTDIR
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root: superstack.py
import superstack as ss  # noqa: E402

VERSION = "0.1.0"
ACCESS = {"autoplay": False, "captions": None, "transcript": False, "reduced_sound": "silent"}


def score(scene):
    r = ss.rng(scene["seed"])
    scale = scene["scale_hz"]
    return [{"start": i * scene["step_samples"], "freq": scale[int(math.floor(r.next_float() * len(scale)))]}
            for i in range(scene["voices"])]


def envelope(k, length, attack, release, gain):
    if k < 0 or k >= length:
        return 0.0
    if k < attack:
        return gain * k / attack
    if k < length - release:
        return gain
    return gain * (length - k) / release


def render(scene):
    n_total, rate = scene["duration_samples"], scene["rate"]
    out = [0.0] * n_total
    L, A, R, g = scene["note_samples"], scene["attack_samples"], scene["release_samples"], scene["voice_gain"]
    for note in score(scene):
        w = 2.0 * math.pi * note["freq"] / rate
        for k in range(L):
            n = note["start"] + k
            if n >= n_total:
                break
            out[n] += envelope(k, L, A, R, g) * math.sin(w * k)
    m = scene["master_gain"]
    return [x * m for x in out]


def media_for(scene, samples, frames):
    lufs, peak = ss.integrated_lufs(samples, scene["rate"], scene["channels"]), ss.peak_dbfs(samples)
    return {"kind": "audio", "content": "music", "rate": scene["rate"], "channels": scene["channels"],
            "format": "s16le", "frames": frames, "duration_flicks": frames * ss.flicks_per_sample(scene["rate"]),
            "meter": ss.METER, "integrated_lufs": ss.round6(lufs), "peak_dbfs": ss.round6(peak),
            "loudness_class": "interactive", "loudness_verdict": ss.loudness_check("interactive", lufs, peak),
            "access": dict(ACCESS)}


DOES_NOT_PROVE = ["A matching PCM hash says nothing about how the sound is heard on a given device.",
                  "The loudness figure is one meter's reading; v0 reads sample peak, not true peak.",
                  "s16 quantization hides float differences smaller than half an LSB."]


def main(scene_path, outdir):
    scene = json.loads(Path(scene_path).read_text(encoding="utf-8"))
    errs = ss.validate_scene(scene)
    if errs:
        raise SystemExit(f"scene refused: {errs}")
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    x = render(scene)
    pcm = ss.quantize_s16(x)
    wav = ss.wav_s16(pcm, scene["rate"], scene["channels"])
    (out / "pcm.s16").write_bytes(pcm)
    (out / "sound.wav").write_bytes(wav)
    rec = ss.make_receipt(producer="superstack-example-sound-ref", version=VERSION, backend="python-stdlib-f64",
                          scene=scene, content=pcm, media=media_for(scene, x, len(x)),
                          outputs={"pcm.s16": ss.sha256_hex(pcm), "sound.wav": ss.sha256_hex(wav)},
                          does_not_prove=DOES_NOT_PROVE)
    assert ss.verify_receipt(rec) == [], ss.verify_receipt(rec)
    (out / "receipt.json").write_text(ss.canonical(rec), encoding="utf-8")
    (out / "score.json").write_text(ss.canonical(score(scene)), encoding="utf-8")
    print(rec["content_sha256"], rec["media"]["integrated_lufs"], [n["freq"] for n in score(scene)])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
