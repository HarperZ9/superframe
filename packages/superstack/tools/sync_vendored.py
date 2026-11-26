# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Check or synchronize vendored superstack copies against packages/superstack/.

Usage:
    python packages/superstack/tools/sync_vendored.py --check
    python packages/superstack/tools/sync_vendored.py --sync
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

SUPERSTACK_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SUPERSTACK_DIR.parents[1]

VENDORED_TARGETS: tuple[tuple[str, str], ...] = (
    ("superstack.mjs", "substrate/lib/vendor/superstack.mjs"),
    ("superstack.mjs", "games/low-water/game/engine/audio/vendor/superstack.mjs"),
    ("superstack.py", "packages/daw/daw/superstack.py"),
)


def _sha256_lf(path: Path) -> str:
    data = path.read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def _load_pins() -> dict[str, str]:
    pins: dict[str, str] = {}
    for line in (SUPERSTACK_DIR / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) >= 2:
            pins[parts[1]] = parts[0]
    return pins


def check_or_sync(sync: bool = False) -> tuple[bool, list[str]]:
    pins = _load_pins()
    issues: list[str] = []
    for canonical_name, rel_target in VENDORED_TARGETS:
        src = SUPERSTACK_DIR / canonical_name
        dst = REPO_ROOT / rel_target
        if not dst.is_file():
            issues.append(f"missing vendored file: {rel_target}")
            continue
        src_bytes = src.read_bytes().replace(b"\r\n", b"\n")
        src_sha = hashlib.sha256(src_bytes).hexdigest()
        pin = pins.get(canonical_name)
        if pin and src_sha != pin:
            issues.append(f"canonical {canonical_name} does not match SHA256SUMS ({src_sha} != {pin})")
        dst_raw = dst.read_bytes()
        dst_lf = dst_raw.replace(b"\r\n", b"\n")
        dst_sha = hashlib.sha256(dst_lf).hexdigest()
        if dst_sha != src_sha or (canonical_name.endswith(".mjs") and b"\r\n" in dst_raw):
            if sync:
                dst.write_bytes(src_bytes)
            else:
                reason = "CRLF line endings" if dst_sha == src_sha else f"drift ({dst_sha} != {src_sha})"
                issues.append(f"{rel_target}: {reason}")
    return len(issues) == 0, issues


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Verify or sync vendored superstack files.")
    ap.add_argument("--sync", action="store_true", help="Copy canonical LF bytes to any drifted target.")
    ap.add_argument("--check", action="store_true", help="Verify zero drift (default).")
    args = ap.parse_args(argv)
    ok, issues = check_or_sync(sync=args.sync)
    if args.sync:
        ok, issues = check_or_sync(sync=False)
    if not ok:
        for msg in issues:
            print(f"FAIL: {msg}", file=sys.stderr)
        return 1
    print(f"sync_vendored: {len(VENDORED_TARGETS)}/{len(VENDORED_TARGETS)} vendored copies match packages/superstack/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
