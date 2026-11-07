# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two 3840x2160 plates for round four: block time steps against many global steps, and mass resolution
against the Cosmic Emu.

    python packages/cosmo/study/plates_round4.py --steps score_steps.json --ref ref420.npz \
        --cands LABEL=run.npz ... --cost LABEL=run.json ... \
        --mass LABEL=a.npz,b.npz,c.npz LABEL=d.npz,e.npz,f.npz --out DIR
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from plates import INK, MUTED, _fonts, plt  # noqa: E402
from cosmolab import reference  # noqa: E402

LINES = ["#1f5fa8", "#3b8c5a", "#6b6f78", "#b5562a"]


def steps_plate(ref, cands, spread_file, costs, dest):
    spread = json.loads(Path(spread_file).read_text())
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    for row, z in enumerate(("1", "0")):
        ax = fig.add_axes([0.07, 0.56 - 0.46 * row, 0.56, 0.38])
        k = ref[f"k_z{z}"]
        lo = [float(b.split("-")[0]) for b in spread["spread"][z]]
        hi = [float(b.split("-")[1]) for b in spread["spread"][z]]
        for a, b, (band, v) in zip(lo, hi, spread["spread"][z].items()):
            tol = abs(v - 1) + spread["floor"]
            ax.fill_between([max(a, 0.02), b], 1 - tol, 1 + tol, color="#d9d4c7", lw=0, zorder=0)
        ax.axhline(1.0, color=INK, lw=1.5)
        for (label, d), col in zip(cands.items(), LINES):
            ax.semilogx(k, d[f"pk_z{z}"] / ref[f"pk_z{z}"], color=col, lw=3.2, label=label)
        ax.set_xlim(0.05, 6.3)
        ax.set_ylim(0.86, 1.03)
        ax.set_ylabel(f"P / P(420 steps), z = {z}")
        ax.spines[["top", "right"]].set_visible(False)
        if row == 0:
            ax.legend(frameon=False, loc="lower left", fontsize=24)
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel("k  [h/Mpc]")
    bx = fig.add_axes([0.70, 0.10, 0.27, 0.32])
    names = list(costs)
    secs = [costs[n]["run_seconds"] for n in names]
    kj = [costs[n]["gpu_joules_nvml"] / 1e3 for n in names]
    y = np.arange(len(names))
    bx.barh(y, kj, color=LINES[0], height=0.6)
    for i, (s, j) in enumerate(zip(secs, kj)):
        bx.text(j + 1, i, f"{j:.1f} kJ, {s:.0f} s", va="center", fontsize=22)
    bx.set_yticks(y, names, fontsize=22)
    bx.set_xlim(0, max(kj) * 1.6)
    bx.set_xlabel("GPU energy, NVML counter")
    bx.spines[["top", "right"]].set_visible(False)
    x = 0.70
    fig.text(x, 0.88, "Block time steps", fontsize=46)
    fig.text(x, 0.83, "256^3 particles, 128 Mpc/h, same initial conditions", fontsize=30, color=MUTED)
    notes = ["shaded: the change from 420 to 840 global steps,", "plus a 0.2 percent floor",
             "planted: a step rule 64 times too lenient"]
    for i, s in enumerate(notes):
        fig.text(x, 0.74 - 0.045 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def mass_plate(groups, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    for row, z in enumerate(("1", "0")):
        ax = fig.add_axes([0.07, 0.56 - 0.46 * row, 0.60, 0.38])
        kk = np.geomspace(0.02, 6.3, 50)
        ax.fill_between(kk, 0.97, 1.03, color="#d9d4c7", lw=0, zorder=0)
        ax.axhline(1.0, color=INK, lw=1.5)
        for (label, runs), col in zip(groups.items(), LINES):
            k = runs[0][f"k_z{z}"]
            r = np.array([d[f"pk_z{z}"] / reference.cosmicemu(k, float(z)) for d in runs])
            ax.semilogx(k, r.mean(axis=0), color=col, lw=3.5, label=f"{label} ({len(runs)} seeds)")
            ax.fill_between(k, r.min(axis=0), r.max(axis=0), color=col, alpha=0.18, lw=0)
        for kn, s in ((np.pi, "256^3 Nyquist"), (2 * np.pi, "512^3 Nyquist")):
            ax.axvline(kn, color=MUTED, lw=1.2, ls=":")
            ax.text(kn * 0.97, 0.865, s, rotation=90, ha="right", fontsize=20, color=MUTED)
        ax.set_xlim(0.05, 6.3)
        ax.set_ylim(0.85, 1.08)
        ax.set_ylabel(f"P(k) / Cosmic Emu, z = {z}")
        ax.spines[["top", "right"]].set_visible(False)
        if row == 0:
            ax.legend(frameon=False, loc="lower left", fontsize=24)
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel("k  [h/Mpc]")
    x = 0.71
    fig.text(x, 0.88, "Mass resolution", fontsize=46)
    fig.text(x, 0.83, "256 Mpc/h, same phases, mesh and softening", fontsize=30, color=MUTED)
    notes = ["shaded grey: the emulator's quoted 3 percent", "coloured bands: range over three phase seeds",
             "the 512^3 boxes carry the 256^3 boxes' modes", "plus the modes between the two Nyquist frequencies"]
    for i, s in enumerate(notes):
        fig.text(x, 0.74 - 0.045 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", required=True)
    ap.add_argument("--ref", required=True)
    ap.add_argument("--cands", nargs="+", required=True)
    ap.add_argument("--cost", nargs="+", required=True)
    ap.add_argument("--mass", nargs="+", required=True)
    ap.add_argument("--out", default="out/cosmo/plates")
    a = ap.parse_args()
    _fonts()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    cands = {s.split("=", 1)[0]: dict(np.load(s.split("=", 1)[1])) for s in a.cands}
    costs = {s.split("=", 1)[0]: json.loads(Path(s.split("=", 1)[1]).read_text()) for s in a.cost}
    steps_plate(dict(np.load(a.ref)), cands, a.steps, costs, out / "plate_block_steps.png")
    groups = {s.split("=", 1)[0]: [dict(np.load(f)) for f in s.split("=", 1)[1].split(",")] for s in a.mass}
    mass_plate(groups, out / "plate_mass_resolution.png")


if __name__ == "__main__":
    main()
