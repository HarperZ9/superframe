# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Export the law table's signature embedding for the ndim point-cloud mode.

    python -I data/export_laws.py

Reads the 38-feature signatures through feature_matrix() in
spectrum.py in the private law table folder, named by LAW_TABLE (read only), centres them, and keeps the first
8 principal components. Writes data/laws.json. The page says what the 8-D view keeps: the variance share
printed here, and nothing about the other 30 components.
"""
import os
import json
import sys
from pathlib import Path

import numpy as np

LAW = Path(os.environ["LAW_TABLE"])  # the private law table folder
sys.path.insert(0, str(LAW))
from spectrum import feature_matrix  # noqa: E402

K = 8


def main():
    sig, laws, forms, names, X = feature_matrix()
    Xc = X - X.mean(0)
    U, S, Vt = np.linalg.svd(Xc, full_matrices=False)
    Z = Xc @ Vt[:K].T
    Z /= np.abs(Z).max()
    var = (S ** 2) / (S ** 2).sum()
    top = [[names[i] for i in np.argsort(-np.abs(Vt[k]))[:3]] for k in range(K)]
    out = {"source": str(LAW / "SIGNATURES.json") + " + ADDED.json via spectrum.feature_matrix",
           "n_laws": len(laws), "n_features": len(names), "k": K,
           "variance_share": [round(float(v), 4) for v in var[:K]],
           "variance_kept": round(float(var[:K].sum()), 4),
           "axis_top_features": top,
           "domains": sorted({s["domain"] for s in laws}),
           "laws": [[s["name"], s["domain"], s.get("primary") or max(s["forms"], key=s["forms"].get)] + [round(float(x), 4) for x in z]
                    for s, z in zip(laws, Z)]}
    p = Path(__file__).resolve().parent / "laws.json"
    p.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print("wrote", p, p.stat().st_size, "variance kept", out["variance_kept"])


if __name__ == "__main__":
    main()
