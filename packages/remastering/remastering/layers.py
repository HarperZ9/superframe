# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Layers inside a stem, each with a role from measurement.

Every stem is split three ways by soft masks on one STFT (n_fft 4096, hop 1024 at 44.1 kHz, scaled with the rate):
- transient: what a median across frequency keeps (broadband, short: hits, attacks, consonants);
- sustained: what a median across time keeps over ~0.75 s (held notes, pads, drones);
- moving: the harmonic rest, notes that change faster than the long median (lines, leads, riffs).
Masks are Wiener-style ratios of the filtered power and sum to 1 in every bin, so the layers sum back to the stem
up to the STFT round trip (checked in the tests). The masks are computed on the mono magnitude and applied to each
channel, so a layer keeps the stem's stereo image. The median filter selects samples, so the result is exact and
repeatable. Roles come from the layer's measured level, flatness, sustain and onset rate, not from the stem name.
"""
import numpy as np
from .kernels import gpu, medfilt, medfilt_t
from .stft import istft, stft


def frame_params(fs):
    scale = max(1, int(round(fs / 44100)))
    return 4096 * scale, 1024 * scale


def masks(mag, fs, hop, sustain_s=0.75, harm_frames=17, perc_bins=17, power=2.0):
    """Soft masks (transient, sustained, moving) from a magnitude (bins, frames)."""
    harm = medfilt(mag, harm_frames, 1)
    perc = medfilt(mag, perc_bins, 0)
    long_frames = max(3, int(round(sustain_s * fs / hop)) | 1)
    sus = np.minimum(medfilt(mag, long_frames, 1), harm)
    mov = np.maximum(harm - sus, 0.0)
    p = [perc ** power, sus ** power, mov ** power]
    tot = p[0] + p[1] + p[2] + 1e-20
    return [q / tot for q in p]


def _split_torch(t, stem, fs, n_fft, hop):
    """The same split on the GPU in float32 (torch.stft / istft, sort-based medians). Bit-repeatable on one device;
    it differs from the CPU path in the last bits of the FFTs."""
    x = t.from_numpy(np.ascontiguousarray(stem, np.float32)).cuda()
    w = t.hann_window(n_fft, periodic=True, device=x.device)
    S = t.stft(x, n_fft, hop, window=w, center=True, pad_mode="reflect", return_complex=True)
    mono = S.sum(0).abs() / S.shape[0]
    harm = medfilt_t(mono, 17, 1)
    perc = medfilt_t(mono, 17, 0)
    long_frames = max(3, int(round(0.75 * fs / hop)) | 1)
    sus = t.minimum(medfilt_t(mono, long_frames, 1), harm)
    mov = t.clamp(harm - sus, min=0.0)
    p = [perc ** 2, sus ** 2, mov ** 2]
    tot = p[0] + p[1] + p[2] + 1e-20
    out, mags = {}, {}
    for name, q in zip(("transient", "sustained", "moving"), p):
        m = q / tot
        out[name] = t.istft(S * m[None], n_fft, hop, window=w, center=True, length=stem.shape[1]).cpu().numpy()
        mags[name] = _features_t(t, mono * m)
    return out, mags


def _features_t(t, S):
    """Per-frame energy (dB), positive log flux and flatness on the device, from every other bin; small vectors back."""
    S = S[::2]
    e = 10 * t.log10((S ** 2).sum(0) + 1e-20)
    flux = t.clamp(t.diff(t.log(S + 1e-9), dim=1), min=0).sum(0)
    flat = t.exp(t.log(S + 1e-12).mean(0)) / (S.mean(0) + 1e-12)
    return {"e": e.cpu().numpy().astype(np.float64), "flux": flux.cpu().numpy().astype(np.float64),
            "flat": flat.cpu().numpy().astype(np.float64)}


def split_layers(stem, fs, with_spectra=False, device=None):
    """(channels, n) -> {"transient", "sustained", "moving"} each (channels, n); with_spectra also returns each
    layer's mono magnitude (bins, frames) for the features. device "cuda" (default when present) or "cpu"."""
    n_fft, hop = frame_params(fs)
    t = gpu() if device != "cpu" else None
    if t:
        out, mags = _split_torch(t, stem, fs, n_fft, hop)
        return (out, mags) if with_spectra else out
    specs = [stft(ch, n_fft, hop) for ch in stem]
    mono = np.abs(sum(specs)) / len(specs)
    ms = masks(mono, fs, hop)
    out, mags = {}, {}
    for name, m in zip(("transient", "sustained", "moving"), ms):
        out[name] = np.stack([istft(S * m, n_fft, hop, stem.shape[1]) for S in specs])
        mags[name] = mono * m
    return (out, mags) if with_spectra else out


