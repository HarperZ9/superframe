# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Offline export and the receipt.

16-bit WAV uses the superstack quantiser rule (clamp, then floor(v * 32767 + 0.5)) and its canonical
44-byte header, so the PCM hash in the receipt is the superstack content hash. 24-bit and 32-bit float WAV
and FLAC go through libsndfile (the soundfile package). The receipt is a superstack.receipt/1 record:
scene hash, seed and seed rule, flick clock, PCM hash, and what it does not prove.
"""
import numpy as np
import soundfile as sf

from . import VERSION
from . import superstack as ss

FORMATS = {("wav", 16): None, ("wav", 24): "PCM_24", ("wav", 32): "FLOAT", ("flac", 16): "PCM_16",
           ("flac", 24): "PCM_24"}


def pcm_s16(stereo):
    """Interleaved s16le bytes by the superstack rule, vectorised."""
    v = np.clip(np.asarray(stereo, float).reshape(-1), -1.0, 1.0)
    return np.floor(v * 32767.0 + 0.5).astype("<i2").tobytes()


def write(path, stereo, fs, fmt="wav", bits=16):
    """Write the buffer; returns the bytes hashed for the receipt (the s16 PCM for 16-bit WAV)."""
    key = (fmt, bits)
    if key not in FORMATS:
        raise ValueError(f"unsupported format {key}; supported: {sorted(FORMATS)}")
    if key == ("wav", 16):
        pcm = pcm_s16(stereo)
        with open(path, "wb") as f:
            f.write(ss.wav_s16(pcm, fs, stereo.shape[1]))
        return pcm
    if bits == 16:   # the same s16 samples as the WAV, so FLAC decodes bit-identical to it
        data = np.frombuffer(pcm_s16(stereo), "<i2").reshape(-1, stereo.shape[1])
    else:
        data = stereo
    sf.write(str(path), data, fs, subtype=FORMATS[key], format=fmt.upper())
    with open(path, "rb") as f:
        return f.read()


DOES_NOT_PROVE = [
    "The PCM hash shows this render is repeatable; it says nothing about how the piece sounds to a listener.",
    "Mode frequencies match closed forms and published tables in the tests; damping uses loss factors from memory.",
    "Byte identity is shown on one machine; another CPU may differ in the last bits of exp and sin, which the "
    "superstack PCM tolerance (2 LSB, 60 dB SNR) is there to judge.",
]


def receipt(scene, pcm, fs, frames, outputs=None):
    media = {"kind": "audio", "content": "music", "rate": fs, "channels": 2, "format": "s16le", "frames": frames,
             "duration_flicks": frames * ss.flicks_per_sample(fs),
             "access": {"autoplay": False, "captions": None, "transcript": False, "reduced_sound": "silent"}}
    rec = ss.make_receipt(producer="superframe-daw", version=VERSION, backend="python-numpy", scene=scene,
                          media=media, content=pcm, outputs=outputs or {}, does_not_prove=DOES_NOT_PROVE)
    errs = ss.verify_receipt(rec)
    if errs:
        raise ValueError(f"receipt failed its own verification: {errs}")
    return rec
