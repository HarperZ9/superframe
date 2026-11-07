# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two 3840x2160 plates: the z = 0 power spectrum against the Cosmic Emu for each test configuration, and
the eigenvalue staircases of E1 to E6 against COMPACT's modes.

    python packages/cosmo/study/plates_round2.py --runs LABEL=a.npz,b.npz,c.npz [LABEL=...] --out DIR
"""
import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from plates import GROUND, INK, MUTED, _fonts, plt  # noqa: E402
from cosmolab import reference, topology  # noqa: E402

LINES = ["#1f5fa8", "#b5562a", "#3b8c5a", "#8a4fa3", "#c49a1c", "#4a4f5a"]


def deficit_plate(groups, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    ax = fig.add_axes([0.07, 0.10, 0.62, 0.82])
    for (label, runs), col in zip(groups.items(), LINES):
        k = runs[0]["k_z0"]
        r = np.mean([d["pk_z0"] / reference.cosmicemu(d["k_z0"], 0.0) for d in runs], axis=0)
        ax.semilogx(k, r, color=col, lw=3.5, label=f"{label} ({len(runs)} boxes)")
    k = np.geomspace(0.01, 3, 200)
    hf = groups[next(iter(groups))][0]
    ax.semilogx(hf["k_z0"], hf["halofit_z0"] / reference.cosmicemu(hf["k_z0"], 0.0), color=INK, lw=2.5,
                ls="--", label="halofit on the same input")
    ax.fill_between(k, 0.97, 1.03, color="#d9d4c7", zorder=0)
    ax.axhline(1.0, color=INK, lw=1.5)
    ax.set_xlim(0.02, 2.5)
    ax.set_ylim(0.85, 1.12)
    ax.set_xlabel("k  [h/Mpc]")
    ax.set_ylabel("P(k) / Cosmic Emu, z = 0")
    ax.legend(frameon=False, loc="lower left", fontsize=24)
    ax.spines[["top", "right"]].set_visible(False)
    x = 0.73
    fig.text(x, 0.88, "Where the z = 0 deficit went", fontsize=46)
    fig.text(x, 0.83, "particle mesh against the Mira-Titan IV emulator", fontsize=30, color=MUTED)
    notes = ["shaded: the emulator's quoted 3 percent", "dashed: halofit sits 2 to 3 percent above",
             "the emulator from k = 0.2 to 2 h/Mpc,", "most of the gap halofit showed"]
    for i, s in enumerate(notes):
        fig.text(x, 0.72 - 0.05 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


TOPO = {"E1": ((1.0, 1.3, 0.7), (10, 12, 8)), "E2": ((1.0, 1.3, 0.7), (10, 12, 12)),
        "E3": ((1.0, 1.0, 0.6), (10, 10, 16)), "E4": ((1.0, 1.0, 0.5), (11, 11, 12)),
        "E5": ((1.0, 1.0, 0.4), (11, 11, 18)), "E6": ((1.0, 1.3, 0.8), (10, 12, 8))}


def topology_plate(dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    ax = fig.add_axes([0.07, 0.10, 0.62, 0.82])
    for (name, (L, N)), col in zip(TOPO.items(), LINES):
        num, ana = topology.compare((name, L), (name, L), N)
        ax.step(np.sqrt(num), np.arange(1, len(num) + 1), where="post", color=col, lw=3.5, label=name)
        ax.plot(np.sqrt(ana), np.arange(1, len(ana) + 1), "o", color=col, ms=9, mfc=GROUND, mew=2)
    num, ana = topology.compare(("E6", TOPO["E6"][0]), ("E6", TOPO["E6"][0]), TOPO["E6"][1],
                                e6_axis_modes="as printed")
    ax.step(np.sqrt(ana), np.arange(1, len(ana) + 1), where="post", color=INK, lw=2, ls="--",
            label="E6, axis modes counted as printed")
    ax.set_xlabel("sqrt(eigenvalue of the grid Laplacian)  [1 / side]")
    ax.set_ylabel("number of modes below")
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 60)
    ax.legend(frameon=False, loc="upper left", fontsize=26)
    ax.spines[["top", "right"]].set_visible(False)
    x = 0.73
    fig.text(x, 0.88, "Six flat universes, one stencil", fontsize=46)
    fig.text(x, 0.83, "eigenmode counts of E1 to E6, unequal sides", fontsize=30, color=MUTED)
    notes = ["lines: grid spectrum built from the gluing alone", "rings: COMPACT's allowed modes (2024)",
             "every value and multiplicity agrees", "dashed: E6 with n and -n counted twice",
             "on the axes; the grid carries one"]
    for i, s in enumerate(notes):
        fig.text(x, 0.72 - 0.05 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="+", default=[])
    ap.add_argument("--out", default="out/cosmo")
    a = ap.parse_args()
    _fonts()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    groups = {}
    for spec in a.runs:
        label, files = spec.split("=", 1)
        groups[label] = [dict(np.load(f)) for f in files.split(",")]
    if groups:
        deficit_plate(groups, out / "plate_pk_vs_emulator.png")
    topology_plate(out / "plate_topology_spectra.png")
    print("wrote plates to", out)


if __name__ == "__main__":
    main()