def _flatness(mag):
    g = np.exp(np.mean(np.log(mag + 1e-12), 0))
    a = np.mean(mag, 0) + 1e-12
    return g / a


def features(y, fs, mag=None):
    """Level (dB), median flatness, onset rate (per s) and sustain share of a layer; `mag` (bins, frames) is the
    layer's mono magnitude at frame_params(fs) when the caller already has it."""
    m = np.atleast_2d(y).mean(0)
    lvl = 10 * np.log10(np.mean(m ** 2) + 1e-20)
    n_fft, hop = frame_params(fs)
    if isinstance(mag, dict):                                  # already reduced on the device
        e, flux, flat = mag["e"], mag["flux"], mag["flat"]
    else:
        S = mag if mag is not None else np.abs(stft(m, n_fft, hop))
        S = np.asarray(S[::2], np.float32)                     # every other bin is plenty for these descriptors
        e = 10 * np.log10((S ** 2).sum(0) + 1e-20)
        flux = np.maximum(np.diff(np.log(S + 1e-9), axis=1), 0).sum(0)
        flat = _flatness(S)
    thr = np.median(flux) + 3 * (np.median(np.abs(flux - np.median(flux))) + 1e-9)
    on = (flux[1:-1] > thr) & (flux[1:-1] >= flux[:-2]) & (flux[1:-1] >= flux[2:]) & (e[2:-1] > e.max() - 50)
    dur = len(m) / fs
    loud = e > e.max() - 30
    return {"level_db": round(float(lvl), 1), "flatness": round(float(np.median(flat[loud])) if loud.any() else 1.0, 4),
            "onsets_per_s": round(float(on.sum() / max(dur, 1e-9)), 2), "active_share": round(float(loud.mean()), 3)}


def role(stem_name, layer_name, feat, mix_db):
    """Name what the layer does."""
    lvl = feat["level_db"]
    if lvl < -60:
        return "silent"
    if lvl < mix_db - 30:
        return "trace"                       # leakage, not a part
    if stem_name == "drums":
        return "drums-hits" if layer_name == "transient" else "drums-tone"
    if stem_name == "bass":
        return "bass-attack" if layer_name == "transient" else "bass"
    if layer_name == "transient":
        return "attack" if feat["flatness"] < 0.3 else "fx-noise"
    if layer_name == "sustained":
        return "pad" if feat["flatness"] < 0.3 else "fx-texture"
    if stem_name == "vocals":
        return "lead-voice"
    return "lead" if feat["onsets_per_s"] >= 0.5 else "harmony"


def decompose(stems, fs, mix):
    """Every stem into layers with roles. Returns {stem: {layer: {"audio", "role", "features"}}}."""
    mix_db = 10 * np.log10(np.mean(np.atleast_2d(mix).mean(0) ** 2) + 1e-20)
    out = {}
    for sname, s in stems.items():
        out[sname] = {}
        audio_, mags = split_layers(s, fs, with_spectra=True)
        for lname, a in audio_.items():
            f = features(a, fs, mags[lname])
            out[sname][lname] = {"audio": a, "role": role(sname, lname, f, mix_db), "features": f}
    return out
