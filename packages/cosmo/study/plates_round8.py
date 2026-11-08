# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two 3840x2160 plates for round eight: the same-phase resolution factor (spacing 0.5 to 0.25 Mpc/h) per
seed against k, with the planted softening and the mass-only arm; and the box bridge with the closure figure.

    python packages/cosmo/study/plates_round8.py --score score_massres.json --hi "mhi/*.npz" --lo "mlo/*.npz" \
        --planted "planted/*.npz" --mass "mmass/*.npz" --prereg prereg_round8.json --r7 0.976 0.972 0.982 --out DIR
"""
import argparse
import glob
import json
import re
import sys
from pathlib import Path

import numpy as np
from matplotlib.ticker import NullFormatter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from plates import INK, MUTED, _fonts, plt  # noqa: E402

MAIN, MASS, FAIL, BOX = "#1f5fa8", "#2a7f62", "#a3302a", ("#6a4c93", "#c08a1e", "#1f5fa8")


def _by_seed(pattern):
    return {re.search(r"seed(\d+)", p).group(1): dict(np.load(p)) for p in sorted(glob.glob(pattern))}


def _curves(ax, hi, lo, z, col, label, lw=3.0, ls="-"):
    first = True
    for s, h in hi.items():
        k = h[f"k_z{z}"]
        r = (h[f"pk_il_z{z}"] / lo[s][f"pk_il_z{z}"] - 1) * 100
        sel = k > 0.1
        ax.semilogx(k[sel], r[sel], color=col, lw=lw, ls=ls, alpha=0.9, label=label if first else None)
        first = False


def ladder_plate(a, score, prereg, dest):
    lo, hi = _by_seed(a.lo), _by_seed(a.hi)
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    pred = {"0": prereg["predictions"]["main_ladder_z0"], "1": prereg["predictions"]["main_ladder_z1"]}
    for row, z in enumerate(("0", "1")):
        ax = fig.add_axes([0.07, 0.56 - 0.46 * row, 0.58, 0.38])
        ax.axhline(0, color=INK, lw=1.5)
        for b in ("2-3", "3-5"):
            if b in pred[z]:
                lo_b, hi_b = (float(v) for v in b.split("-"))
                c, p0, p1 = pred[z][b]
                ax.fill_between([lo_b, hi_b], p0, p1, color="#d9d4c7", lw=0, zorder=0)
        _curves(ax, hi, lo, z, MAIN, "spacing 0.5 to 0.25, eps per spacing (three seeds)")
        if a.mass and glob.glob(a.mass):
            _curves(ax, _by_seed(a.mass), lo, z, MASS, "mass only, eps held at 0.0167", lw=2.4)
        if a.planted:
            _curves(ax, _by_seed(a.planted), lo, z, FAIL, "planted: fine arm with softening x4", lw=3.0, ls="--")
        for b, c in score["pairs"]["main"]["interlaced"][f"z{z}"].items():
            lo_b, hi_b = (float(v) for v in b.split("-"))
            if lo_b >= 0.1:
                ax.plot([lo_b, hi_b], [c["mean"]] * 2, color=INK, lw=6, solid_capstyle="butt")
        ax.set_xlim(0.1, 5.2)
        ax.set_ylim(-6 if a.planted else -2, 6)
        ax.set_xticks([0.1, 0.3, 0.5, 1, 2, 3, 5], ["0.1", "0.3", "0.5", "1", "2", "3", "5"])
        ax.xaxis.set_minor_formatter(NullFormatter())
        ax.set_ylabel(f"P_fine / P_coarse - 1, percent, z = {z}")
        ax.spines[["top", "right"]].set_visible(False)
        if row == 0:
            ax.legend(frameon=False, loc="lower left", fontsize=24)
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel("k  [h/Mpc]")
    x = 0.70
    fig.text(x, 0.88, "Halving the particle spacing", fontsize=46)
    fig.text(x, 0.83, "128^3 against 256^3 in 64 Mpc/h, same phases", fontsize=30, color=MUTED)
    m = score["pairs"]["main"]["interlaced"]
    lines = ["interlaced estimator; black bars: three-seed band means;",
             "grey boxes: preregistered ranges",
             f"z = 0, k 3-5: {m['z0']['3.0-5.0']['mean']:+.2f} percent "
             f"(seeds {m['z0']['3.0-5.0']['min']:+.2f} to {m['z0']['3.0-5.0']['max']:+.2f})",
             f"z = 0, k 2-3: {m['z0']['2.0-3.0']['mean']:+.2f}",
             f"z = 1, k 3-5: {m['z1']['3.0-5.0']['mean']:+.2f}"]
    if "mass" in score["pairs"]:
        c = score["pairs"]["mass"]["interlaced"]["z0"]["3.0-5.0"]
        lines.append(f"mass only, z = 0, k 3-5: {c['mean']:+.2f} ({c['min']:+.2f} to {c['max']:+.2f})")
    if "planted" in score["pairs"]:
        lines.append(f"planted, z = 0, k 3-5: {score['pairs']['planted']['interlaced']['z0']['3.0-5.0']['mean']:+.2f}")
    lines.append("three seeds: a small sample")
    for i, s in enumerate(lines):
        fig.text(x, 0.75 - 0.045 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def bridge_plate(a, score, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    ax = fig.add_axes([0.07, 0.12, 0.40, 0.72])
    bands = ("1.0-2.0", "2.0-3.0", "3.0-5.0")
    for j, (name, col) in enumerate(zip(("b64", "b128", "b256"), BOX)):
        if name not in score["pairs"]:
            continue
        for i, b in enumerate(bands):
            c = score["pairs"][name]["interlaced"]["z0"][b]
            xs = i + (j - 1) * 0.22
            ax.scatter([xs] * len(c["per_seed_percent"]), c["per_seed_percent"], s=260, color=col, alpha=0.6)
            ax.plot([xs - 0.08, xs + 0.08], [c["mean"]] * 2, color=col, lw=6,
                    label=f"{name[1:]} Mpc/h" if i == 0 else None)
    ax.set_xticks(range(3), ["k 1-2", "k 2-3", "k 3-5"])
    ax.set_ylabel("spacing 1 to 0.5 Mpc/h: P_fine / P_coarse - 1, percent, z = 0")
    ax.legend(frameon=False, fontsize=26, loc="upper left")
    ax.spines[["top", "right"]].set_visible(False)
    bx = fig.add_axes([0.56, 0.12, 0.12, 0.72])
    r7, r7lo, r7hi = a.r7
    c = score["closure"]
    bx.axhspan(0.97, 1.03, color="#d9d4c7", lw=0, zorder=0)
    bx.axhline(1.0, color=INK, lw=1.5)
    bx.axhline(0.99, color=MUTED, lw=1.5, ls="--")
    bx.errorbar([0], [r7], yerr=[[r7 - r7lo], [r7hi - r7]], fmt="o", ms=22, color=MUTED, lw=4, capsize=12)
    bx.errorbar([1], [c["value"]], yerr=[[c["value"] - c["ci95"][0]], [c["ci95"][1] - c["value"]]], fmt="o",
                ms=22, color=MAIN, lw=4, capsize=12)
    bx.set_xticks([0, 1], ["512^3\nmeasured", "1024^3\ninferred"])
    bx.set_xlim(-0.6, 1.6)
    bx.set_ylim(0.955, 1.025)
    bx.set_ylabel("P / Cosmic Emu, z = 0, k 3-5")
    bx.spines[["top", "right"]].set_visible(False)
    x = 0.72
    fig.text(x, 0.88, "Box bridge and closure", fontsize=46)
    fig.text(x, 0.83, "eps per spacing, eta 0.025, three seeds per box", fontsize=30, color=MUTED)
    lines = ["left: the coarser halving in three boxes;", "dots: seeds, bars: means",
             "right: round seven's 256 Mpc/h reading and the",
             "inferred 1024^3 value (x the 64 Mpc/h factor);",
             "bars: seed range (left), 95 percent t interval (right)",
             "shaded: 3 percent around the emulator; dashed 0.99",
             f"inferred: {c['value']:.3f} ({c['ci95'][0]:.3f} to {c['ci95'][1]:.3f})",
             f"verdict: {c['verdict']}",
             f"bridge, k 3-5: 64 against 256 Mpc/h differ by {score.get('bridge_gap_3to5', float('nan')):.2f} points",
             "inferred, not run: no 1024^3 particles exist"]
    for i, s in enumerate(lines):
        fig.text(x, 0.75 - 0.045 * i, s, fontsize=27)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    for name in ("score", "hi", "lo", "prereg"):
        ap.add_argument(f"--{name}", required=True)
    ap.add_argument("--planted", default=None)
    ap.add_argument("--mass", default=None)
    ap.add_argument("--r7", nargs=3, type=float, required=True, metavar=("MEAN", "MIN", "MAX"))
    ap.add_argument("--out", default="out/cosmo/plates")
    a = ap.parse_args()
    _fonts()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    score = json.loads(Path(a.score).read_text())
    prereg = json.loads(Path(a.prereg).read_text())
    ladder_plate(a, score, prereg, out / "plate_mass_ladder.png")
    bridge_plate(a, score, out / "plate_box_bridge_closure.png")


if __name__ == "__main__":
    main()
