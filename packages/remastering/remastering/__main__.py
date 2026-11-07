# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""python -m remastering run FILE --slug S [--preset streaming|dynamic|archival] [--reference FILE]
                                  [--resynth stem.layer ...] [--stems 4|6] [--device cuda|cpu] [--debleed] [--wow] [--denoise]
   python -m remastering condition FILE
   python -m remastering loudness FILE
   python -m remastering diff SLUG A B"""
import argparse
import json

from . import audio, chain, condition, edition, loudness


def main(argv=None):
    ap = argparse.ArgumentParser(prog="remastering")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("file")
    r.add_argument("--slug", required=True)
    r.add_argument("--preset", default="streaming", choices=["streaming", "dynamic", "archival"])
    r.add_argument("--reference")
    r.add_argument("--resynth", nargs="*", default=[])
    r.add_argument("--stems", type=int, default=4, choices=[4, 6])
    r.add_argument("--device")
    r.add_argument("--debleed", action="store_true")
    r.add_argument("--wow", action="store_true")
    r.add_argument("--denoise", action="store_true")
    r.add_argument("--note", default="")
    c = sub.add_parser("condition")
    c.add_argument("file")
    lo = sub.add_parser("loudness")
    lo.add_argument("file")
    d = sub.add_parser("diff")
    d.add_argument("slug")
    d.add_argument("a", type=int)
    d.add_argument("b", type=int)
    a = ap.parse_args(argv)
    if a.cmd == "run":
        res = chain.run(a.file, a.slug, a.preset, a.reference, tuple(a.resynth), device=a.device, debleed=a.debleed,
                        restore_opts={"wow": a.wow, "denoise": a.denoise}, note=a.note,
                        stems=a.stems)
        res.pop("layer_features", None)
        print(json.dumps({k: res[k] for k in ("seconds", "times_s", "total_s", "realtime_factor", "provenance_summary",
                                              "edition_dir") if k in res} | {"after": res["master"]["after"]}, indent=1))
    elif a.cmd == "condition":
        y, fs, rep = audio.decode(a.file)
        print(json.dumps(condition.report(y, fs, rep), indent=1))
    elif a.cmd == "loudness":
        y, fs = audio.load(a.file)
        print(json.dumps(loudness.measure(y, fs), indent=1))
    else:
        print(json.dumps(edition.diff(a.slug, a.a, a.b), indent=1))


if __name__ == "__main__":
    main()
