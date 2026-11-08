# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two 3840x2160 plates for round nine: the pooled spacing factor over eight seeds with the closure on its
interval; and softening convergence at 0.25 Mpc/h spacing (eps 0.0083 to 0.0042) with the planted check.

    python packages/cosmo/study/plates_round9.py --score r9/score_round9.json --r8 r8 --r9 r9 \
        --prereg r9/prereg_round9.json --out r9/plates
"""
import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
from matplotlib.ticker import NullFormatter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from plates import INK, MUTED, _fonts, plt  # noqa: E402

OLD, NEW, POOL, FAIL, PURE = "#8a8578", "#1f5fa8", "#14213d", "#a3302a", "#2a7f62"
CUT = "#c08a1e"


def _by_seed(root, sub):
    return {re.search(r"seed(\d+)", p.name).group(1): dict(np.load(p)) for p in sorted(Path(root, sub).glob("*.npz"))}


def _text(fig, x, y0, title, sub, lines, size=27):
    fig.text(x, 0.88, title, fontsize=46)
    fig.text(x, 0.83, sub, fontsize=30, color=MUTED)
    for i, s in enumerate(lines):
        fig.text(x, y0 - 0.045 * i, s, fontsize=size)


def pooled_plate(score, prereg, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    p = score["pairs"]
    pred = {"z0": prereg["predictions"]["R_pooled_n8_z0"]["3-5"], "z1": prereg["predictions"]["R_pooled_n8_z1"]["3-5"]}
    ax = fig.add_axes([0.06, 0.12, 0.36, 0.72])
    for i, z in enumerate(("z0", "z1")):
        c, lo, hi = pred[z]
        ax.fill_between([i - 0.42, i + 0.42], lo, hi, color="#e4dfd2", lw=0, zorder=0)
        for j, (name, col, lab) in enumerate((("r8", OLD, "round eight seeds"), ("new5", NEW, "round nine seeds"),
                                              ("pooled", POOL, "pooled"))):
            cell = p[name]["interlaced"][z]["3.0-5.0"]
            lab = f"{lab}, n = {len(p[name]['seeds'])}"
            xs = i + (j - 1) * 0.25
            if name != "pooled":
                ax.scatter([xs] * len(cell["per_seed_percent"]), cell["per_seed_percent"], s=300, color=col, alpha=0.7,
                           zorder=3)
            n = len(p[name]["seeds"])
            err = [[cell["mean"] - cell["ci95"][0]], [cell["ci95"][1] - cell["mean"]]] if n > 2 else None
            ax.errorbar([xs + (0.06 if name != "pooled" else 0)], [cell["mean"]], yerr=err, fmt="s", ms=20,
                        color=col, lw=5, capsize=14, label=lab if i == 0 else None, zorder=4)
    ax.axhline(0, color=INK, lw=1.5)
    ax.set_xticks([0, 1], ["z = 0, k 3-5", "z = 1, k 3-5"])
    ax.set_xlim(-0.6, 1.6)
    ax.set_ylim(-0.5, 5.5)
    ax.set_ylabel("spacing 0.5 to 0.25 Mpc/h: P_fine / P_coarse - 1, percent")
    ax.legend(frameon=False, fontsize=26, loc="upper left")
    ax.spines[["top", "right"]].set_visible(False)
    bx = fig.add_axes([0.49, 0.12, 0.17, 0.72])
    c = score["closure"]["z0"]
    bx.axhspan(0.97, 1.03, color="#e4dfd2", lw=0, zorder=0)
    bx.axhline(1.0, color=INK, lw=1.5)
    bx.axhline(0.99, color=CUT, lw=3, ls="--")
    seeds = c["base_per_seed"]
    bx.scatter([0] * len(seeds), seeds, s=300, color=OLD, zorder=3)
    bx.plot([-0.12, 0.12], [c["base"]] * 2, color=OLD, lw=6)
    for xs, key, col in ((1, "factor_only", POOL), (2, "with_base", NEW)):
        lo, hi = c[key]["ci95"]
        bx.errorbar([xs], [c["value"]], yerr=[[c["value"] - lo], [hi - c["value"]]], fmt="o", ms=24, color=col, lw=5,
                    capsize=14)
    bx.set_xticks([0, 1, 2], ["512^3\nmeasured", "1024^3\nfactor", "1024^3\n+ base"])
    bx.set_xlim(-0.5, 2.5)
    bx.set_ylim(0.955, 1.03)
    bx.set_ylabel("P / Cosmic Emu, z = 0, k 3-5")
    bx.spines[["top", "right"]].set_visible(False)
    m = p["pooled"]["interlaced"]["z0"]["3.0-5.0"]
    m1 = p["pooled"]["interlaced"]["z1"]["3.0-5.0"]
    lines = ["left: per-seed factor (dots), means with 95 percent t",
             "intervals (none drawn for n = 2);",
             "tan boxes: preregistered ranges (set for n = 8)",
             f"pooled z = 0: {m['mean']:+.2f} ({m['ci95'][0]:+.2f} to {m['ci95'][1]:+.2f})",
             f"pooled z = 1: {m1['mean']:+.2f} ({m1['ci95'][0]:+.2f} to {m1['ci95'][1]:+.2f})",
             "right: round seven's three 256 Mpc/h seeds and the",
             "inferred 1024^3 value: factor interval alone, then",
             "with the base's seed scatter; dashed: the 0.990 cut",
             f"inferred: {c['value']:.3f}",
             f"factor interval {c['factor_only']['ci95'][0]:.3f} to {c['factor_only']['ci95'][1]:.3f}: "
             f"{c['factor_only']['words']}",
             f"with base scatter {c['with_base']['ci95'][0]:.3f} to {c['with_base']['ci95'][1]:.3f}: "
             f"{c['with_base']['words']}",
             "inferred, not run: no 1024^3 particles exist"]
    _text(fig, 0.70, 0.75, "Pooled seeds, one factor", "256^3 against 128^3 in 64 Mpc/h, same phases per pair", lines)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def _curves(ax, hi, lo, z, col, label, lw=3.0, ls="-"):
    first = True
    for s, h in hi.items():
        if s not in lo:
            continue
        k = h[f"k_z{z}"]
        r = (h[f"pk_il_z{z}"] / lo[s][f"pk_il_z{z}"] - 1) * 100
        sel = k > 0.1
        ax.semilogx(k[sel], r[sel], color=col, lw=lw, ls=ls, alpha=0.9, label=label if first else None)
        first = False


def softening_plate(a, score, prereg, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    mhi, shalf = _by_seed(a.r8, "mhi"), _by_seed(a.r9, "shalf")
    planted, spure = _by_seed(a.r9, "planted"), _by_seed(a.r9, "spure")
    for row, z in enumerate(("0", "1")):
        ax = fig.add_axes([0.06, 0.56 - 0.46 * row, 0.46, 0.38])
        ax.axhline(0, color=INK, lw=1.5)
        if z == "0":
            ax.axhspan(-0.5, 0.5, color="#e4dfd2", lw=0, zorder=0)
        _curves(ax, shalf, mhi, z, NEW, "eps 0.0083 to 0.0042, eta 0.025 (three seeds)")
        if spure:
            _curves(ax, spure, mhi, z, PURE, "same, at round eight's eta x eps (softening only)", lw=2.6)
        if planted:
            _curves(ax, planted, shalf, z, FAIL, "planted: eps x4 at the same steps", ls="--")
        for b, c in score["pairs"]["D"]["interlaced"][f"z{z}"].items():
            lo_b, hi_b = (float(v) for v in b.split("-"))
            ax.plot([lo_b, hi_b], [c["mean"]] * 2, color=INK, lw=6, solid_capstyle="butt")
        ax.set_xlim(0.1, 5.2)
        ax.set_ylim(-4 if planted else -1, 3)
        ax.set_xticks([0.1, 0.3, 0.5, 1, 2, 3, 5], ["0.1", "0.3", "0.5", "1", "2", "3", "5"])
        ax.xaxis.set_minor_formatter(NullFormatter())
        ax.set_ylabel(f"P / P(eps 0.0083) - 1, percent, z = {z}")
        ax.spines[["top", "right"]].set_visible(False)
        if row == 0:
            ax.legend(frameon=False, loc="lower left", fontsize=24)
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel("k  [h/Mpc]")
    bx = fig.add_axes([0.58, 0.12, 0.12, 0.72])
    steps = [("0.0167 to\n0.0083", score["pairs"]["prev"]["interlaced"]["z0"]["3.0-5.0"]),
             ("0.0083 to\n0.0042", score["pairs"]["D"]["interlaced"]["z0"]["3.0-5.0"])]
    for i, (lab, cell) in enumerate(steps):
        bx.scatter([i] * len(cell["per_seed_percent"]), cell["per_seed_percent"], s=300, color=NEW if i else OLD)
        bx.errorbar([i + 0.15], [cell["mean"]], yerr=[[cell["mean"] - cell["ci95"][0]], [cell["ci95"][1] - cell["mean"]]],
                    fmt="s", ms=20, color=POOL, lw=5, capsize=12)
    bx.axhline(0.5, color=CUT, lw=3, ls="--")
    bx.axhline(0, color=INK, lw=1.5)
    bx.set_xticks([0, 1], [s[0] for s in steps])
    bx.set_xlim(-0.5, 1.6)
    bx.set_ylabel("halving eps at 0.25 Mpc/h spacing: change at z = 0, k 3-5, percent")
    bx.spines[["top", "right"]].set_visible(False)
    cv = score["convergence"]
    d = score["pairs"]["D"]["interlaced"]
    lines = ["left: same particles and phases, eps halved;",
             "black bars: three-seed band means; tan band: the line",
             f"z = 0, k 3-5: {cv['mean']:+.2f} (upper t bound {cv['upper']:+.2f})",
             f"z = 0, k 2-3: {d['z0']['2.0-3.0']['mean']:+.2f};  z = 1, k 3-5: {d['z1']['3.0-5.0']['mean']:+.2f}",
             f"line 0.5: {cv['words']}"]
    if planted:
        lines.append(f"planted eps x4, k 3-5: {score['pairs']['planted']['interlaced']['z0']['3.0-5.0']['mean']:+.2f}")
    if spure:
        lines.append(f"softening only, k 3-5: {score['pairs']['D_pure']['interlaced']['z0']['3.0-5.0']['mean']:+.2f}")
    lines += ["right: the previous halving (round eight's runs)", "and this one, both at eta 0.025; dashed: the 0.5 line"]
    _text(fig, 0.73, 0.75, "Softening at 0.25 Mpc/h", "256^3 in 64 Mpc/h, eps 0.0083 against 0.0042", lines, size=26)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    for name in ("score", "r8", "r9", "prereg"):
        ap.add_argument(f"--{name}", required=True)
    ap.add_argument("--out", default="out/cosmo/plates")
    a = ap.parse_args()
    _fonts()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    score = json.loads(Path(a.score).read_text())
    prereg = json.loads(Path(a.prereg).read_text())
    pooled_plate(score, prereg, out / "plate_pooled_factor.png")
    if "D" in score["pairs"]:
        softening_plate(a, score, prereg, out / "plate_softening_convergence.png")


if __name__ == "__main__":
    main()
