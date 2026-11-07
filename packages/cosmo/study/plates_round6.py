# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two 3840x2160 plates for round six: three seeds at the halved softening against Cosmic Emu, and the
out-of-core slab stepping against the in-core engine.

    python packages/cosmo/study/plates_round6.py --runs a.npz b.npz c.npz --base x.npz y.npz z.npz \
        --score score_confirm.json --equiv e1.json --scan g3.json g5.json ... --sliced s256.json s512.json --disk disk.json --out DIR
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


def confirm_plate(runs, base, score, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    for row, z in enumerate(("0", "1")):
        ax = fig.add_axes([0.07, 0.56 - 0.46 * row, 0.58, 0.38])
        k = runs[0][f"k_z{z}"]
        ax.fill_between([0.02, 6.3], 0.97, 1.03, color="#d9d4c7", lw=0, zorder=0)
        ax.axhline(1.0, color=INK, lw=1.5)
        for group, key, col, label in ((base, "pk", OLD, "round four: eps 0.0333, eta 0.05 (plain CIC)"),
                                       (runs, "pk_il", NEW, "round six: eps 0.0167, eta 0.1 (interlaced)")):
            r = np.array([d[f"{key}_z{z}"] / d[f"emu_z{z}"] for d in group])
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
    fig.text(x, 0.88, "Halved softening, three seeds", fontsize=46)
    fig.text(x, 0.83, "512^3 particles in 256 Mpc/h, same phases as round four", fontsize=30, color=MUTED)
    verdict = "every band inside 3 percent" if score["pass"] else "fails the 3 percent line"
    lines = ["shaded: the emulator's 3 percent; bars: seed means per band,",
             "red where the mean falls outside the line set before the runs",
             f"result: {verdict}"]
    for z in ("0", "1"):
        bad = [b for b, c in score["interlaced"][f"z{z}"].items() if not c["pass"]]
        if bad:
            lines.append(f"z = {z} outside: " + ", ".join(f"k {b} ({score['interlaced'][f'z{z}'][b]['mean']:.3f})" for b in bad))
    for i, s in enumerate(lines):
        fig.text(x, 0.75 - 0.045 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def ooc_plate(equiv, scan, sliced, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    ax = fig.add_axes([0.07, 0.56, 0.55, 0.36])
    g = [s["ghost_cells"] for s in scan]
    worst = [0.0 if s["equal"] else (max(abs(v) for v in s.get("ooc_over_incore", {"x": 1.0}).values()) * 100 or 1e-6) for s in scan]
    for gi, ok, w in zip(g, [s["equal"] for s in scan], worst):
        ax.scatter([gi], [1 if ok else 0], s=900, color=NEW if ok else FAIL, zorder=3)
        ax.text(gi, 0.8 if ok else -0.2, "same bits" if ok else ("ownership error" if "failed" in scan[g.index(gi)] else f"{w:.2g}% P(k)"),
                ha="center", fontsize=22)
    ax.axvline(equiv["ghost_cells"], color=INK, lw=2, ls="--")
    ax.text(equiv["ghost_cells"], 1.25, "bound", ha="center", fontsize=24)
    ax.set_ylim(-0.5, 1.5)
    ax.set_yticks([0, 1], ["differs", "equal"])
    ax.set_xlabel("ghost width, chaining cells (1 cell = %.2f Mpc/h, r_cut = %.2f)" % (equiv["cell_mpc_h"], equiv["rcut"]))
    ax.spines[["top", "right"]].set_visible(False)
    bx = fig.add_axes([0.07, 0.10, 0.25, 0.34])
    names = ["in-core", "slabs, RAM"] + (["slabs, disk"] if "disk_seconds" in equiv else [])
    secs = [equiv["incore_seconds"], equiv["ooc_seconds"]] + ([equiv["disk_seconds"]] if "disk_seconds" in equiv else [])
    bx.bar(range(len(names)), secs, color=[INK, NEW, OLD][:len(names)])
    for i, v in enumerate(secs):
        bx.text(i, v, f"{v:.0f} s", ha="center", va="bottom", fontsize=24)
    bx.set_xticks(range(len(names)), names, fontsize=24)
    bx.set_ylabel("wall time, 256^3, z = 49 to 0")
    bx.spines[["top", "right"]].set_visible(False)
    cx = fig.add_axes([0.40, 0.10, 0.22, 0.34])
    for i, s in enumerate(sliced):
        cx.bar(i - 0.2, max(s["sliced"]), width=0.4, color=NEW)
        cx.bar(i + 0.2, max(s["planted_rolled_green"]), width=0.4, color=FAIL)
    cx.set_yscale("log")
    cx.axhline(1e-5, color=INK, lw=1.5, ls=":")
    cx.set_xticks(range(len(sliced)), [f"mesh {s['mesh']}" for s in sliced], fontsize=24)
    cx.set_ylabel("max |error| / max |force|")
    cx.spines[["top", "right"]].set_visible(False)
    x = 0.67
    fig.text(x, 0.88, "Out of core, slab by slab", fontsize=46)
    fig.text(x, 0.83, "256^3 particles, mesh 512, three step levels", fontsize=30, color=MUTED)
    for i, s in enumerate(["top: slab runs against the in-core engine, final positions",
                           "and momenta hashed; dashed: the worst-case ghost bound",
                           "left: time on a shared card; right: sliced FFT force",
                           "(blue) and a planted rolled Green's function (red);",
                           "dotted: the 1e-5 pass line"]):
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
    ap.add_argument("--sliced", nargs="+", required=True)
    ap.add_argument("--disk", default=None, help="equivalence json of the memory-mapped store run")
    ap.add_argument("--out", default="out/cosmo/plates")
    a = ap.parse_args()
    _fonts()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    load = lambda p: json.loads(Path(p).read_text())
    confirm_plate([dict(np.load(p)) for p in a.runs], [dict(np.load(p)) for p in a.base], load(a.score),
                  out / "plate_confirm_three_seeds.png")
    scan = sorted((load(p) for p in a.scan), key=lambda s: s["ghost_cells"])
    equiv = load(a.equiv)
    if a.disk:
        equiv["disk_seconds"] = load(a.disk)["ooc_seconds"]
    ooc_plate(equiv, scan, [load(p) for p in a.sliced], out / "plate_out_of_core.png")


if __name__ == "__main__":
    main()
