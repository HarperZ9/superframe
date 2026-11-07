# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One decode front end for every format: mp3, aac/m4a/mp4, opus/webm, ogg, flac, wav/aiff and video containers,
through the ffmpeg build pinned by imageio-ffmpeg (its sha256 goes in every receipt). Files are data: ffmpeg
reads them, nothing in them is executed.

Damaged streams: ffmpeg runs with `-err_detect ignore_err` and `+discardcorrupt`, so it decodes what survives and
resyncs on the next good frame. Every decoder complaint is counted, and the decoded duration is compared with the
duration the container claims, so truncation and dropped frames show up in the source condition report.
"""
import re
import subprocess
from functools import lru_cache

import numpy as np
import soundfile as sf

from .receipts import sha256_file


@lru_cache(maxsize=1)
def ffmpeg():
    """Path and sha256 of the pinned ffmpeg, or (None, None) when imageio-ffmpeg is missing."""
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        return exe, sha256_file(exe)
    except Exception as exc:  # the soundfile path still covers wav, flac, aiff and ogg
        print(f"remastering.audio: ffmpeg unavailable ({exc}); falling back to libsndfile")
        return None, None


BENIGN = re.compile(r"Guessed Channel Layout|Estimating duration from bitrate")
_STREAM = re.compile(r"Stream #\d+:(\d+)(?:\[[^\]]*\])?(?:\([^)]*\))?: Audio: ([^,\s]+)[^,]*, (\d+) Hz, ([^,]+), ([^,\n]+)(?:, (\d+) kb/s)?")
_DUR = re.compile(r"Duration: (\d+):(\d+):([\d.]+)")
_CONTAINER = re.compile(r"Input #0, ([^,]+(?:,[^,]+)*?), from")


def probe(path):
    """What the container says: codec, rate, channels, bitrate, duration. Parsed from ffmpeg's banner."""
    exe, _ = ffmpeg()
    if exe is None:
        info = sf.info(str(path))
        return {"container": info.format, "codec": info.subtype, "rate": info.samplerate, "channels": info.channels,
                "bitrate_kbps": None, "duration_s": info.duration}
    r = subprocess.run([exe, "-hide_banner", "-nostdin", "-i", str(path)], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    txt = r.stderr
    out = {"container": None, "codec": None, "rate": None, "channels": None, "bitrate_kbps": None, "duration_s": None}
    m = _CONTAINER.search(txt)
    if m:
        out["container"] = m.group(1).strip()
    m = _DUR.search(txt)
    if m:
        out["duration_s"] = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    m = _STREAM.search(txt)
    if m:
        out["codec"], out["rate"], out["channels"] = m.group(2), int(m.group(3)), m.group(4).strip()
        out["bitrate_kbps"] = int(m.group(6)) if m.group(6) else None
    if out["bitrate_kbps"] is None:
        b = re.search(r"Audio: [^\n]*?(\d+) kb/s", txt) or re.search(r"bitrate: (\d+) kb/s", txt)
        out["bitrate_kbps"] = int(b.group(1)) if b else None
    return out


def decode(path, rate=None):
    """Decode to float32 (channels, n), stereo. Returns (audio, rate, report). `rate` None keeps the source rate."""
    exe, exe_sha = ffmpeg()
    info = probe(path)
    if exe is None:
        y, fs = sf.read(str(path), dtype="float32", always_2d=True)
        y = y.T
        if y.shape[0] == 1:
            y = np.repeat(y, 2, 0)
        return y[:2], fs, {"probe": info, "decoder": "libsndfile", "errors": 0, "error_lines": []}
    fs = int(rate or info["rate"] or 48000)
    cmd = [exe, "-hide_banner", "-nostdin", "-v", "warning", "-err_detect", "ignore_err", "-fflags", "+discardcorrupt+genpts",
           "-i", str(path), "-map", "0:a:0", "-vn", "-ac", "2", "-ar", str(fs), "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1"]
    r = subprocess.run(cmd, capture_output=True)
    errs = [ln for ln in r.stderr.decode("utf-8", "replace").splitlines() if ln.strip() and not BENIGN.search(ln)]
    y = np.frombuffer(r.stdout[: len(r.stdout) // 8 * 8], "<f4").reshape(-1, 2).T.copy()
    if y.shape[1] == 0 and r.returncode != 0:
        raise RuntimeError(f"ffmpeg could not decode {path}: {errs[-3:]}")
    rep = {"probe": info, "decoder": "ffmpeg", "ffmpeg_sha256": exe_sha, "errors": len(errs), "error_lines": errs[:20],
           "decoded_s": y.shape[1] / fs}
    if info["duration_s"]:
        rep["decoded_share"] = round(rep["decoded_s"] / info["duration_s"], 4)
    return y, fs, rep


def encode(path, y, fs, codec_args):
    """Write `y` through ffmpeg with the given codec arguments (planted damage: lossy round trips)."""
    exe, _ = ffmpeg()
    if exe is None:
        raise RuntimeError("ffmpeg is needed to encode lossy formats")
    pcm = np.ascontiguousarray(np.asarray(y, "<f4").T).tobytes()
    cmd = [exe, "-hide_banner", "-nostdin", "-v", "error", "-y", "-f", "f32le", "-ar", str(fs), "-ac", str(y.shape[0]),
           "-i", "pipe:0", *codec_args, str(path)]
    r = subprocess.run(cmd, input=pcm, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode("utf-8", "replace")[-400:])
    return path


def load(path, rate=None):
    """Decode and drop the report."""
    y, fs, _ = decode(path, rate)
    return y, fs


def save(path, y, fs, subtype="FLOAT"):
    """Write (channels, n) as WAV or FLAC; returns the file sha256."""
    sf.write(str(path), np.asarray(y, np.float32).T, fs, subtype=subtype)
    return sha256_file(path)
