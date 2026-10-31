# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Runs H1 of study 2026-10-31-sdf-sh: one modal basis against full-rank solves, with controls.

    python -I modal_run.py OUT.json [n]
Writes errors per K for heat, diffuse light, Helmholtz and Varadhan distance, the controls at K = 200,
times, the known-answer check of the eigensolver and the Weyl count.
"""
import json
import os
import sys
import time

import numpy as np
import scipy.sparse.linalg as spla

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import modal_basis as M  # noqa: E402

FREQS = np.arange(20.0, 201.0, 1.0)
VT = [0.05, 0.5]                                     # Varadhan times (kappa t, m^2)


def known_answer(n=40, K=30):
    """The square room's discrete Neumann eigenvalues are (2 - 2 cos(pi i / n)) / h^2 summed over axes."""
    L, _, h = M.room(n, l_shape=False)
    lam, _, _ = M.eigbasis(L, K)
    one = (2 - 2 * np.cos(np.pi * np.arange(n) / n)) / h**2
    exact = np.sort(np.add.outer(one, one).ravel())[:K]
    nz = exact > 1e-9
    return {"max_rel_nonzero": float(np.max(np.abs(lam[nz] - exact[nz]) / exact[nz])),
            "zero_mode_abs": float(abs(lam[~nz]).max())}


def weyl(lam, area=75.0, perim=40.0):
    """Two-term Neumann Weyl count N(lam) ~ A lam / 4 pi + P sqrt(lam) / 4 pi, at the top of the basis."""
    top = lam[-1]
    return {"lambda_max": float(top), "count": int(lam.size),
            "weyl_two_term": float(area * top / (4 * np.pi) + perim * np.sqrt(top) / (4 * np.pi))}


def errors(lam, phi, P, h, u0, S, ref, href, r, dist_cols, dist_true, near):
    out = {}
    for name, fn in M.filters(h).items():
        x = u0 if name.startswith("heat") else S
        y = M.apply_filter(lam, phi, fn, x, h)
        out[name] = M.rel(y, ref[name])
        if name == "light":
            ff = M.far(P, M.SRC, 1.0)
            out["light_far1m"] = M.rel(y[ff], ref[name][ff])
    hm = M.helmholtz_modal(lam, phi, M.gauss(P, M.SRC, 0.2, h), FREQS, r)
    out["helmholtz_rcv"] = M.rel(hm, href)
    out["helmholtz_db_max"] = float(np.max(np.abs(20 * np.log10(np.abs(hm) / np.abs(href)))))
    s_idx = M.nearest(P, M.SRC)
    for t in VT:
        kt = phi @ (np.exp(-lam * t) * phi[s_idx] / h**2)
        d = M.varadhan(kt, s_idx, h, t)
        out[f"varadhan_t{t}"] = float(np.mean(np.abs(d[near] - dist_true[near]) / dist_true[near]))
        out[f"varadhan_t{t}_full"] = dist_cols[t]
    return out


def main(path, n):
    L, P, h = M.room(n)
    res = {"n_cells": int(L.shape[0]), "h_m": h, "known_answer_max_rel": known_answer()}
    u0, S, ref, times = M.references(L, P, h)
    r = M.nearest(P, M.RCV)
    href, t_h = M.helmholtz_ref(L, M.gauss(P, M.SRC, 0.2, h), FREQS, r)
    times["helmholtz_per_freq"] = t_h
    s_idx = M.nearest(P, M.SRC)
    dist_true = M.geodesic(P, P[s_idx])
    near = (dist_true > 1.0) & (dist_true < 8.0)
    dist_cols = {}
    for t in VT:
        delta = np.zeros(L.shape[0]); delta[s_idx] = 1 / h**2
        t0 = time.perf_counter()
        kt = spla.expm_multiply(-t * L, delta)
        times[f"varadhan_full_t{t}"] = time.perf_counter() - t0
        d = M.varadhan(kt, s_idx, h, t)
        dist_cols[t] = float(np.mean(np.abs(d[near] - dist_true[near]) / dist_true[near]))
    lam, phi, t_eig = M.eigbasis(L, max(M.KS))
    times["eigsh_K400"] = t_eig
    res["weyl"] = weyl(lam)
    res["per_K"] = {}
    for K in M.KS:
        res["per_K"][K] = errors(lam[:K], phi[:, :K], P, h, u0, S, ref, href, r, dist_cols, dist_true, near)
    t0 = time.perf_counter()
    for _ in range(20):
        M.apply_filter(lam, phi, M.filters(h)["light"], S, h)
    times["modal_query_K400"] = (time.perf_counter() - t0) / 20
    t0 = time.perf_counter()
    M.helmholtz_modal(lam, phi, S, FREQS, r)
    times["modal_helmholtz_181f_K400"] = time.perf_counter() - t0
    res["controls_K200"] = controls(L, P, h, u0, S, ref, href, r, dist_cols, dist_true, near)
    res["times_s"] = times
    res["energy_tail"] = tails(lam, phi, u0, S, h)
    json.dump(res, open(path, "w"), indent=1)
    print(json.dumps(res, indent=1))


def controls(L, P, h, u0, S, ref, href, r, dist_cols, dist_true, near, K=200):
    rng = np.random.default_rng(20261031)
    out = {}
    lr, Vr = M.galerkin(L, rng.standard_normal((L.shape[0], K)))
    out["random_subspace"] = errors(lr, Vr, P, h, u0, S, ref, href, r, dist_cols, dist_true, near)
    ij = sorted(((i, j) for i in range(40) for j in range(40)), key=lambda p: p[0] ** 2 + p[1] ** 2)[:K]
    Q = np.stack([np.cos(np.pi * i * P[:, 0] / M.SIDE) * np.cos(np.pi * j * P[:, 1] / M.SIDE) for i, j in ij], 1)
    ls, Vs = M.galerkin(L, Q)
    out["square_room_modes"] = errors(ls, Vs, P, h, u0, S, ref, href, r, dist_cols, dist_true, near)
    return out


def tails(lam, phi, u0, S, h):
    """Fraction of each output's energy carried by modes beyond K (inside the K = 400 basis)."""
    out = {}
    for name, fn in M.filters(h).items():
        x = u0 if name.startswith("heat") else S
        e = (fn(lam) * (phi.T @ x)) ** 2
        c = np.cumsum(e) / e.sum()
        out[name] = {K: float(1 - c[K - 1]) for K in M.KS}
    return out


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 120)
