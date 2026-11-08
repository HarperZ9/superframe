# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two 3840x2160 plates for round seven: three seeds with the halved softening and the tighter step rule
together, and ghost exchange every sub-step with the sliced FFT, with the 1024^3 projection.

    python packages/cosmo/study/plates_round7.py --runs a.npz b.npz c.npz --base x.npz y.npz z.npz \
        --score score_combined.json --equiv e2.json --scan g1.json g2.json g3.json \
        --scan-r6 r6/scan_g3.json ... --e1-r6 r6/e1_256.json --disk disk.json --projection proj.json --out DIR
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from plates import INK, MUTED, _fonts, plt  # noqa: E402

NEW, OLD, FAIL = "#1f5fa8", "#b5562a", "#a3302a"


def combined_plate(runs, base, score, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    for row, z in enumerate(("0", "1")):
        ax = fig.add_axes([0.07, 0.56 - 0.46 * row, 0.58, 0.38])
        k = runs[0][f"k_z{z}"]
        ax.fill_between([0.02, 6.3], 0.97, 1.03, color="#d9d4c7", lw=0, zorder=0)
        ax.axhline(1.0, color=INK, lw=1.5)
        for group, col, label in ((base, OLD, "round six: eps 0.0167, eta 0.1"),
                                  (runs, NEW, "round seven: eps 0.0167, eta 0.025")):
            r = np.array([d[f"pk_il_z{z}"] / d[f"emu_z{z}"] for d in group])
            ax.semilogx(k, r.mean(axis=0), color=col, lw=3.6, label=label)
            ax.fill_between(k, r.min(axis=0), r.max(axis=0), color=col, alpha=0.16, lw=0)
        for b, c in score["interlaced"][f"z{z}"].items():
            lo, hi = (float(v) for v in b.split("-"))
            ax.plot([max(lo, 0.03), hi], [c["mean"]] * 2, color=NEW if c["pass"] else FAIL, lw=7, solid_capstyle="butt")
        ax.set_xlim(0.03, 5.2)
        ax.set_ylim(0.90, 1.08)
        ax.set_xticks([0.05, 0.1, 0.3, 0.5, 1, 2, 3, 5], ["0.05", "0.1", "0.3", "0.5", "1", "2", "3", "5"])
        ax.set_ylabel(f"P(k) / Cosmic Emu, z = {z}")
        ax.spines[["top", "right"]].set_visible(False)
        if row == 0:
            ax.legend(frameon=False, loc="lower left", fontsize=24)
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel("k  [h/Mpc]")
    x = 0.70
    fig.text(x, 0.88, "Softening and steps together", fontsize=46)
    fig.text(x, 0.83, "512^3 particles in 256 Mpc/h, three seeds, same phases", fontsize=30, color=MUTED)
    verdict = "every band inside 3 percent" if score["pass"] else "fails the 3 percent line"
    c35 = score["interlaced"]["z0"]["3.0-5.0"]
    lines = ["interlaced estimator; shaded: 3 percent around the emulator;",
             "bars: seed means per band, red where outside the line",
             f"result: {verdict}",
             f"z = 0, k 3-5: {c35['mean']:.3f} ({c35['min']:.3f} to {c35['max']:.3f})"]
    for z in ("0", "1"):
        bad = [b for b, c in score["interlaced"][f"z{z}"].items() if not c["pass"]]
        if bad:
            lines.append(f"z = {z} outside: " + ", ".join(f"k {b} ({score['interlaced'][f'z{z}'][b]['mean']:.3f})" for b in bad))
    for i, s in enumerate(lines):
        fig.text(x, 0.75 - 0.045 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def _scan_row(ax, scan, y, col):
    for i, s in enumerate(scan):
        ok = s["equal"]
        ax.scatter([s["ghost_cells"]], [y], s=900, color=col if ok else FAIL, zorder=3)
        tag = "same bits" if ok else ("ownership\nerror" if "failed" in s else "bits differ")
        ax.text(s["ghost_cells"], y - (0.3 if i % 2 == 0 else 0.62), tag, ha="center", va="center", fontsize=20)


def exchange_plate(equiv, scan, scan_r6, e1_r6, disk, proj, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    ax = fig.add_axes([0.07, 0.58, 0.55, 0.32])
    _scan_row(ax, scan_r6, 0, OLD)
    _scan_row(ax, scan, 1, NEW)
    for g, y in ((e1_r6["ghost_cells"], 0), (equiv["ghost_cells"], 1)):
        ax.plot([g, g], [y - 0.2, y + 0.2], color=INK, lw=3)
        ax.text(g, y + 0.25, "bound", ha="center", fontsize=22)
    ax.set_ylim(-0.9, 1.6)
    ax.set_xlim(0, max(s["ghost_cells"] for s in scan_r6 + [e1_r6]) + 2)
    ax.set_yticks([0, 1], ["ghosts once a\nglobal step (8 sub-steps)", "ghosts every\nsub-step"], fontsize=24)
    ax.set_xlabel("ghost width, chaining cells (1 cell = %.2f Mpc/h, r_cut = %.2f)" % (equiv["cell_mpc_h"], equiv["rcut"]))
    ax.spines[["top", "right"]].set_visible(False)
    bx = fig.add_axes([0.07, 0.10, 0.25, 0.34])
    names = ["in-core,\nsliced FFT", "ghosts per\nglobal step", "every sub-step\nRAM", "every sub-step\ndisk (cached)"]
    secs = [equiv["incore_seconds"], e1_r6["ooc_seconds"], equiv["ooc_seconds"], disk["ooc_seconds"]]
    bx.bar(range(4), secs, color=[INK, OLD, NEW, NEW])
    for i, v in enumerate(secs):
        bx.text(i, v, f"{v:.0f} s", ha="center", va="bottom", fontsize=24)
    bx.set_xticks(range(4), names, fontsize=20)
    bx.set_ylabel("wall time, 256^3, z = 49 to 0")
    bx.spines[["top", "right"]].set_visible(False)
    cx = fig.add_axes([0.40, 0.10, 0.22, 0.34])
    parts = proj["energy_parts_mj"]
    left = 0.0
    for i, (name, v) in enumerate(parts.items()):
        cx.barh([0], [v], left=left, color=[NEW, OLD, MUTED][i % 3], label=name)
        left += v
    cx.axvline(3.0, color=FAIL, lw=3, ls="--")
    cx.text(3.0, 0.45, "3 MJ line", color=FAIL, fontsize=22, ha="left")
    cx.set_yticks([])
    cx.set_xlabel("1024^3 projected energy, MJ (whole card)")
    cx.set_ylim(-0.5, 1.2)
    cx.legend(frameon=False, fontsize=20, loc="upper left", ncol=2)
    cx.spines[["top", "right", "left"]].set_visible(False)
    x = 0.67
    fig.text(x, 0.88, "Ghosts every sub-step", fontsize=46)
    fig.text(x, 0.83, "256^3 particles, mesh 512 through the sliced FFT", fontsize=30, color=MUTED)
    lines = ["top: slab runs against the in-core engine, final",
             "positions and momenta hashed; black ticks: the ghost bound",
             "left: wall time on a shared card",
             "right: the 1024^3 run projected from these runs",
             f"projection: {proj['hours']:.0f} h, {proj['energy_mj']:.1f} MJ, peak GPU {proj['peak_gpu_gib']:.1f} GB",
             f"verdict: {'run' if proj['run'] else 'not run'}"]
    for i, s in enumerate(lines):
        fig.text(x, 0.74 - 0.045 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="+", required=True)
    ap.add_argument("--base", nargs="+", required=True)
    ap.add_argument("--score", required=True)
    ap.add_argument("--equiv", required=True)
    ap.add_argument("--scan", nargs="+", required=True)
    ap.add_argument("--scan-r6", nargs="+", required=True)
    ap.add_argument("--e1-r6", required=True)
    ap.add_argument("--disk", required=True)
    ap.add_argument("--projection", required=True)
    ap.add_argument("--out", default="out/cosmo/plates")
    a = ap.parse_args()
    _fonts()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    load = lambda p: json.loads(Path(p).read_text())
    combined_plate([dict(np.load(p)) for p in a.runs], [dict(np.load(p)) for p in a.base], load(a.score),
                   out / "plate_combined_three_seeds.png")
    e1 = load(a.e1_r6)
    scan = sorted((load(p) for p in a.scan + [a.equiv]), key=lambda s: s["ghost_cells"])
    scan_r6 = sorted((load(p) for p in a.scan_r6 + [a.e1_r6]), key=lambda s: s["ghost_cells"])
    exchange_plate(load(a.equiv), scan, scan_r6, e1, load(a.disk), load(a.projection), out / "plate_exchange_every_substep.png")


if __name__ == "__main__":
    main()
