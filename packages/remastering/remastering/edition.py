# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Edition records and generations: a private catalogue entry per title, one folder per rebuild.

    <library>/<slug>/gen-001/edition.json      source condition, chain settings, model and binary hashes,
                                                provenance map, loudness and spectra before and after, the note
                             provenance.json, provenance.png, master.flac, receipts.json
    <library>/<slug>/catalogue.json            every generation with its hashes, newest last

The library root is REMASTER_LIBRARY, a required setting with no default, so no location ships with the package. The
library is internal and private: it holds rebuilds of the owner's own copies for study and is never redistributed. Generations are never overwritten;
`diff` compares two of them (settings that changed, loudness delta, spectral delta, SI-SDR between the masters).
"""
import json
import os
from pathlib import Path

import numpy as np

from . import receipts as RC
from .master import ltas_db, smooth_octave


class LibraryNotConfigured(RuntimeError):
    pass


def library():
    """The edition library root from REMASTER_LIBRARY. Required: writing a rebuild somewhere unasked is worse than
    stopping."""
    raw = os.environ.get("REMASTER_LIBRARY", "").strip()
    if not raw:
        raise LibraryNotConfigured("set REMASTER_LIBRARY to the private edition library directory; "
                                   "see packages/remastering/README.md")
    return Path(raw)


def next_generation(slug):
    d = library() / slug
    d.mkdir(parents=True, exist_ok=True)
    have = sorted(int(p.name[4:]) for p in d.glob("gen-*") if p.name[4:].isdigit())
    g = (have[-1] + 1) if have else 1
    out = d / f"gen-{g:03d}"
    out.mkdir()
    return g, out


def spectrum_summary(y, fs):
    f, db = ltas_db(y, fs)
    s = smooth_octave(f, db, 3)
    pts = np.geomspace(31.5, min(16000, fs / 2 - 1), 28)
    return {"freqs_hz": pts.round(1).tolist(), "level_db": np.interp(pts, f, s).round(2).tolist()}


def write(slug, gen_dir, record):
    (gen_dir / "edition.json").write_text(json.dumps(record, indent=1, default=RC._default), encoding="utf-8")
    cat = library() / slug / "catalogue.json"
    entries = json.loads(cat.read_text(encoding="utf-8")) if cat.exists() else []
    entries.append({"generation": record["generation"], "dir": gen_dir.name, "master_sha256": record["master_sha256"],
                    "chain_receipt_sha256": record["chain_receipt_sha256"], "written_utc": record["written_utc"]})
    cat.write_text(json.dumps(entries, indent=1), encoding="utf-8")


def _flat(d, prefix=""):
    out = {}
    for k, v in (d or {}).items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(_flat(v, key + "."))
        else:
            out[key] = v
    return out


def diff(slug, a, b):
    """Compare generations a and b of a title."""
    from .audio import load
    from .transcribe import si_sdr
    root = library() / slug
    ra = json.loads((root / f"gen-{a:03d}" / "edition.json").read_text(encoding="utf-8"))
    rb = json.loads((root / f"gen-{b:03d}" / "edition.json").read_text(encoding="utf-8"))
    sa, sb = _flat(ra.get("settings")), _flat(rb.get("settings"))
    changed = {k: [sa.get(k), sb.get(k)] for k in sorted(set(sa) | set(sb)) if sa.get(k) != sb.get(k)}
    ya, fs = load(root / f"gen-{a:03d}" / "master.flac")
    yb, _ = load(root / f"gen-{b:03d}" / "master.flac")
    la, lb = ra["loudness_after"], rb["loudness_after"]
    spa, spb = np.array(ra["spectrum_after"]["level_db"]), np.array(rb["spectrum_after"]["level_db"])
    return {"slug": slug, "a": a, "b": b, "settings_changed": changed,
            "loudness_delta": {k: (round(lb[k] - la[k], 2) if isinstance(la.get(k), (int, float)) and isinstance(lb.get(k), (int, float)) else None) for k in la},
            "spectrum_delta_db_rms": round(float(np.sqrt(np.mean((spb - spa) ** 2))), 2),
            "si_sdr_b_vs_a_db": round(si_sdr(ya, yb), 2),
            "provenance_a": ra["provenance_summary"], "provenance_b": rb["provenance_summary"]}
