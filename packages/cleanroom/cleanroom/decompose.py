# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The study side: turn a vault copy into a SPEC record of measurements, parts, rules and prose.

A SPEC holds numbers and words only. It never carries media, frames, crops, thumbnails or verbatim
text from the original. Each spec cites the vault sha256 it was measured from.
"""
import hashlib
import json
import os

import numpy as np

from . import audiofeat, media, perceptual
from .config import Layout, use_libs
from .vault import Vault, now

use_libs("design-parts", "lattice", "text-phase")
from design_parts import extract, palette as dp_palette  # noqa: E402
from design_parts.imageio import lightness  # noqa: E402

EXTRACTORS = {"design-parts": "superframe packages/decompose/design_parts (measure_all, 74 features)",
              "lattice": "superframe packages/lattice (imagerep.axis_alignment)",
              "text-phase": "superframe packages/decompose/textphase (entropy, phase.profile)",
              "audio": "cleanroom.audiofeat (spectrum, onsets, tempo, loudness)"}
SPEC_VERSION = "v1"


def _r(v, k=4):
    return None if v is None or (isinstance(v, float) and not np.isfinite(v)) else round(float(v), k)


def spec_id_for(sha):
    return f"spec-{sha[:16]}-{SPEC_VERSION}"


def image_measure(img):
    """img: PIL image or array. Returns (measurements, parts, rules)."""
    from lattice.imagerep import axis_alignment
    a = media.image_array(img, 256)
    feats, extra = extract.measure_all(a)
    C, shares = dp_palette.palette(a)
    L = lightness(a) / 100.0
    try:
        axis = _r(axis_alignment(L))
    except Exception as e:  # keep measuring; record why this one is missing
        axis = None
        feats["_axis_error"] = repr(e)
    m = {k: _r(v) for k, v in feats.items() if not k.startswith("_")}
    m["axis_alignment"] = axis
    m["radial_spectrum_8"] = perceptual.radial_spectrum(L)
    parts = {"palette_lab": [{"L": _r(c[0], 2), "a": _r(c[1], 2), "b": _r(c[2], 2), "share": _r(s, 3)}
                             for c, s in zip(C, shares)],
             "primitives": {k: int(feats.get(f"prim_{k}", 0) or 0) for k in ("circle", "quad", "tri", "irregular")},
             "segments": len(extra["segments"]), "vanishing_points": len(extra["vps"]),
             "wallpaper_group": extra["wallpaper"].get("group"), "harmony": extra["harmony"]}
    rules = _image_rules(m, parts)
    return m, parts, rules


def _image_rules(m, parts):
    r = [f"colour harmony reads {parts['harmony']} with {len(parts['palette_lab'])} palette colours"]
    if (m.get("sym_lr") or 0) > 0.8:
        r.append(f"near mirror symmetry left to right (strength {m['sym_lr']})")
    if (m.get("rot_order") or 0) >= 3 and (m.get("rot_strength") or 0) > 0.6:
        r.append(f"{int(m['rot_order'])}-fold rotational order")
    if parts["wallpaper_group"] and (m.get("wp_strength") or 0) >= 0.5:
        r.append(f"periodic, wallpaper group {parts['wallpaper_group']}")
    if m.get("focal_d_thirds") is not None and m["focal_d_thirds"] < 0.05:
        r.append("focal point sits on a rule-of-thirds intersection")
    if m.get("neg_space") is not None:
        r.append(f"negative space share {m['neg_space']}")
    if m.get("spec_slope") is not None:
        r.append(f"power spectrum slope {m['spec_slope']} (natural images sit near -2)")
    return r


def _image_prose(m, parts):
    pal = ", ".join(f"L{p['L']:.0f} a{p['a']:.0f} b{p['b']:.0f} ({p['share']:.0%})" for p in parts["palette_lab"][:5])
    prim = parts["primitives"]
    return (f"A {parts['harmony']} image whose palette is {pal}. Lightness runs from {m.get('L_p5')} to "
            f"{m.get('L_p95')} with key {m.get('L_key')}. It holds {sum(prim.values())} primitive regions "
            f"({prim['circle']} round, {prim['quad']} four-sided, {prim['tri']} three-sided, {prim['irregular']} "
            f"irregular) and {parts['segments']} line segments. Mirror symmetry is {m.get('sym_lr')} across the "
            f"vertical axis; negative space is {m.get('neg_space')}; edge density is {m.get('edge_density')}; the "
            f"spectrum falls with slope {m.get('spec_slope')}.")


def _aggregate(frames_m):
    keys = [k for k, v in frames_m[0].items() if isinstance(v, (int, float)) and v is not None]
    out = {}
    for k in keys:
        vals = np.array([f[k] for f in frames_m if isinstance(f.get(k), (int, float))], float)
        out[k] = {"mean": _r(vals.mean()), "sd": _r(vals.std())}
    return out


def text_measure(text):
    from textphase import entropy, phase, symbols
    words = text.split()
    sents = max(1, sum(text.count(c) for c in ".!?"))
    seq = symbols.chars(text)
    m = {"characters": len(text), "words": len(words), "sentences_approx": sents,
         "mean_word_length": _r(np.mean([len(w) for w in words]) if words else 0, 3),
         "type_token_ratio": _r(len({w.lower() for w in words}) / max(1, len(words)), 3),
         "lines": text.count("\n") + 1}
    if len(seq) >= 40:
        m["entropy_lz_bits_per_char"] = _r(entropy.lz_rate(seq))
        m["entropy_ppm_bits_per_char"] = _r(entropy.ppm_rate(seq, symbols.N_CHAR)[0])
    if len(seq) >= 3000:
        p = phase.profile(seq, symbols.N_CHAR, np.random.default_rng(0))
        m["phase"] = p["phase"]
        m["repeat_share"] = _r(p["repeat_share"])
    rules = [f"{m['words']} words in about {sents} sentences, mean word length {m['mean_word_length']}"]
    if "phase" in m:
        rules.append(f"correlation phase reads {m['phase']}")
    prose = (f"A text of {m['characters']} characters and {m['words']} words. Vocabulary richness (type to token "
             f"ratio) is {m['type_token_ratio']}; entropy rate is {m.get('entropy_ppm_bits_per_char')} bits per "
             f"character by PPM. No words from the original are stored.")
    return m, {}, rules, prose


def decompose(vault, sha):
    rec = vault.record(sha)
    path = vault.copy_file(sha)
    mt = rec["media_type"]
    fam = mt.split("/")[0]
    spec = {"schema": "cleanroom.spec/1", "spec_id": spec_id_for(sha), "vault_sha256": sha, "media_type": mt,
            "licence": rec.get("licence", "unknown"), "created_at": now(), "extractors": {},
            "contains_no_media": True}
    if fam == "image" and mt != "image/gif":
        m, parts, rules = image_measure(path)
        spec.update(measurements=m, parts=parts, rules=rules, description=_image_prose(m, parts))
        spec["measurements"]["phash64"] = perceptual.phash_hex(media.image_array(path, 256))
        spec["extractors"] = {k: EXTRACTORS[k] for k in ("design-parts", "lattice")}
    elif fam == "video" or mt == "image/gif":
        fr = media.frames(path, mt, 5)
        per = [image_measure(f) for f in fr]
        agg = _aggregate([p[0] for p in per]) if per else {}
        m = {"frames_sampled": len(per), "frame_features": agg}
        if per:
            m["phash64_frames"] = [perceptual.phash_hex(media.image_array(f, 256)) for f in fr]
        if fam == "video":
            m["duration_s"] = _r(media.duration(path), 3)
            m["audio"] = audiofeat.features(media.audio(path), media.SR)
        parts = per[len(per) // 2][1] if per else {}
        rules = per[len(per) // 2][2] if per else []
        if m.get("audio", {}).get("tempo_bpm"):
            rules = rules + [f"audio tempo near {m['audio']['tempo_bpm']} BPM, {m['audio']['onsets']} onsets"]
        prose = (f"A {mt} of {m.get('duration_s', len(per))} {'seconds' if fam == 'video' else 'frames'}. "
                 + (_image_prose(per[len(per) // 2][0], parts) if per else "No frame decoded."))
        spec.update(measurements=m, parts=parts, rules=rules, description=prose)
        spec["extractors"] = {k: EXTRACTORS[k] for k in ("design-parts", "lattice", "audio")}
    elif fam == "audio":
        x = media.audio(path)
        m = audiofeat.features(x, media.SR)
        spec.update(measurements=m, parts={}, rules=[f"tempo {m.get('tempo_bpm')} BPM"],
                    description=f"Audio of {m.get('seconds')} s, loudness {m.get('loudness_rms_dbfs')} dBFS, "
                                f"centroid {m.get('spectral_centroid_hz')} Hz, tempo {m.get('tempo_bpm')} BPM.")
        spec["extractors"] = {"audio": EXTRACTORS["audio"]}
    elif fam == "text":
        with open(path, "rb") as f:
            text = f.read().decode("utf-8", "replace")
        m, parts, rules, prose = text_measure(text)
        spec.update(measurements=m, parts=parts, rules=rules, description=prose)
        spec["extractors"] = {"text-phase": EXTRACTORS["text-phase"]}
    else:
        spec.update(measurements={"size": rec["size"]}, parts={}, rules=[],
                    description=f"A {mt} file of {rec['size']} bytes; no extractor applies.")
    body = json.dumps({k: v for k, v in spec.items() if k != "created_at"}, sort_keys=True, default=str)
    spec["content_sha256"] = hashlib.sha256(body.encode()).hexdigest()
    return spec


def _clean(o):
    """Strict JSON: non-finite numbers become null."""
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (float, np.floating)):
        return float(o) if np.isfinite(o) else None
    if isinstance(o, np.integer):
        return int(o)
    return o


def write_spec(layout, spec):
    p = layout.spec_path(spec["spec_id"])
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(_clean(spec), f, indent=1, ensure_ascii=False, default=str, allow_nan=False)
    return p


def decompose_all(root=None, shas=None, force=False, log=print):
    v = Vault(root)
    done, failed = 0, []
    for rec in (v.record(s) for s in shas) if shas else v.records():
        sid = spec_id_for(rec["sha256"])
        if not force and os.path.exists(v.L.spec_path(sid)):
            continue
        try:
            write_spec(v.L, decompose(v, rec["sha256"]))
            done += 1
        except Exception as e:  # one bad file must not stop the batch; log it with context
            failed.append((rec["sha256"], rec["media_type"], repr(e)))
            log(f"decompose failed {rec['sha256'][:12]} {rec['media_type']}: {e!r}")
    return done, failed


def load_spec(root, spec_id):
    with open(Layout(root).spec_path(spec_id), encoding="utf-8") as f:
        return json.load(f)
