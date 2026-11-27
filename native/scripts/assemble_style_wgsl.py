#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Deterministic assembler and parity checker for native/src/renderer/gpu/shaders/style.wgsl.

Modular WGSL source files live under native/src/renderer/gpu/shaders/style/*.wgsl
and assemble byte-for-byte into native/src/renderer/gpu/shaders/style.wgsl so
downstream WGSL->HLSL generation (scripts/wgsl_to_hlsl.py) and WebGPU builds
experience zero render drift.

Usage:
    python native/scripts/assemble_style_wgsl.py --check
    python native/scripts/assemble_style_wgsl.py
    python native/scripts/assemble_style_wgsl.py --split
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

NATIVE_ROOT = Path(__file__).resolve().parents[1]
SHADERS_DIR = NATIVE_ROOT / "src" / "renderer" / "gpu" / "shaders"
STYLE_WGSL = SHADERS_DIR / "style.wgsl"
PARTS_DIR = SHADERS_DIR / "style"

# Exact ordered split boundaries by first //@pass marker of each module.
PART_BOUNDARIES: tuple[tuple[str, str | None], ...] = (
    ("00_params_and_color_space.wgsl", None),
    ("01_ditherlight_and_post.wgsl", "//@pass style_ditherlight"),
    ("02_hatch_and_dither.wgsl", "//@pass style_hatch"),
    ("03_adjacency_crt_vhs.wgsl", "//@pass style_adj_prep"),
    ("04_fibre_film_lens.wgsl", "//@pass style_fibre_field"),
    ("05_sag_cari_pixel.wgsl", "//@pass style_sag_current"),
    ("06_brush_and_canvas.wgsl", "//@pass style_paint_prep"),
    ("07_crt_physical.wgsl", "//@pass style_crtp_encode"),
)


def _read_lf(path: Path) -> bytes:
    return path.read_bytes().replace(b"\r\n", b"\n")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def split_style_wgsl(source: Path = STYLE_WGSL, out_dir: Path = PARTS_DIR) -> list[Path]:
    """Split style.wgsl into ordered modular WGSL files along exact //@pass boundaries."""
    text = _read_lf(source).decode("utf-8")
    lines = text.splitlines(keepends=True)
    starts: list[int] = [0]
    for _, marker in PART_BOUNDARIES[1:]:
        idx = next((i for i, ln in enumerate(lines) if ln.strip() == marker), None)
        if idx is None:
            raise ValueError(f"boundary marker not found in {source}: {marker}")
        starts.append(idx)
    starts.append(len(lines))
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for (filename, _), lo, hi in zip(PART_BOUNDARIES, starts, starts[1:]):
        part_path = out_dir / filename
        part_path.write_bytes("".join(lines[lo:hi]).encode("utf-8"))
        written.append(part_path)
    return written


def assemble_parts(parts_dir: Path = PARTS_DIR) -> bytes:
    """Concatenate ordered modular WGSL parts with LF line endings."""
    expected_names = [name for name, _ in PART_BOUNDARIES]
    actual_names = sorted(p.name for p in parts_dir.glob("*.wgsl"))
    if actual_names != expected_names:
        raise ValueError(f"style part list mismatch: expected {expected_names}, found {actual_names}")
    return b"".join(_read_lf(parts_dir / name) for name in expected_names)


def check_parity(source: Path = STYLE_WGSL, parts_dir: Path = PARTS_DIR) -> tuple[bool, str]:
    assembled = assemble_parts(parts_dir)
    current = _read_lf(source)
    if assembled != current:
        return (
            False,
            f"style.wgsl drift: assembled={_sha256(assembled)} current={_sha256(current)}",
        )
    return True, f"style.wgsl byte-exact match ({len(PART_BOUNDARIES)} parts, sha256={_sha256(assembled)})"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Assemble or verify modular style.wgsl shader parts.")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Verify assembled parts equal style.wgsl byte-for-byte.")
    mode.add_argument("--split", action="store_true", help="Split style.wgsl into modular parts under shaders/style/.")
    args = ap.parse_args(argv)
    if args.split:
        written = split_style_wgsl()
        ok, msg = check_parity()
        if not ok:
            print(f"FAIL: {msg}", file=sys.stderr)
            return 1
        print(f"split {len(written)} parts; {msg}")
        return 0
    if args.check:
        ok, msg = check_parity()
        print(msg if ok else f"FAIL: {msg}", file=sys.stdout if ok else sys.stderr)
        return 0 if ok else 1
    assembled = assemble_parts()
    STYLE_WGSL.write_bytes(assembled)
    print(f"assembled {STYLE_WGSL} ({len(assembled)} bytes, sha256={_sha256(assembled)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
