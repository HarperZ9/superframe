# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two 3840x2160 plates from run_pk.py output: a density slab, and P(k) against halofit.

    python packages/cosmo/study/plates.py RUN.npz [MORE.npz ...] --out DIR

The first npz supplies the slab; every npz given enters the P(k) plate (one line per realisation, and
their mean in the ratio panel). Needs matplotlib; Hanken Grotesk and Conso are used when installed.
"""
import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib import font_manager  # noqa: E402

GROUND, INK, MUTED = "#f4f1ea", "#1d1f24", "#6b6f78"
Z_COLOUR = {"0": "#1f5fa8", "1": "#b5562a"}


def _fonts():
    names = {f.name for f in font_manager.fontManager.ttflist}
    sans = "Hanken Grotesk" if "Hanken Grotesk" in names else "DejaVu Sans"
    plt.rcParams.update({"font.family": sans, "font.size": 26, "axes.edgecolor": MUTED, "axes.labelcolor": INK,
                         "xtick.color": MUTED, "ytick.color": MUTED, "text.color": INK,
                         "figure.facecolor": GROUND, "axes.facecolor": GROUND, "savefig.facecolor": GROUND})


def slab_plate(npz, meta, dest):
    img = np.log10(np.clip(1.0 + npz["slab"], 1e-2, None))
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    ax = fig.add_axes([0.0, 0.0, 2160 / 3840, 1.0])
    ax.imshow(img.T, origin="lower", cmap="magma", vmin=-1.0, vmax=2.0, interpolation="lanczos")
    ax.set_axis_off()
    zoom = fig.add_axes([0.60, 0.30, 0.37, 0.37 * 3840 / 2160])
    n = img.shape[0]
    q = n // 4
    zoom.imshow(img[:q, :q].T, origin="lower", cmap="magma", vmin=-1.0, vmax=2.0, interpolation="lanczos")
    zoom.set_xticks([])
    zoom.set_yticks([])
    box = meta["box_mpc_h"]
    fig.text(0.60, 0.20, f"{meta['n']}³ particles, {box:g} Mpc/h box, z = 0", fontsize=40)
    fig.text(0.60, 0.15, f"slab {box / 16:g} Mpc/h thick; right: the lower-left {box / 4:g} Mpc/h, enlarged",
             fontsize=28, color=MUTED)
    fig.text(0.60, 0.11, "colour: log10(1 + delta), -1 to 2", fontsize=28, color=MUTED)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def pk_plate(runs, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    top = fig.add_axes([0.07, 0.42, 0.62, 0.53])
    bot = fig.add_axes([0.07, 0.08, 0.62, 0.30], sharex=top)
    for z in ("1", "0"):
        col = Z_COLOUR[z]
        k = runs[0][f"k_z{z}"]
        ratios = []
        for r in runs:
            top.loglog(r[f"k_z{z}"], r[f"pk_z{z}"], color=col, lw=2.0, alpha=0.55)
            ratios.append(r[f"pk_z{z}"] / r[f"halofit_z{z}"])
            bot.semilogx(r[f"k_z{z}"], ratios[-1], color=col, lw=1.5, alpha=0.35)
        top.loglog(k, runs[0][f"halofit_z{z}"], color=INK, lw=2.5, ls="--")
        top.loglog(k, runs[0][f"plin_z{z}"], color=MUTED, lw=2.0, ls=":")
        bot.semilogx(k, np.mean(ratios, axis=0), color=col, lw=4.0, label=f"z = {z}, mean of {len(runs)} boxes")
        top.text(k[-1] * 1.08, runs[0][f"halofit_z{z}"][-1], f"z = {z}", color=col, fontsize=34, va="center")
    kmax = max(r["k_z0"].max() for r in runs) * 1.1
    bot.fill_between([1e-3, 1.0, 1.0, kmax], [0.95, 0.95, 0.90, 0.90], [1.05, 1.05, 1.10, 1.10],
                     color="#d9d4c7", zorder=0, step=None)
    bot.set_xlim(runs[0]["k_z0"].min() * 0.9, kmax)
    bot.axhline(1.0, color=INK, lw=1.5)
    bot.set_ylim(0.8, 1.15)
    bot.set_xlabel("k  [h/Mpc]")
    bot.set_ylabel("PM / halofit")
    top.set_ylabel("P(k)  [(Mpc/h)³]")
    plt.setp(top.get_xticklabels(), visible=False)
    bot.legend(frameon=False, loc="lower left")
    for ax in (top, bot):
        ax.spines[["top", "right"]].set_visible(False)
    x = 0.73
    fig.text(x, 0.88, "Matter power spectrum", fontsize=48)
    fig.text(x, 0.83, "particle mesh against halofit (Takahashi et al. 2012)", fontsize=30, color=MUTED)
    lines = ["solid: our particle-mesh boxes", "dashed: halofit on the same linear spectrum",
             "dotted: linear theory", "shaded: halofit's quoted accuracy", "(5 percent below k = 1, 10 percent above)"]
    for i, s in enumerate(lines):
        fig.text(x, 0.72 - 0.05 * i, s, fontsize=28)
    fig.text(x, 0.40, "The band is the reference's own accuracy:", fontsize=28, color=MUTED)
    fig.text(x, 0.36, "inside it, the comparison cannot tell", fontsize=28, color=MUTED)
    fig.text(x, 0.32, "our error from halofit's.", fontsize=28, color=MUTED)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("npz", nargs="+")
    ap.add_argument("--out", default="out/cosmo")
    a = ap.parse_args()
    _fonts()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    runs = [dict(np.load(p)) for p in a.npz]
    meta = json.loads(Path(a.npz[0]).with_suffix(".json").read_text())
    slab_plate(runs[0], meta, out / "plate_density_slab.png")
    pk_plate(runs, out / "plate_pk_vs_halofit.png")
    print("wrote", out / "plate_density_slab.png", out / "plate_pk_vs_halofit.png")


if __name__ == "__main__":
    main()
