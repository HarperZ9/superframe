# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The measured difference report: an output against every vault item in its lineage and against
its nearest neighbours in the vault, each number beside its preregistered threshold.

No metric here decides infringement. The report is evidence for a human decision.
"""
import hashlib
import json
import os
import re

import numpy as np

from . import audiofeat, media, perceptual, safety
from .config import THRESHOLDS_FILE, Layout, thresholds
from .lineage import load as load_lineage
from .vault import Vault, now, sha256_file

HONESTY = ("No metric here decides infringement. Substantial similarity is a legal judgement about protected "
           "expression. This report is evidence for a human decision, not a clearance.")
WORD = re.compile(r"\w+", re.U)


def _media_type(path):
    with open(path, "rb") as f:
        return safety.sniff(f.read(4096))[0]


def _visual(path, mt, side=320):
    if mt.startswith("image/") or mt.startswith("video/"):
        return [media.image_array(f, side) for f in media.frames(path, mt, 3)]
    return []


def _text(path):
    with open(path, "rb") as f:
        return f.read().decode("utf-8", "replace")


def text_metrics(out_text, src_text, n):
    a, b = [w.lower() for w in WORD.findall(out_text)], [w.lower() for w in WORD.findall(src_text)]
    if not a or not b:
        return {"longest_common_run_words": 0, "ngram_containment": 0.0}
    pos = {}
    for j in range(len(b) - 2):
        pos.setdefault(tuple(b[j:j + 3]), []).append(j)
    best = 1 if set(a) & set(b) else 0
    for i in range(len(a) - 2):
        for j in pos.get(tuple(a[i:i + 3]), ())[:200]:
            k = 3
            while i + k < len(a) and j + k < len(b) and a[i + k] == b[j + k]:
                k += 1
            best = max(best, k)
    grams_a = {tuple(a[i:i + n]) for i in range(len(a) - n + 1)}
    grams_b = {tuple(b[i:i + n]) for i in range(len(b) - n + 1)}
    cont = len(grams_a & grams_b) / len(grams_a) if grams_a else 0.0
    return {"longest_common_run_words": best, "ngram_containment": round(cont, 4)}


def _check(metric, value, rule, threshold):
    ok = value is None or (value <= threshold if rule == "max" else value >= threshold)
    return {"metric": metric, "value": value, "threshold": threshold, "rule": rule, "pass": bool(ok)}


class Comparer:
    def __init__(self, output, T):
        self.output, self.T = output, T
        self.mt = _media_type(output)
        self.frames = _visual(output, self.mt)
        self._feats = None
        self._fp = None
        self._txt = _text(output) if self.mt.startswith("text/") else None

    def feats(self):
        if self._feats is None and self.frames:
            from .decompose import image_measure
            self._feats = image_measure(self.frames[len(self.frames) // 2])[0]
        return self._feats

    def fp(self):
        if self._fp is None:
            x = media.audio(self.output) if (self.mt.startswith("audio/") or self.mt.startswith("video/")) else []
            self._fp = audiofeat.fingerprint(np.asarray(x), media.SR) if len(x) else np.zeros(0, np.uint32)
        return self._fp

    def compare(self, src_path, src_mt, spec=None):
        T, m, checks = self.T, {}, []
        sframes = _visual(src_path, src_mt) if self.frames else []
        if self.frames and sframes:
            reg = max((perceptual.copied_region(s, o) for s in sframes for o in self.frames),
                      key=lambda r: r["largest_region_share"])
            m["patch"] = reg
            m["phash_distance"] = round(min(perceptual.phash_distance(s, o) for s in sframes for o in self.frames), 4)
            sf = None
            if spec and isinstance(spec.get("measurements"), dict) and "sym_lr" in spec["measurements"]:
                sf = spec["measurements"]
            if sf is None:
                from .decompose import image_measure
                sf = image_measure(sframes[len(sframes) // 2])[0]
            fd = perceptual.feature_distance(self.feats(), sf)
            m["feature_distance"] = None if fd is None else round(fd, 4)
            ti = T["image"]
            checks += [_check("patch_region_share", reg["largest_region_share"], "max", ti["patch_region_share_max"]),
                       _check("phash_distance", m["phash_distance"], "min", ti["phash_distance_min"]),
                       _check("feature_distance", m["feature_distance"], "min", ti["feature_distance_min"])]
        if (self.mt.startswith("audio/") or self.mt.startswith("video/")) and \
                (src_mt.startswith("audio/") or src_mt.startswith("video/")):
            x = media.audio(src_path)
            if len(x) and len(self.fp()):
                sec = audiofeat.longest_match_seconds(self.fp(), audiofeat.fingerprint(x, media.SR))
                m["audio_matching_segment_seconds"] = sec
                checks.append(_check("audio_matching_segment_seconds", sec, "max",
                                     T["audio"]["matching_segment_seconds_max"]))
        if self._txt is not None and src_mt.startswith("text/"):
            tm = text_metrics(self._txt, _text(src_path), T["text"]["ngram_n"])
            m.update(tm)
            checks += [_check("longest_common_run_words", tm["longest_common_run_words"], "max",
                              T["text"]["longest_common_run_words_max"]),
                       _check("ngram_containment", tm["ngram_containment"], "max", T["text"]["ngram_containment_max"])]
        return m, checks


def _neighbours(vault, comparer, exclude, k):
    """Nearest vault items: by pHash from specs for visual outputs, by n-gram overlap for text."""
    L = vault.L
    cands = []
    if comparer.frames:
        h = perceptual.phash_hex(comparer.frames[len(comparer.frames) // 2])
        for rec in vault.records():
            if rec["sha256"] in exclude:
                continue
            p = L.spec_path(f"spec-{rec['sha256'][:16]}-v1")
            if not os.path.exists(p):
                continue
            with open(p, encoding="utf-8") as f:
                ms = json.load(f).get("measurements", {})
            hs = [ms["phash64"]] if "phash64" in ms else ms.get("phash64_frames", [])
            if hs:
                cands.append((min(perceptual.phash_distance_hex(h, x) for x in hs), rec["sha256"]))
    elif comparer._txt is not None:
        for rec in vault.records():
            if rec["sha256"] in exclude or not rec["media_type"].startswith("text/"):
                continue
            tm = text_metrics(comparer._txt, _text(vault.copy_file(rec["sha256"])), 5)
            cands.append((-tm["longest_common_run_words"] - tm["ngram_containment"], rec["sha256"]))
    return [s for _, s in sorted(cands)[:k]]


def _dominance(vault, lin, cmp, lineage_shas, T):
    """Largest measured attribution to one source, beside the slider weights for a blend."""
    blend = (lin or {}).get("blend")
    if blend:
        mx = max([s["measured_attribution"] for s in blend["sources"]] or [0])
        return {"sources": [{"ref": s["ref"], "sha256": s["sha256"], "slider_weight_form": s["slider_weight_form"],
                            "measured_attribution": s["measured_attribution"]} for s in blend["sources"]],
               "check": _check("max_measured_attribution", mx, "max", T["blend"]["dominance_share_max"])}
    if lin and lin["label"] == "copy-derived" and cmp.frames and lineage_shas:
        pairs = [(s, a) for s in lineage_shas if vault.record(s)
                 for a in _visual(vault.copy_file(s), vault.record(s)["media_type"])[:1]]
        if pairs:
            att = perceptual.attribution(cmp.frames[len(cmp.frames) // 2], [a for _, a in pairs])
            return {"sources": [{"sha256": s, "measured_attribution": v} for (s, _), v in zip(pairs, att["shares"])],
                   "check": _check("max_measured_attribution", max(att["shares"]), "max",
                                   T["blend"]["dominance_share_max"])}
    return None


def run(output, root=None, T=None, store=True):
    T = T or thresholds()
    vault = Vault(root)
    lin = load_lineage(output)
    cmp = Comparer(output, T)
    lineage_shas = [c["sha256"] for c in (lin or {}).get("reads", {}).get("vault_copies", [])]
    lineage_shas += [s["vault_sha256"] for s in (lin or {}).get("reads", {}).get("specs", [])
                     if s["vault_sha256"] not in lineage_shas]
    neigh = _neighbours(vault, cmp, set(lineage_shas), T.get("neighbours", 5))
    comps = []
    for relation, shas in (("lineage", lineage_shas), ("neighbour", neigh)):
        for sha in shas:
            rec = vault.record(sha)
            if rec is None:
                comps.append({"vault_sha256": sha, "relation": relation, "error": "not in vault", "checks": []})
                continue
            sp = vault.L.spec_path(f"spec-{sha[:16]}-v1")
            spec = json.load(open(sp, encoding="utf-8")) if os.path.exists(sp) else None
            m, checks = cmp.compare(vault.copy_file(sha), rec["media_type"], spec)
            comps.append({"vault_sha256": sha, "relation": relation, "media_type": rec["media_type"],
                          "licence": rec.get("licence"), "metrics": m, "checks": checks})
    dom = _dominance(vault, lin, cmp, lineage_shas, T)
    all_checks = [c for x in comps for c in x["checks"]] + ([dom["check"]] if dom else [])
    rep = {"schema": "cleanroom.difference/1", "honesty": HONESTY, "output": os.path.basename(output),
           "output_sha256": sha256_file(output), "output_media_type": cmp.mt,
           "lineage_label": (lin or {}).get("label", "unknown"), "created_at": now(),
           "thresholds_sha256": sha256_file(THRESHOLDS_FILE), "thresholds": T, "comparisons": comps,
           "attribution": dom, "checks_run": len(all_checks), "passes_all": all(c["pass"] for c in all_checks),
           "failed": [c for c in all_checks if not c["pass"]]}
    body = json.dumps({k: v for k, v in rep.items() if k != "created_at"}, sort_keys=True, default=str)
    rep["report_sha256"] = hashlib.sha256(body.encode()).hexdigest()
    if store:
        p = os.path.join(Layout(root).ensure().reports, rep["report_sha256"] + ".json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(rep, f, indent=1, default=str)
        rep["stored_at"] = p
    return rep
