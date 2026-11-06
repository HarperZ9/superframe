# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Area functions of the 44 printed MRI vocal tracts (Dresden Vocal Tract Dataset), from their surface meshes.

Each closed inner surface (*-inner-surface-closed.stl, millimetres) is filled into 0.7 mm voxels by ray parity
along z. The geodesic distance of every voxel from the glottis (the voxels within 1 mm of the lowest point) is
found by Dijkstra on the 26-connected voxel graph, with edge lengths h, h sqrt(2) and h sqrt(3); the area at
distance s is the volume of the shell between s and s + 3 mm over 3 mm. A 6-connected graph measures the
city-block distance and stretched the schwa tract from 192 to 237 mm, which put its F1 at 109 Hz against a
measured 337 Hz; the 26-connected distance is within a few percent of Euclidean. Side cavities (the piriform
sinuses, the vallecula) fall into the shells at their distance and add to the area there, a known limit of
area functions from distance shells.

    MEASURED_REFS=<root> python -I packages/measured/build/b_dvtd_area.py
"""
import itertools
import sys
import zipfile
from pathlib import Path

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

ZIP, H, BIN = "dvtd.zip", 0.7, 3.0


def stl(z, name):
    b = z.read(name)
    n = int(np.frombuffer(b[80:84], "<u4")[0])
    rec = np.frombuffer(b[84:84 + 50 * n], dtype=np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")]))
    return rec["v"].astype(float)


def crossings(tri, xs, ys):
    """z of every triangle crossing of every vertical ray through the (xs, ys) grid."""
    hits = {}
    for a, b, c in tri:
        i0, i1 = np.searchsorted(xs, [min(a[0], b[0], c[0]), max(a[0], b[0], c[0])])
        j0, j1 = np.searchsorted(ys, [min(a[1], b[1], c[1]), max(a[1], b[1], c[1])])
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if i0 >= i1 or j0 >= j1 or abs(d) < 1e-18:
            continue
        X, Y = np.meshgrid(xs[i0:i1], ys[j0:j1], indexing="ij")
        l1 = ((b[1] - c[1]) * (X - c[0]) + (c[0] - b[0]) * (Y - c[1])) / d
        l2 = ((c[1] - a[1]) * (X - c[0]) + (a[0] - c[0]) * (Y - c[1])) / d
        ok = (l1 >= 0) & (l2 >= 0) & (1 - l1 - l2 >= 0)
        zz = l1 * a[2] + l2 * b[2] + (1 - l1 - l2) * c[2]
        for ii, jj, zv in zip(*np.nonzero(ok), zz[ok]):
            hits.setdefault((i0 + ii, j0 + jj), []).append(zv)
    return hits


def voxelize(tri):
    lo, hi = tri.reshape(-1, 3).min(0) - H, tri.reshape(-1, 3).max(0) + H
    shape = np.ceil((hi - lo) / H).astype(int)
    axes = [lo[k] + (np.arange(shape[k]) + 0.5) * H for k in range(3)]
    vol = np.zeros(shape, bool)
    for (i, j), hz in crossings(tri, axes[0], axes[1]).items():
        hz = sorted(hz)
        for k in range(0, len(hz) - 1, 2):
            vol[i, j, (axes[2] > hz[k]) & (axes[2] < hz[k + 1])] = True
    return vol


def area_function(vol):
    """(distance from the glottis in m, area in m^2), one row per 3 mm shell."""
    idx = -np.ones(vol.shape, int)
    idx[vol] = np.arange(vol.sum())
    P = np.argwhere(vol)
    rows, cols, wts = [], [], []
    for d in (d for d in itertools.product((-1, 0, 1), repeat=3) if d > (0, 0, 0)):
        Q = P + d
        ok = (Q < vol.shape).all(1) & (Q >= 0).all(1)
        ok[ok] &= vol[tuple(Q[ok].T)]
        rows.append(idx[tuple(P[ok].T)]); cols.append(idx[tuple(Q[ok].T)])
        wts.append(np.full(ok.sum(), H * np.sqrt(sum(abs(x) for x in d))))
    G = coo_matrix((np.concatenate(wts), (np.concatenate(rows), np.concatenate(cols))), shape=(len(P), len(P)))
    seeds = np.flatnonzero(P[:, 2] <= P[:, 2].min() + 1)
    dist = dijkstra(G.tocsr(), directed=False, indices=seeds, min_only=True)
    dist = dist[np.isfinite(dist)]
    hist, edges = np.histogram(dist, bins=np.arange(0, dist.max() + BIN, BIN))
    return [round(float(e) * 1e-3, 4) for e in edges[:-1]], [float(f"{a * H ** 3 / BIN * 1e-6:.4e}") for a in hist]


def main():
    sha = prov.verify("dresden-vtd", ZIP)
    z = zipfile.ZipFile(prov.RAW / "dresden-vtd" / ZIP)
    names = sorted(n for n in z.namelist() if n.endswith("-inner-surface-closed.stl"))
    rows = []
    for n in names:
        model = n.rsplit("/", 1)[-1][:-len("-inner-surface-closed.stl")]
        s, a = area_function(voxelize(stl(z, n)))
        rows.append({"id": f"dvtd_area.{model}", "model": model, "section_m": BIN * 1e-3, "distance_m": s,
                     "area_m2": a, "length_m": round(s[-1] + BIN * 1e-3, 4), "source": "dresden-vtd",
                     "file": f"{ZIP}:{n}", "sha256": sha, "status": "derived"})
        print(model, rows[-1]["length_m"], flush=True)
    write("vocal_tract_areas_dvtd", {"provenance": {
        "method": "voxels at 0.7 mm, 26-connected geodesic distance from the glottis, 3 mm shells",
        "citation": prov.SOURCES["dresden-vtd"][0], "licence": prov.SOURCES["dresden-vtd"][1],
        "files": {ZIP: sha}}, "rows": rows})


if __name__ == "__main__":
    main()
