# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Evaluate a refractiveindex.info YAML record on a wavelength grid.

Implements tabulated n, k, nk and dispersion formulas 1 to 9 as defined in the
database's "Dispersion formulas" document (2014-06-29). Wavelengths in um.
Outside the source range: formulas are evaluated (marked extrapolated);
tabulated values are held at the nearest edge (marked extrapolated).
"""
import math

import yaml


def _interp(xs, ys, x):
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    lo, hi = 0, len(xs) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if xs[mid] <= x:
            lo = mid
        else:
            hi = mid
    t = (x - xs[lo]) / (xs[hi] - xs[lo])
    return ys[lo] + t * (ys[hi] - ys[lo])


def _formula(kind, c, lam):
    c = list(c) + [0.0] * (17 - len(c))
    C = [None] + c  # 1-based like the document
    l2 = lam * lam
    if kind == 1:
        s = 1 + C[1]
        for i in range(2, 17, 2):
            if C[i]:
                s += C[i] * l2 / (l2 - C[i + 1] ** 2)
        return math.sqrt(s)
    if kind == 2:
        s = 1 + C[1]
        for i in range(2, 17, 2):
            if C[i]:
                s += C[i] * l2 / (l2 - C[i + 1])
        return math.sqrt(s)
    if kind == 3:
        s = C[1]
        for i in range(2, 17, 2):
            if C[i]:
                s += C[i] * lam ** C[i + 1]
        return math.sqrt(s)
    if kind == 4:
        s = C[1]
        if C[2]:
            s += C[2] * lam ** C[3] / (l2 - C[4] ** C[5])
        if C[6]:
            s += C[6] * lam ** C[7] / (l2 - C[8] ** C[9])
        for i in range(10, 17, 2):
            if C[i]:
                s += C[i] * lam ** C[i + 1]
        return math.sqrt(s)
    if kind == 5:
        s = C[1]
        for i in range(2, 12, 2):
            if C[i]:
                s += C[i] * lam ** C[i + 1]
        return s
    if kind == 6:
        s = 1 + C[1]
        for i in range(2, 12, 2):
            if C[i]:
                s += C[i] / (C[i + 1] - lam ** -2)
        return s
    if kind == 7:
        L = 1.0 / (l2 - 0.028)
        return C[1] + C[2] * L + C[3] * L * L + C[4] * l2 + C[5] * l2 ** 2 + C[6] * l2 ** 3
    if kind == 8:
        r = C[1] + C[2] * l2 / (l2 - C[3]) + C[4] * l2
        return math.sqrt((1 + 2 * r) / (1 - r))
    if kind == 9:
        return math.sqrt(C[1] + C[2] / (l2 - C[3]) + C[4] * (lam - C[5]) / ((lam - C[5]) ** 2 + C[6]))
    raise ValueError(f"unknown formula {kind}")


def evaluate(text, grid_nm):
    """Return dict with n, k lists (None where absent), extrapolation flags and refs."""
    doc = yaml.safe_load(text)
    lam = [g / 1000.0 for g in grid_nm]
    n = [None] * len(lam)
    k = [None] * len(lam)
    n_ext = [False] * len(lam)
    k_ext = [False] * len(lam)
    for block in doc.get("DATA", []):
        t = block["type"]
        if t.startswith("tabulated"):
            rows = [[float(v) for v in line.split()] for line in block["data"].strip().splitlines() if line.strip()]
            xs = [r[0] for r in rows]
            cols = t.split()[1]
            for i, x in enumerate(lam):
                ext = x < xs[0] or x > xs[-1]
                if cols in ("n", "nk"):
                    n[i] = _interp(xs, [r[1] for r in rows], x)
                    n_ext[i] = ext
                if cols == "k":
                    k[i] = _interp(xs, [r[1] for r in rows], x)
                    k_ext[i] = ext
                if cols == "nk":
                    k[i] = _interp(xs, [r[2] for r in rows], x)
                    k_ext[i] = ext
        elif t.startswith("formula"):
            kind = int(t.split()[1])
            lo, hi = (float(v) for v in str(block["wavelength_range"]).split())
            coeff = [float(v) for v in str(block["coefficients"]).split()]
            for i, x in enumerate(lam):
                try:
                    n[i] = _formula(kind, coeff, x)
                except (ValueError, ZeroDivisionError):
                    n[i] = None
                n_ext[i] = x < lo or x > hi
    return {
        "n": n, "k": k, "n_extrapolated": n_ext, "k_extrapolated": k_ext,
        "references": str(doc.get("REFERENCES", "")).strip(),
        "comments": str(doc.get("COMMENTS", "")).strip(),
        "conditions": doc.get("CONDITIONS"),
    }
