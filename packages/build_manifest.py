# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Rewrite the packages/ rows of MANIFEST.json from what git tracks or would track under packages/.

    python packages/build_manifest.py          write the rows
    python packages/build_manifest.py --check  exit 1 if a row is stale or missing

The source of each row is its own repo path: packages/ is edited here and nowhere else.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "MANIFEST.json"


def rows():
    out = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "packages"],
                         cwd=ROOT, capture_output=True, check=True).stdout.decode("utf-8")
    result = []
    for rel in sorted(p for p in out.split("\0") if p):
        path = ROOT / rel
        if not path.is_file():
            continue
        data = path.read_bytes()
        if b"\0" not in data:
            data = data.replace(b"\r\n", b"\n")  # git stores text with LF; a Windows checkout must agree with CI
        result.append({"path": rel, "source": "repo", "bytes": len(data), "sourceSha256": hashlib.sha256(data).hexdigest()})
    return result


def main():
    doc = json.loads(MANIFEST.read_text(encoding="utf-8"))
    others = [f for f in doc["files"] if not f["path"].startswith("packages/")]
    want = rows()
    if "--check" in sys.argv:
        have = [f for f in doc["files"] if f["path"].startswith("packages/")]
        if have != want:
            print("MANIFEST.json is stale for packages/: run python packages/build_manifest.py")
            return 1
        print(f"manifest current: {len(want)} rows under packages/")
        return 0
    doc["files"] = others + want
    MANIFEST.write_text(json.dumps(doc, indent=1), encoding="utf-8", newline="")
    print(f"wrote {len(want)} rows under packages/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
