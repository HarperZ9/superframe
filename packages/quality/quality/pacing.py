# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Frame-pacing recorder and analyser.

Two sources:
1. Browser: pacing.js (injected with Playwright's add_init_script, or pasted in
   the console) records requestAnimationFrame timestamps, the time spent in each
   rAF callback, layout-shift entries and long animation frames. record_page()
   drives it from Python and returns the raw record; analyse_intervals() scores it.
2. Video: cadence(path) reads every frame of a clip and reports how often the
   picture really changes (unique-frame gaps), which separates content on ones,
   twos or a 24 fps boil from the container frame rate.

Scores (QUALITY-SPEC.md, M1 and M6):
- interval p50 / p95 / p99 in ms, jitter = SD of intervals in ms,
- dropped = sum over intervals of round(dt / period) - 1,
- long_share = share of intervals above 1.5 periods,
- cb_p95_ms = 95th percentile rAF callback time (budget 8.3 ms at 120 Hz, 16.7 at 60),
- cls = summed layout-shift score without recent input.

Usage: python pacing.py video CLIP.mp4   |   python pacing.py json RECORD.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

JS = (Path(__file__).with_name("pacing.js")).read_text(encoding="utf-8")


def analyse_intervals(ts_ms, period_ms=None) -> dict:
    t = np.asarray(ts_ms, dtype=float)
    if len(t) < 3:
        return {"frames": int(len(t)), "error": "too few frames"}
    dt = np.diff(t)
    if period_ms is None:
        med = float(np.median(dt))
        # snap to the nearest common refresh period so a slow page is not graded against itself
        period_ms = min((1000 / hz for hz in (240, 165, 144, 120, 90, 75, 60, 50, 30)), key=lambda p: abs(p - med))
    k = np.maximum(np.round(dt / period_ms), 1)
    return {
        "frames": int(len(t)),
        "period_ms": round(period_ms, 3),
        "fps": round(1000 * (len(dt)) / (t[-1] - t[0]), 2),
        "p50_ms": round(float(np.percentile(dt, 50)), 3),
        "p95_ms": round(float(np.percentile(dt, 95)), 3),
        "p99_ms": round(float(np.percentile(dt, 99)), 3),
        "jitter_ms": round(float(dt.std()), 3),
        "dropped": int((k - 1).sum()),
        "long_share": round(float((dt > 1.5 * period_ms).mean()), 4),
    }


def analyse_record(rec: dict, period_ms=None) -> dict:
    out = analyse_intervals(rec.get("ts", []), period_ms)
    cb = np.asarray(rec.get("cb", []), dtype=float)
    out["cb_p50_ms"] = round(float(np.percentile(cb, 50)), 3) if len(cb) else 0.0
    out["cb_p95_ms"] = round(float(np.percentile(cb, 95)), 3) if len(cb) else 0.0
    out["cb_max_ms"] = round(float(cb.max()), 3) if len(cb) else 0.0
    out["cls"] = round(float(rec.get("cls", 0.0)), 4)
    out["long_frames"] = len(rec.get("loaf", []))
    out["budget_120_ok"] = out["cb_p95_ms"] <= 8.3
    out["budget_60_ok"] = out["cb_p95_ms"] <= 16.7
    return out


def record_page(page, ms=3000) -> dict:
    """page: a Playwright sync page whose context had add_init_script(JS) before navigation."""
    return page.evaluate(f"window.__pacing.collect({int(ms)})")


def cadence(path: str, proxy=160, thresh=0.6) -> dict:
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    prev, gaps, run, n, diffs = None, [], 0, 0, []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        n += 1
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        g = cv2.resize(g, (proxy, max(1, int(proxy * g.shape[0] / g.shape[1]))), interpolation=cv2.INTER_AREA).astype(float)
        if prev is not None:
            d = float(np.abs(g - prev).mean())
            diffs.append(d)
            run += 1
            if d > thresh:
                gaps.append(run)
                run = 0
        prev = g
    cap.release()
    if not gaps:
        return {"file": str(path), "fps": fps, "frames": n, "unique_rate": 0.0, "gap_hist": {}}
    hist = {}
    for gp in gaps:
        hist[str(gp)] = hist.get(str(gp), 0) + 1
    mode = int(max(hist.items(), key=lambda kv: kv[1])[0])
    return {
        "file": str(path),
        "fps": round(fps, 3),
        "frames": n,
        "unique_frames": len(gaps) + 1,
        "unique_rate": round(fps * (len(gaps) + 1) / n, 2) if n else 0.0,
        "gap_mode": mode,
        "gap_hist": dict(sorted(hist.items(), key=lambda kv: int(kv[0]))),
        "held_share": round(float(np.mean(np.asarray(diffs) <= thresh)), 3),
        "diff_median": round(float(np.median(diffs)), 3),
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("video")
    v.add_argument("clip")
    v.add_argument("--thresh", type=float, default=0.6)
    j = sub.add_parser("json")
    j.add_argument("record")
    a = ap.parse_args(argv)
    if a.cmd == "video":
        print(json.dumps(cadence(a.clip, thresh=a.thresh), indent=1))
    else:
        print(json.dumps(analyse_record(json.loads(Path(a.record).read_text())), indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
