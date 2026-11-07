# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One command: decode, read the condition, restore, split, layer, refine, resynthesize or remix, master, record.

Nothing is dropped on the way: the remix is the sum of every layer plus the split's residual (the mix minus the
sum of the stems), so with unit gains and no resynthesis the remix equals the restored input up to rounding.
Each stage writes a receipt; the chain receipt hashes them together with the input, the models and the output.
"""
import json
import time
from pathlib import Path

import numpy as np

from . import audio, condition, edition, layers, master, provenance, receipts as RC, refine, resynth, split
from . import transcribe as TR
from .loudness import measure
from .resample import resample
from .restore import repair, spectral


def _restore(y, fs, cond, pmap, opts, log):
    """Automatic restoration chosen from the condition report; every action is logged and mapped."""
    if cond["dropouts"]:
        short = np.zeros(y.shape[1], bool)
        for t0, t1 in cond["dropouts"]:
            a, b = int(t0 * fs), int(t1 * fs)
            if b - a <= 2048:
                short[a:b] = True
            else:
                y, reg, info = repair.fill_long_gap(y, fs, a, b)
                pmap.add_regions(reg, "long-gap")
                log.append({"stage": "long-gap", "t0": t0, "t1": t1, **info})
        if short.any():
            y, reg = repair.fill_gaps(y, fs, mask=short)
            pmap.add_regions(reg, "short-gap")
            log.append({"stage": "short-gap", "regions": len(reg)})
    if cond["clipped_share"] > 1e-4:
        y, reg = repair.declip(y, fs)
        pmap.add_regions(reg, "declip")
        log.append({"stage": "declip", "regions": len(reg)})
    if cond["clicks_per_min"] > 30:
        y, reg = repair.declick(y, fs)
        pmap.add_regions(reg, "declick")
        log.append({"stage": "declick", "regions": len(reg)})
    y2, reg, info = spectral.dehum(y, fs)
    if info.get("hum_hz"):
        y = y2
        pmap.add_regions(reg, "dehum", 0, 1000)
        log.append({"stage": "dehum", **info})
    if cond["lossy_signature"] and opts.get("codec", True):
        y, reg, info = spectral.decodec(y, fs)
        pmap.add_regions(reg, "decodec", 4000)
        log.append({"stage": "decodec", **info})
    if cond["lossy_signature"] and cond["cutoff_hz"] < 19000 and opts.get("bandwidth", True):
        y, reg, info = spectral.extend_bandwidth(y, fs, cond["cutoff_hz"])
        pmap.add_regions(reg, "bandwidth", cond["cutoff_hz"])
        log.append({"stage": "bandwidth", **info})
    if opts.get("wow"):
        y, reg, info = spectral.dewow(y, fs)
        pmap.add_regions(reg, "dewow")
        log.append({"stage": "dewow", **info})
    if opts.get("denoise"):
        y, _ = refine.denoise(y, fs)
        pmap.mark(0, y.shape[1] / fs, "restored", 0.7, "denoise")
        log.append({"stage": "denoise"})
    return y


def run(path, slug, preset="streaming", reference=None, resynth_layers=(), gains=None, device=None,
        restore_opts=None, debleed=False, seed=0, write_library=True, note="", stems=4):
    t_all = time.perf_counter()
    times, receipts, log = {}, [], []
    t = time.perf_counter()
    y, fs, dec = audio.decode(path)
    if fs < 44100:
        y, fs = resample(y, fs, 44100), 44100
    in_sha = RC.sha256_file(path)
    cond = condition.report(y, fs, dec)
    times["decode+condition"] = time.perf_counter() - t
    pmap = provenance.Map(y.shape[1] / fs)

    t = time.perf_counter()
    y = _restore(y, fs, cond, pmap, restore_opts or {}, log)
    times["restore"] = time.perf_counter() - t

    t = time.perf_counter()
    stems_out, rec = split.separate(y, fs, device, stems=stems)
    receipts.append(rec)
    residual = y - sum(stems_out.values())
    if debleed:
        stems_out = refine.debleed(stems_out)
    times["split"] = time.perf_counter() - t

    t = time.perf_counter()
    lay = layers.decompose(stems_out, fs, y)
    times["layers"] = time.perf_counter() - t

    t = time.perf_counter()
    gains = gains or {}
    remix = residual.copy()
    resynth_info = {}
    for sname, ls in lay.items():
        for lname, L in ls.items():
            key = f"{sname}.{lname}"
            a = L["audio"]
            if key in resynth_layers:
                notes = TR.notes(a, fs)
                prof = resynth.profile(a, fs, notes)
                if prof:
                    mono, inst = resynth.physical_model(notes, prof, fs, a.shape[1], seed)
                    g = np.sqrt(np.mean(a ** 2) / (np.mean(mono ** 2) + 1e-20))
                    a = np.stack([mono * g] * a.shape[0])
                    pmap.mark(0, a.shape[1] / fs, "resynthesized", 0.3, f"resynth {key} ({inst})")
                    resynth_info[key] = {"instrument": inst, "notes": len(notes)}
            remix += a * 10 ** (gains.get(key, 0.0) / 20)
    times["remix"] = time.perf_counter() - t

    t = time.perf_counter()
    if reference:
        ref, rfs = audio.load(reference)
        settings = master.reference_settings(remix, resample(ref, rfs, fs) if rfs != fs else ref, fs)
    else:
        settings = dict(master.PRESETS[preset])
    from .dynamics import peak_envelope
    before = measure(remix, fs, peak_envelope(remix))
    out, pcm, mrep = master.run(remix, fs, settings, seed=seed, before=before)
    times["master"] = time.perf_counter() - t
    total = time.perf_counter() - t_all
    seconds = y.shape[1] / fs

    result = {"fs": fs, "seconds": seconds, "times_s": {k: round(v, 3) for k, v in times.items()},
              "total_s": round(total, 3), "realtime_factor": round(seconds / total, 2), "condition": cond,
              "restoration": log, "roles": {s: {k: v["role"] for k, v in ls.items()} for s, ls in lay.items()},
              "layer_features": {s: {k: v["features"] for k, v in ls.items()} for s, ls in lay.items()},
              "resynth": resynth_info, "master": mrep, "provenance_summary": pmap.summary()}
    chain_rec = RC.make("chain", {"file": in_sha}, {"preset": preset, "reference": bool(reference),
                                                     "resynth_layers": list(resynth_layers), "gains": gains,
                                                     "debleed": debleed, "restore_opts": restore_opts or {}, "seed": seed,
                                                     "stems": stems},
                        {"master_pcm": RC.sha256_array(out)}, models=receipts[0]["models"] | {"ffmpeg": dec.get("ffmpeg_sha256")},
                        extra={"stage_receipts": [r["receipt_sha256"] for r in receipts]})
    result["chain_receipt"] = chain_rec
    if write_library:
        g, gdir = edition.next_generation(slug)
        subtype = "PCM_16" if settings.get("bits", 24) == 16 else "PCM_24"
        master_sha = audio.save(gdir / "master.flac", out, fs, subtype)
        (gdir / "provenance.json").write_text(json.dumps(pmap.to_json()), encoding="utf-8")
        provenance.plate(pmap, gdir / "provenance.png", title=f"{slug} gen {g}: provenance")
        RC.write(gdir / "receipts.json", {"stages": receipts, "chain": chain_rec})
        rec_e = {"slug": slug, "generation": g, "source_file_sha256": in_sha, "source_condition": cond,
                 "settings": master._public(settings) | {"resynth_layers": list(resynth_layers), "gains": gains},
                 "models": chain_rec["models"], "restoration": log, "provenance_summary": pmap.summary(),
                 "loudness_before": before, "loudness_after": mrep["after"],
                 "spectrum_before": edition.spectrum_summary(y, fs), "spectrum_after": edition.spectrum_summary(out, fs),
                 "roles": result["roles"], "master_sha256": master_sha, "chain_receipt_sha256": chain_rec["receipt_sha256"],
                 "timing": result["times_s"], "realtime_factor": result["realtime_factor"],
                 "note": note or _note(cond, log, pmap), "written_utc": chain_rec["written_utc"]}
        edition.write(slug, gdir, rec_e)
        result["edition_dir"] = str(gdir)
    return result


def _note(cond, log, pmap):
    s = pmap.summary()
    did = ", ".join(e["stage"] for e in log) or "no restoration"
    return (f"Source: {cond['probe'].get('codec')} at {cond['probe'].get('bitrate_kbps')} kb/s, cutoff "
            f"{cond['cutoff_hz']:.0f} Hz. Applied: {did}. Original {s['original']:.0%}, restored {s['restored']:.0%}, "
            f"inferred {s['inferred']:.0%}, resynthesized {s['resynthesized']:.0%} of the time-frequency map; inferred and "
            f"resynthesized regions were made by the tool, not recovered.")
