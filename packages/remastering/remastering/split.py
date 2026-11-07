# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Deterministic stem split with Demucs: htdemucs_ft for four stems, htdemucs_6s for six.

stems=4 (the default) runs htdemucs_ft, four per-source fine-tuned Hybrid Transformer Demucs models, each trusted
for its own source only (drums, bass, other, vocals). stems=6 runs htdemucs_6s (drums, bass, other, vocals, guitar,
piano). On the 50 MUSDB18-HQ test tracks the four-stem path scores higher than the six-stem one with guitar and piano
folded back into other; the numbers are in ../README.md.

Reproducible means the same input bytes give the same output bytes on the same device and software, not that the
stems are the true parts: splitting a finished mix is ill-posed, and every stem carries some of the others.
What is pinned:
- the weights, loaded from local files whose sha256 must match PINNED (no network fetch at run time). The files are
  looked up in the directories listed in REMASTER_MODELS (os.pathsep-separated). There is no default location;
- shifts = 0 (Demucs' random time shifts are off), overlap 0.25, the model's own segment length, split on;
- cuDNN benchmark off (no timing-dependent algorithm choice), TF32 off, CUBLAS_WORKSPACE_CONFIG=:4096:8, seed 0;
  REMASTER_STRICT=1 also turns on torch's deterministic algorithms and cuDNN's deterministic mode (slower);
- the input normalisation (mean and std of the mono mix), as Demucs' own separate() does;
- the batched path (default) or Demucs' own apply_model, recorded in the receipt.
The GPU path and the CPU path are each bit-repeatable; they are not bit-identical to each other (different kernels),
and the receipt records the device so a rerun is compared like with like.
"""
import os
import time
from pathlib import Path

import numpy as np

from . import receipts as RC
from .resample import resample_fft

FOUR = ["drums", "bass", "other", "vocals"]
SIX = ["drums", "bass", "other", "vocals", "guitar", "piano"]
# name -> weight files in bag order (with sha256) and the sources it returns. A bag with one file per source uses an
# identity weight matrix: file i supplies source i only, as Demucs' htdemucs_ft.yaml sets it.
MODELS = {
    "htdemucs_ft": {"sources": FOUR, "files": {
        "f7e0c4bc-ba3fe64a.th": "ba3fe64ae8ef66ac9a4857222ce48efbdc5eb3ad375cb79dd13debee5aaa4066",
        "d12395a8-e57c48e6.th": "e57c48e6b0e38af4f7118d7bd08c49f0a0c0edf7d09143bdd902ea0d237303e6",
        "92cfc3b6-ef3bcb9c.th": "ef3bcb9c8b40d14ae5d51b6db2587339cc12c6b77c0be151ce6d69002e087bf2",
        "04573f0d-f3cf25b2.th": "f3cf25b222c4eed7cd49dd8b2c9597d50c18bd154090f7b919cfa5f93cf22c49"}},
    "htdemucs_6s": {"sources": SIX, "files": {
        "5c90dfd2-34c22ccb.th": "34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd"}},
}
BY_STEMS = {4: "htdemucs_ft", 6: "htdemucs_6s"}
PINNED = {f: h for m in MODELS.values() for f, h in m["files"].items()}
MODEL_RATE = 44100
SETTINGS = {"shifts": 0, "overlap": 0.25, "split": True, "segment": "model default", "seed": 0, "tf32": False,
            "cudnn_benchmark": False, "model_rate": MODEL_RATE}
_CACHE = {}


class WeightsNotConfigured(RuntimeError):
    pass


def model_dirs():
    """The directories named in REMASTER_MODELS, in order. Required: no path ships with the package."""
    raw = os.environ.get("REMASTER_MODELS", "").strip()
    if not raw:
        raise WeightsNotConfigured("set REMASTER_MODELS to the directory (or os.pathsep-separated directories) that "
                                   "hold the pinned Demucs weight files; see packages/remastering/README.md")
    return [Path(p) for p in raw.split(os.pathsep) if p.strip()]


def weight_path(fname):
    for d in model_dirs():
        if (d / fname).is_file():
            return d / fname
    raise WeightsNotConfigured(f"{fname} not found in the REMASTER_MODELS directories")


def model_name(stems):
    if stems not in BY_STEMS:
        raise ValueError(f"stems must be one of {sorted(BY_STEMS)}, got {stems!r}")
    return BY_STEMS[stems]


def available(stems=4):
    """None when the weights for this stem count are configured and present, else the reason they are not."""
    try:
        for f in MODELS[model_name(stems)]["files"]:
            weight_path(f)
    except (WeightsNotConfigured, ValueError) as e:
        return str(e)
    return None


def strict():
    """REMASTER_STRICT=1: cuDNN restricted to algorithms it guarantees deterministic (about 7x slower on the 4090).
    Default: cuDNN's fixed heuristic choice (benchmark off, so no timing-dependent pick), whose forward kernels are
    repeatable in practice; the suite's tests check the repeat by hash rather than trusting either setting."""
    return os.environ.get("REMASTER_STRICT", "0") == "1"


def _setup_torch(device):
    os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
    import torch
    torch.manual_seed(0)
    torch.use_deterministic_algorithms(strict(), warn_only=False)
    torch.backends.cudnn.benchmark = False
    torch.backends.cudnn.deterministic = strict()
    torch.backends.cuda.matmul.allow_tf32 = False
    torch.backends.cudnn.allow_tf32 = False
    if device == "cpu":
        torch.set_num_threads(max(1, min(8, (os.cpu_count() or 4) - 2)))
    return torch


def load_model(device, stems=4):
    """The pinned model for this stem count on this device, and {file: sha256} as checked at load."""
    name = model_name(stems)
    key = (device, name)
    if key in _CACHE:
        return _CACHE[key]
    torch = _setup_torch(device)
    from demucs.apply import BagOfModels
    from demucs.states import load_model as demucs_load
    subs, hashes = [], {}
    for fname, want in MODELS[name]["files"].items():
        path = weight_path(fname)
        got = RC.sha256_file(path)
        if got != want:
            raise RuntimeError(f"weights {fname} have sha256 {got}, expected {want}")
        subs.append(demucs_load(torch.load(str(path), map_location="cpu", weights_only=False)))
        hashes[fname] = got
    if len(subs) == 1:
        model = subs[0]
    else:
        n = len(subs)
        model = BagOfModels(subs, weights=[[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)])
    model = model.to(device).eval()
    if list(model.sources) != MODELS[name]["sources"]:
        raise RuntimeError(f"{name} sources {model.sources} differ from {MODELS[name]['sources']}")
    _CACHE[key] = (model, hashes)
    return model, hashes


def pick_device(prefer="cuda"):
    try:
        import torch
        return "cuda" if prefer == "cuda" and torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def apply_batched(model, wav, overlap=0.25, batch=8):
    """Demucs' apply_model(split=True, shifts=0) with the same chunking, padding, triangle weights and overlap-add,
    but the equal-length chunks run through the model in batches (the GPU is mostly idle at batch 1). Batched
    convolutions differ from batch-1 ones in the last bits, so this is its own repeatable path, recorded as such.
    A BagOfModels is applied member by member and mixed with its weight matrix, as apply_model does."""
    import torch
    if hasattr(model, "models"):
        out, total = 0, 0
        for sub, w in zip(model.models, model.weights):
            w = torch.tensor(w, dtype=torch.float32, device=wav.device)[None, :, None, None]
            out = out + apply_batched(sub, wav, overlap, batch) * w
            total = total + w
        return out / total
    from demucs.apply import TensorChunk
    from demucs.utils import center_trim
    _, channels, length = wav.shape
    seg = int(model.samplerate * model.segment)
    stride = int((1 - overlap) * seg)
    offsets = list(range(0, length, stride))
    weight = torch.cat([torch.arange(1, seg // 2 + 1, device=wav.device),
                        torch.arange(seg - seg // 2, 0, -1, device=wav.device)]).float()
    weight = weight / weight.max()
    out = torch.zeros(1, len(model.sources), channels, length, device=wav.device)
    sum_w = torch.zeros(length, device=wav.device)
    chunks = [TensorChunk(wav, o, seg) for o in offsets]
    groups = {}
    for i, c in enumerate(chunks):
        groups.setdefault(c.length, []).append(i)
    for clen, idx in groups.items():
        vlen = model.valid_length(clen) if hasattr(model, "valid_length") else clen
        for b in range(0, len(idx), batch):
            sel = idx[b:b + batch]
            x = torch.cat([chunks[i].padded(vlen) for i in sel], 0)
            with torch.no_grad():
                y = center_trim(model(x), clen)
            for j, i in enumerate(sel):
                o = offsets[i]
                out[..., o:o + clen] += weight[:clen] * y[j:j + 1]
                sum_w[o:o + clen] += weight[:clen]
    return out / sum_w


def separate(y, fs, device=None, batched=True, stems=4):
    """(channels, n) at fs -> dict of stems at fs, plus a receipt. Stereo in, stereo out.
    stems=4: htdemucs_ft (drums, bass, other, vocals); stems=6: htdemucs_6s (adds guitar and piano)."""
    name = model_name(stems)
    device = device or pick_device()
    model, hashes = load_model(device, stems)
    torch = _setup_torch(device)
    from demucs.apply import apply_model
    t0 = time.perf_counter()
    x = resample_fft(y, fs, MODEL_RATE).astype(np.float32) if fs != MODEL_RATE else np.asarray(y, np.float32)
    ref = x.mean(0)
    mu, sd = float(ref.mean()), float(ref.std()) or 1.0
    wav = torch.from_numpy((x - mu) / sd)[None].to(device)
    with torch.no_grad():
        if batched:
            out = apply_batched(model, wav, overlap=0.25)
        else:
            out = apply_model(model, wav, shifts=0, split=True, overlap=0.25, progress=False, device=device)
    out = out[0].float().cpu().numpy().astype(np.float64) * sd + mu / len(model.sources)   # the mean once in the sum, not once per stem
    result = {}
    for i, src in enumerate(model.sources):
        s = out[i]
        result[src] = resample_fft(s, MODEL_RATE, fs)[:, : y.shape[1]] if fs != MODEL_RATE else s
    seconds = time.perf_counter() - t0
    rec = RC.make("split", {"audio": RC.sha256_array(y)},
                  dict(SETTINGS, model=name, stems=stems, device=device, fs=fs, batched=batched, strict=strict()),
                  {k: RC.sha256_array(v) for k, v in result.items()}, models=hashes,
                  extra={"torch": torch.__version__, "seconds": round(seconds, 3),
                         "gpu": torch.cuda.get_device_name(0) if device == "cuda" else None})
    return result, rec
