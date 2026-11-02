# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Static code checks for QUALITY-SPEC.md items a screenshot cannot see.

python static_check.py FOLDER [--json]

Counts evidence in .js/.mjs/.css/.html source (vendor and node_modules skipped):
- dpr: devicePixelRatio read when sizing canvases (R1)
- dither: a dither step on output (R2)
- float_buffers: float or half-float render targets / Float32 accumulation (R2)
- p3: display-p3 colour space requested, or a color-gamut media query (R6)
- fixed_step: a fixed-timestep accumulator (M2), dt_clamp: a clamp on frame delta
- reduced_motion: prefers-reduced-motion honoured (M7)
- font_synthesis_none, optical_sizing, text_wrap_balance_or_pretty, kerning (T)
- export_png / export_hires: canvas export, and export at a scale above the screen (O1)
- seeded: an explicit seed parameter (S3)
- pixel_tests: tests that read pixels (getImageData, readPixels, SSIM, golden) (S5)
A hit is evidence of intent, not proof of correct use; the browser audit checks the result.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PATTERNS = {
    "dpr": r"devicePixelRatio",
    "dither": r"\bdither|\bbayer|\btpdf|blue-?noise",
    "float_buffers": r"RGBA16F|RGBA32F|HALF_FLOAT|EXT_color_buffer_float|Float32Array\(\s*\w+\s*\*\s*\w+\s*\*\s*4",
    "p3": r"display-p3|color-gamut",
    "fixed_step": r"\bacc(um|umulator)?\s*[-+]=|FIXED_?(DT|STEP)|fixedStep|while\s*\(\s*acc",
    "dt_clamp": r"Math\.min\(\s*(dt|delta|elapsed)|dt\s*=\s*Math\.min",
    "reduced_motion": r"prefers-reduced-motion",
    "font_synthesis_none": r"font-synthesis\s*:\s*none",
    "optical_sizing": r"font-optical-sizing|['\"]opsz['\"]",
    "text_wrap": r"text-wrap\s*:\s*(balance|pretty)",
    "kerning": r"font-kerning|font-feature-settings[^;]*kern",
    "export_png": r"toBlob\(|toDataURL\(|convertToBlob\(",
    "export_hires": r"export.{0,40}(scale|4k|3840|2160)|(scale|4k|3840).{0,40}export",
    "seeded": r"\bseed\b",
}
TEST_PIX = r"getImageData|readPixels|ssim|golden|toMatchImage|pixelmatch"
SKIP = ("node_modules", "vendor", ".ruff_cache", "_teardown", "_work", "archive")


def scan(folder: Path) -> dict:
    hits = {k: [] for k in PATTERNS}
    pix, files = [], 0
    for p in folder.rglob("*"):
        if p.suffix not in (".js", ".mjs", ".css", ".html") or any(s in p.parts for s in SKIP):
            continue
        files += 1
        try:
            t = p.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            print(f"static_check: cannot read {p}: {e}", file=sys.stderr)
            continue
        rel = str(p.relative_to(folder))
        for k, rx in PATTERNS.items():
            n = len(re.findall(rx, t, re.I))
            if n:
                hits[k].append((rel, n))
        if ("test" in p.name or "tests" in p.parts) and re.search(TEST_PIX, t, re.I):
            pix.append(rel)
    out = {k: {"files": len(v), "where": [f"{a}:{b}" for a, b in v[:6]]} for k, v in hits.items()}
    out["pixel_tests"] = {"files": len(pix), "where": pix[:6]}
    out["scanned"] = files
    return out


if __name__ == "__main__":
    r = scan(Path(sys.argv[1]))
    if "--json" in sys.argv:
        print(json.dumps(r, indent=1))
    else:
        for k, v in r.items():
            print(f"{k:22s} {v if k == 'scanned' else v['files']}  {'' if k == 'scanned' else ', '.join(v['where'][:3])}")
