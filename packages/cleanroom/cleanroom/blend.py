# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""`cleanroom blend`: combine any number of sources at any ratio, per channel, through the knobs.

A recipe names the sources (vault copies, specs, generated parameter sets or our own files), their
weights, per-channel weights, per-source detune, opacity, order, attack and release, every global
knob and the seed. Running a recipe writes the output, a resolved recipe (with every source hash)
and a lineage record with the slider weights and the measured attribution side by side.
"""
import copy
import hashlib
import json
import os

import numpy as np
from PIL import Image

from . import blend_audio, blend_image, media, perceptual
from .config import use_libs
from .lineage import Workspace

use_libs("design-parts")
from design_parts import generate  # noqa: E402

SPEC_DEFAULTS = {"palette_count": 4, "harm_m1": 0.5, "hue_cos": 1.0, "hue_sin": 0.0, "L_key": 50, "L_range": 50,
                 "chroma_mean": 30, "neg_space": 0.5, "prim_count": 8, "straight_share": 0.5, "prim_size_cv": 0.5,
                 "sym_lr": 0.3, "focal_x": 0.5, "focal_y": 0.5, "line_weight": 2, "self_sim": 0.2,
                 "orth_share": 0.5, "spec_slope": -2.0}


def _sha_json(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def spec_params(spec):
    m = spec.get("measurements", {})
    if "frame_features" in m:
        m = {k: v.get("mean") for k, v in m["frame_features"].items()}
    out = {}
    for k, d in SPEC_DEFAULTS.items():
        v = m.get(k)
        out[k] = float(v) if isinstance(v, (int, float)) and np.isfinite(v) else d
    return out


def _square(a, size):
    h, w = a.shape[:2]
    n = min(h, w)
    a = a[(h - n) // 2:(h - n) // 2 + n, (w - n) // 2:(w - n) // 2 + n]
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
    return np.asarray(im, float) / 255.0


def resolve(ws, src, size, seed):
    """(image array or None, (audio, sr) or None, resolved sha, kind)."""
    ref = src["ref"]
    kind, _, val = ref.partition(":")
    if kind == "vault":
        path = ws.open_copy(val)
        mt = ws.vault.record(val)["media_type"]
        img, aud = None, None
        if mt.startswith("image/") or mt.startswith("video/"):
            fr = media.frames(path, mt, 3)
            img = media.image_array(fr[len(fr) // 2], 512) if fr else None
        if mt.startswith("audio/") or mt.startswith("video/"):
            x = media.audio(path)
            aud = (x, media.SR) if len(x) > media.SR else None
        return img, aud, val, "vault"
    if kind == "spec":
        spec = ws.open_spec(val)
        p = spec_params(spec)
        return generate.render(p, size=size, seed=seed), None, spec.get("content_sha256"), "spec"
    if kind == "gen":
        p = dict(SPEC_DEFAULTS, **src.get("params", {}))
        sha = _sha_json(p)
        ws.note_generated(f"design-parts.generate seed {src.get('seed', seed)}", sha)
        return generate.render(p, size=size, seed=src.get("seed", seed)), None, sha, "generated"
    if kind == "own":
        sha = sha256_file(val)
        ws.note_generated(f"own file {os.path.basename(val)}", sha)
        if val.lower().endswith(".wav"):
            return None, media.read_wav(val), sha, "own"
        return media.image_array(val, 512), None, sha, "own"
    raise ValueError(f"unknown source ref {ref!r}")


def _normalise_sources(sources):
    out = []
    for i, s in enumerate(sources):
        s = dict(s)
        s.setdefault("weight", 1.0)
        s.setdefault("gain", 1.0)
        s["channels"] = dict({c: 1.0 for c in blend_image.CHANNELS}, **s.get("channels", {}))
        s.setdefault("order", i)
        out.append(s)
    return out


def _material(R):
    name = R.get("knobs", {}).get("material")
    if not name:
        return None
    use_libs("materials")
    import materials as M
    return M.get(name)["optics"]["srgb_preview"]["value"]


def run(recipe, root=None, recipe_dir=None):
    R = copy.deepcopy(recipe)
    seed, size = int(R.get("seed", 0)), int(R.get("size", 256))
    out = R["output"]
    if recipe_dir and not os.path.isabs(out):
        out = os.path.join(recipe_dir, out)
    ws = Workspace(root)
    sources = _normalise_sources(R["sources"])
    imgs, auds = [], []
    for s in sources:
        img, aud, sha, kind = resolve(ws, s, size, seed)
        if s.get("sha256") and s["sha256"] != sha:
            raise ValueError(f"source {s['ref']} changed: recipe has {s['sha256'][:12]}, found {sha[:12]}")
        s["sha256"], s["kind"] = sha, kind
        imgs.append(img)
        auds.append(aud)
    idx = [i for i, a in enumerate(imgs) if a is not None]
    if not idx:
        raise ValueError("a blend needs at least one image source for the visual channels")
    arrays = [_square(imgs[i], size) for i in idx]
    isrc = [sources[i] for i in idx]
    pic, measured = blend_image.render(arrays, isrc, R.get("knobs", {}), seed, _material(R))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    Image.fromarray((pic * 255 + 0.5).astype(np.uint8)).save(out, format="PNG", optimize=False)
    ws.transform("blend_image", knobs=dict(blend_image.DEFAULT_KNOBS, **R.get("knobs", {})), seed=seed)
    audio_out = None
    aidx = [i for i, a in enumerate(auds) if a is not None]
    if R.get("audio_output") and aidx:
        w = blend_image.channel_weights([sources[i] for i in aidx], "sound")
        cents = [100 * (R.get("knobs", {}).get("detune", 0) + sources[i].get("detune", 0)) for i in aidx]
        y, am = blend_audio.render([auds[i] for i in aidx], w, cents, R.get("knobs", {}), seed)
        import soundfile as sf
        audio_out = R["audio_output"] if os.path.isabs(R["audio_output"]) else os.path.join(recipe_dir or "", R["audio_output"])
        sf.write(audio_out, y, 22050, subtype="PCM_16")
        ws.transform("blend_audio", **am)
    att = perceptual.attribution(pic, arrays)
    weights = {c: [round(float(v), 6) for v in blend_image.channel_weights(isrc, c)] for c in blend_image.CHANNELS}
    resolved = dict(R, sources=[{k: v for k, v in s.items()} for s in sources])
    resolved["schema"] = "cleanroom.recipe/1"
    rpath = out + ".recipe.json"
    with open(rpath, "w", encoding="utf-8") as f:
        json.dump(resolved, f, indent=1, sort_keys=True)
    srcs = [{"ref": s["ref"], "sha256": s["sha256"], "kind": s["kind"], "slider_weight_form": weights["form"][j],
             "measured_attribution": att["shares"][j]} for j, s in enumerate(isrc)]
    lin = ws.write(out, {"blend": {"recipe_sha256": sha256_file(rpath), "sources": srcs,
                                   "channel_weights": weights, "unexplained_share": att["unexplained"],
                                   "measured": measured, "audio_output": audio_out}})
    return out, lin
