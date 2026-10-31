# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""cleanroom CLI. Run it as `cleanroom <command>` through cleanroom.cmd, or
`python -I -B packages/cleanroom/cleanroom_cli.py <command>` from the superframe root."""
import argparse
import collections
import json
import os
import sys

from . import blend, decompose, difference, gate, lineage, release, sources
from .config import Layout
from .vault import LICENCES, Vault, sha256_file

DAYLIGHT_ENV = "CLEANROOM_DAYLIGHT"  # default folder of CMMNS saves for `ingest --daylight`


def _print(obj, as_json=True):
    print(json.dumps(obj, indent=1, ensure_ascii=False, default=str))


def cmd_ingest(a):
    v = Vault(a.vault)
    counts = collections.Counter()
    shas = []
    if a.daylight == "":
        a.daylight = os.environ.get(DAYLIGHT_ENV) or sys.exit(f"ingest --daylight needs DIR or {DAYLIGHT_ENV}")
    if a.daylight:
        saves = sources.daylight_saves(a.daylight)
        if a.newest:
            saves = saves[:a.newest]
        for path, meta in saves:
            for kind, payload, m in sources.sidecar_items(path, meta):
                rec, status = (v.ingest_file(payload, m) if kind == "file" else v.ingest_bytes(payload, m))
                counts[status.split(":")[0]] += 1
                if rec:
                    shas.append(rec["sha256"])
                elif a.verbose:
                    print(f"  {status}: {payload if kind == 'file' else path}", file=sys.stderr)
        counts["sidecars"] = len(saves)
    for corpus in a.gather or []:
        for kind, payload, m in sources.gather_items(corpus):
            rec, status = v.ingest_file(payload, m)
            counts[status.split(":")[0]] += 1
            if rec:
                shas.append(rec["sha256"])
    if a.shas_out:
        with open(a.shas_out, "w", encoding="utf-8") as f:
            f.write("\n".join(dict.fromkeys(shas)))
    _print(dict(counts))


def cmd_decompose(a):
    shas = None
    if a.shas_file:
        with open(a.shas_file, encoding="utf-8") as f:
            shas = [l.strip() for l in f if l.strip()]
    done, failed = decompose.decompose_all(a.vault, shas or a.sha or None, force=a.force)
    _print({"specs_written": done, "failed": failed})


def _find_spec(root, key):
    L = Layout(root)
    for n in sorted(os.listdir(L.specs)):
        sid = n[:-5]
        if sid == key or sid.startswith(key) or sid.startswith("spec-" + key[:16]):
            return decompose.load_spec(root, sid)
    raise SystemExit(f"no spec matches {key}")


def cmd_spec(a):
    _print(_find_spec(a.vault, a.id))


def cmd_lineage(a):
    _print(lineage.report(a.output, a.vault))


def cmd_report(a):
    _print(difference.run(a.file, a.vault))


def cmd_gate(a):
    d = gate.check(a.file, a.vault, route=a.route, strict=a.strict)
    _print(d)
    sys.exit(0 if d["allowed"] else 2)


def cmd_release(a):
    rep = difference.run(a.file, a.vault)
    if not rep["passes_all"] and not a.record_failing:
        _print({"recorded": False, "reason": "difference report failed; fix the output or pass --record-failing",
                "failed": rep["failed"], "honesty": rep["honesty"]})
        sys.exit(2)
    n = release.record(a.vault, sha256_file(a.file), rep["report_sha256"], a.by, a.why)
    _print({"recorded": True, "note": n, "report": rep["stored_at"], "honesty": rep["honesty"]})


def cmd_blend(a):
    with open(a.recipe, encoding="utf-8") as f:
        R = json.load(f)
    out, lin = blend.run(R, a.vault, recipe_dir=os.path.dirname(os.path.abspath(a.recipe)))
    _print({"output": out, "label": lin["label"], "default_route": lin["default_route"], "blend": lin["blend"]})


def cmd_tag(a):
    _print(Vault(a.vault).set_licence(a.sha, a.licence, a.basis))


def cmd_stats(a):
    v = Vault(a.vault)
    recs = list(v.records())
    if a.shas_file:
        with open(a.shas_file, encoding="utf-8") as f:
            keep = {l.strip() for l in f if l.strip()}
        recs = [r for r in recs if r["sha256"] in keep]
    _print({"items": len(recs), "by_licence": dict(collections.Counter(r["licence"] for r in recs)),
            "by_media_type": dict(collections.Counter(r["media_type"] for r in recs)),
            "bytes": sum(r["size"] for r in recs)})


def main(argv=None):
    p = argparse.ArgumentParser(prog="cleanroom")
    p.add_argument("--vault", default=None, help="vault root (default: the CLEANROOM_VAULT environment variable; required)")
    s = p.add_subparsers(dest="cmd", required=True)
    q = s.add_parser("ingest")
    q.add_argument("--daylight", nargs="?", const="", help=f"CMMNS saves folder (default {DAYLIGHT_ENV})")
    q.add_argument("--gather", action="append", help="a Gather corpus directory (catalog.jsonl)")
    q.add_argument("--newest", type=int, default=0, help="only the newest N sidecars")
    q.add_argument("--shas-out")
    q.add_argument("-v", "--verbose", action="store_true")
    q.set_defaults(f=cmd_ingest)
    q = s.add_parser("decompose")
    q.add_argument("sha", nargs="*")
    q.add_argument("--shas-file")
    q.add_argument("--force", action="store_true")
    q.set_defaults(f=cmd_decompose)
    q = s.add_parser("spec")
    q.add_argument("id")
    q.set_defaults(f=cmd_spec)
    q = s.add_parser("lineage")
    q.add_argument("output")
    q.set_defaults(f=cmd_lineage)
    q = s.add_parser("report")
    q.add_argument("file")
    q.set_defaults(f=cmd_report)
    q = s.add_parser("gate")
    q.add_argument("file")
    q.add_argument("--route", choices=("public", "internal"), default="public")
    q.add_argument("--strict", action="store_true", help="refuse files with no lineage record")
    q.set_defaults(f=cmd_gate)
    q = s.add_parser("release")
    q.add_argument("file")
    q.add_argument("--by", required=True)
    q.add_argument("--why", required=True)
    q.add_argument("--record-failing", action="store_true")
    q.set_defaults(f=cmd_release)
    q = s.add_parser("blend")
    q.add_argument("recipe")
    q.set_defaults(f=cmd_blend)
    q = s.add_parser("tag")
    q.add_argument("sha")
    q.add_argument("licence", choices=LICENCES)
    q.add_argument("--basis", required=True)
    q.set_defaults(f=cmd_tag)
    q = s.add_parser("stats")
    q.add_argument("--shas-file")
    q.set_defaults(f=cmd_stats)
    a = p.parse_args(argv)
    a.f(a)


if __name__ == "__main__":
    main()
