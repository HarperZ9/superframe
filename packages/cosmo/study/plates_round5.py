# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two 3840x2160 plates for round five: one-factor effects on the 512^3 baseline, and box size against
mass resolution at matched particle mass.

    python packages/cosmo/study/plates_round5.py --base base.npz --factors LABEL=run.npz ... \
        --box LABEL=a.npz,b.npz,... LABEL=... --pairs LABEL=hi.npz,lo.npz ... --out DIR
"""
import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from plates import INK, MUTED, _fonts, plt  # noqa: E402
from cosmolab import reference  # noqa: E402

LINES = ["#1f5fa8", "#3b8c5a", "#b5562a", "#7a4fa3", "#6b6f78", "#c49a1c"]
FLOOR = 0.005


def _band(k, r, w, lo, hi):
    s = (k >= lo) & (k < hi)
    return float(np.average(r[s], weights=w[s]))


def factors_plate(base, factors, shortfall, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    for row, z in enumerate(("0", "1")):
        ax = fig.add_axes([0.07, 0.56 - 0.46 * row, 0.52, 0.38])
        k = base[f"k_z{z}"]
        ax.fill_between([0.05, 6.3], -100 * FLOOR, 100 * FLOOR, color="#d9d4c7", lw=0, zorder=0)
        ax.axhline(0.0, color=INK, lw=1.5)
        for (label, d), col in zip(factors.items(), LINES):
            ax.semilogx(k, 100 * (d[f"pk_z{z}"] / base[f"pk_z{z}"] - 1), color=col, lw=3.2, label=label)
        ax.semilogx(k, 100 * (base[f"pk_il_z{z}"] / base[f"pk_z{z}"] - 1), color=INK, lw=2.4, ls="--",
                    label="measurement: interlaced over plain CIC")
        ax.set_xlim(0.3, 5.2)
        ax.set_xticks([0.3, 0.5, 1, 2, 3, 5], ["0.3", "0.5", "1", "2", "3", "5"])
        ax.set_ylim(-6, 5)
        ax.set_ylabel(f"percent change in P, z = {z}")
        ax.spines[["top", "right"]].set_visible(False)
        if row == 0:
            ax.legend(frameon=False, loc="lower left", fontsize=22)
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel("k  [h/Mpc]")
    bx = fig.add_axes([0.68, 0.10, 0.29, 0.40])
    names = list(factors) + ["measurement"]
    vals = [100 * (_band(base["k_z0"], d["pk_z0"] / base["pk_z0"], base["nmodes_z0"], 3, 5) - 1) for d in factors.values()]
    vals.append(100 * (_band(base["k_z0"], base["pk_il_z0"] / base["pk_z0"], base["nmodes_z0"], 3, 5) - 1))
    y = np.arange(len(names))
    bx.barh(y, vals, color=(LINES[:len(factors)] + [INK]), height=0.6)
    bx.axvline(0, color=INK, lw=1.2)
    for v, s in ((100 * shortfall, "shortfall"), (50 * shortfall, "half")):
        bx.axvline(v, color=MUTED, lw=1.5, ls=":")
        bx.text(v, len(names) - 0.4, s, ha="center", fontsize=20, color=MUTED)
    bx.axvspan(-100 * FLOOR, 100 * FLOOR, color="#d9d4c7", lw=0, zorder=0)
    for i, v in enumerate(vals):
        if v < -6.5:                         # off the axis: label inside the bar at the edge
            bx.text(-6.8, i, f"{v:+.2f}", va="center", ha="left", fontsize=22, color="white")
        else:
            bx.text(v + (0.15 if v >= 0 else -0.15), i, f"{v:+.2f}", va="center", ha="left" if v >= 0 else "right",
                    fontsize=22)
    bx.set_yticks(y, names, fontsize=22)
    bx.set_xlim(-7, 7)
    bx.set_xlabel("percent change, z = 0, k 3-5 h/Mpc")
    bx.spines[["top", "right"]].set_visible(False)
    x = 0.68
    fig.text(x, 0.88, "One factor at a time", fontsize=46)
    fig.text(x, 0.83, "512^3 particles, 256 Mpc/h, one seed, same phases", fontsize=30, color=MUTED)
    for i, s in enumerate(["shaded: the 0.5 percent noise floor set before the runs",
                           "the baseline rerun matched round four bit for bit"]):
        fig.text(x, 0.75 - 0.045 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def box_mass_plate(groups, pairs, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    ax = fig.add_axes([0.07, 0.56, 0.60, 0.38])
    kk = np.geomspace(0.02, 6.3, 50)
    ax.fill_between(kk, 0.97, 1.03, color="#d9d4c7", lw=0, zorder=0)
    ax.axhline(1.0, color=INK, lw=1.5)
    for (label, runs), col in zip(groups.items(), LINES):
        k = runs[0]["k_z0"]
        r = np.array([d["pk_z0"] / reference.cosmicemu(k, 0.0) for d in runs])
        ax.semilogx(k, r.mean(axis=0), color=col, lw=3.5, label=f"{label} ({len(runs)} seeds)")
        ax.fill_between(k, r.min(axis=0), r.max(axis=0), color=col, alpha=0.16, lw=0)
    ax.set_xlim(0.05, 5.2)
    ax.set_ylim(0.80, 1.10)
    ax.set_ylabel("P(k) / Cosmic Emu, z = 0")
    ax.legend(frameon=False, loc="lower left", fontsize=24)
    ax.tick_params(labelbottom=False)
    ax.spines[["top", "right"]].set_visible(False)
    bx = fig.add_axes([0.07, 0.10, 0.60, 0.38])
    bx.axhline(1.0, color=INK, lw=1.5)
    for (label, (hi, lo)), col in zip(pairs.items(), LINES[2:]):
        for z, ls in (("0", "-"), ("1", "--")):
            bx.semilogx(hi[f"k_z{z}"], hi[f"pk_z{z}"] / lo[f"pk_z{z}"], color=col, lw=3.2, ls=ls,
                        label=f"{label}, z = {z}")
    bx.set_xlim(0.05, 5.2)
    bx.set_ylim(0.96, 1.10)
    bx.set_ylabel("P(8x particles) / P, same phases")
    bx.set_xlabel("k  [h/Mpc]")
    bx.legend(frameon=False, loc="upper left", fontsize=22)
    bx.spines[["top", "right"]].set_visible(False)
    x = 0.71
    fig.text(x, 0.88, "Box size or particle mass", fontsize=46)
    fig.text(x, 0.83, "same mesh cell, split, cut-off and softening", fontsize=30, color=MUTED)
    for i, s in enumerate(["top: equal particle mass, boxes of 256 and 128 Mpc/h;",
                           "bands span the phase seeds; shaded flat: the emulator's 3 percent",
                           "bottom: eight times the particles on the same phases,",
                           "one step coarse to fine and the next step finer"]):
        fig.text(x, 0.74 - 0.045 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--factors", nargs="+", required=True)
    ap.add_argument("--shortfall", type=float, default=0.053, help="three-seed shortfall at z = 0, k 3-5")
    ap.add_argument("--box", nargs="+", required=True)
    ap.add_argument("--pairs", nargs="+", required=True)
    ap.add_argument("--out", default="out/cosmo/plates")
    a = ap.parse_args()
    _fonts()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    split = lambda s: s.split("=", 1)
    factors = {split(s)[0]: dict(np.load(split(s)[1])) for s in a.factors}
    factors_plate(dict(np.load(a.base)), factors, a.shortfall, out / "plate_factors.png")
    groups = {split(s)[0]: [dict(np.load(f)) for f in split(s)[1].split(",")] for s in a.box}
    pairs = {split(s)[0]: tuple(dict(np.load(f)) for f in split(s)[1].split(",")) for s in a.pairs}
    box_mass_plate(groups, pairs, out / "plate_box_and_mass.png")


if __name__ == "__main__":
    main()
