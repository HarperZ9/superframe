# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Pick a refractiveindex.info page per material and download its YAML.

Run: python -I build/fetch_ri.py <catalog-nk.yml> <download_root> <out_manifest.json>
Each file lands in its own new folder. Nothing is executed from downloads. The manifest records
each file relative to the downloads folder (ri/<material>/<page>.yml), never an absolute path.
"""
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from picks import MATERIALS  # noqa: E402

RAW = "https://raw.githubusercontent.com/polyanskiy/refractiveindex.info-database/main/database/data/"
VIS = (0.38, 0.78)
RANGE = re.compile(r"([0-9.eE+-]+)\s*[–-]\s*([0-9.eE+-]+)\s*µm")


def page_index(catalog):
    idx = {}
    for shelf in catalog:
        if "SHELF" not in shelf:
            continue
        for book in shelf["content"]:
            if "BOOK" not in book:
                continue
            key = f"{shelf['SHELF']}/{book['BOOK']}"
            idx[key] = [p for p in book.get("content", []) if "PAGE" in p]
    return idx


def overlap(name):
    best = 0.0
    for a, b in RANGE.findall(name):
        try:
            lo, hi = float(a), float(b)
        except ValueError:
            continue
        best = max(best, max(0.0, min(hi, VIS[1]) - max(lo, VIS[0])) / (VIS[1] - VIS[0]))
    return best


def choose(pages, preferred):
    by_name = {p["PAGE"]: p for p in pages}
    forced = [n[1:] for n in preferred if n.startswith("!")]
    if forced:  # the physical state or phase matters more than coverage
        return by_name.get(forced[0])
    for name in preferred:
        p = by_name.get(name)
        if p and overlap(p["name"]) >= 0.999:
            return p
    full = [p for p in pages if overlap(p["name"]) >= 0.999 and "DFT" not in p["PAGE"]]
    if full:
        return full[0]
    for name in preferred:
        if name in by_name:
            return by_name[name]
    return max(pages, key=lambda p: overlap(p["name"])) if pages else None


def main(catalog_path, root, out):
    catalog = yaml.safe_load(open(catalog_path, encoding="utf-8"))
    idx = page_index(catalog)
    manifest = {}
    for mid, _name, _cls, ri, _pb, _wd in MATERIALS:
        if not ri:
            continue
        book, preferred = ri
        page = choose(idx.get(book, []), preferred)
        if page is None:
            print("NO BOOK", mid, book)
            continue
        folder = Path(root) / f"{mid}"
        dest = folder / Path(page["data"]).name
        url = RAW + urllib.parse.quote(page["data"])
        if dest.exists():  # resume: this folder was created empty by an earlier run
            blob = dest.read_bytes()
        else:
            folder.mkdir(parents=True, exist_ok=False)
            with urllib.request.urlopen(url, timeout=60) as r:
                blob = r.read()
            dest.write_bytes(blob)
        manifest[mid] = {
            "book": book, "page": page["PAGE"], "page_name": page["name"],
            "data_path": page["data"], "url": url,
            "web": f"https://refractiveindex.info/?shelf={book.split('/')[0]}&book={book.split('/')[1]}&page={page['PAGE']}",
            "file": f"ri/{mid}/{dest.name}", "sha256": hashlib.sha256(blob).hexdigest(),
            "visible_overlap_from_name": round(overlap(page["name"]), 3),
        }
        print(mid, book, page["PAGE"], manifest[mid]["visible_overlap_from_name"])
        time.sleep(0.2)
    Path(out).write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(*sys.argv[1:4])
