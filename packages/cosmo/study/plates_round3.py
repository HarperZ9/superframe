# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two 3840x2160 plates for round three: P3M against the Cosmic Emu (with the CAMB-input comparison), and
gravity in the twisted manifold E3.

    python packages/cosmo/study/plates_round3.py --runs LABEL=a.npz,b.npz,c.npz [LABEL=...] \
        --camb EH=a.npz,b.npz CAMB=c.npz,d.npz --twisted twisted_e3.npz --out DIR

--runs: up to four groups for the z = 0 panel (mean line, seed range shaded). --camb: two groups with the
same phases, EH input first; the lower panel shows their measured ratio over the input ratio.
"""
import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from plates import GROUND, INK, MUTED, _fonts, plt  # noqa: E402
from cosmolab import background, linear, reference, topology, twisted  # noqa: E402

LINES = ["#6b6f78", "#1f5fa8", "#b5562a", "#3b8c5a"]


def _load(spec):
    label, files = spec.split("=", 1)
    return label, [dict(np.load(f)) for f in files.split(",")]


def pk_plate(groups, camb, dest):
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    ax = fig.add_axes([0.07, 0.40, 0.62, 0.54])
    k = np.geomspace(0.01, 6, 200)
    ax.fill_between(k, 0.97, 1.03, color="#d9d4c7", zorder=0)
    ax.axhline(1.0, color=INK, lw=1.5)
    for (label, runs), col in zip(groups.items(), LINES):
        kk = runs[0]["k_z0"]
        r = np.array([d["pk_z0"] / reference.cosmicemu(d["k_z0"], 0.0) for d in runs])
        ax.semilogx(kk, r.mean(axis=0), color=col, lw=3.5, label=f"{label} ({len(runs)} seeds)")
        ax.fill_between(kk, r.min(axis=0), r.max(axis=0), color=col, alpha=0.18, lw=0)
    ax.set_xlim(0.03, 5.5)
    ax.set_ylim(0.80, 1.12)
    ax.set_ylabel("P(k) / Cosmic Emu, z = 0")
    ax.legend(frameon=False, loc="lower left", fontsize=24)
    ax.spines[["top", "right"]].set_visible(False)
    ax.tick_params(labelbottom=False)
    bx = fig.add_axes([0.07, 0.08, 0.62, 0.28], sharex=ax)
    (le, eh), (lc, cb) = camb
    c = background.Cosmology()
    kk = eh[0]["k_z0"]
    inp = linear.camb_power(c)(kk) / linear.LinearPower(c)(kk)
    bx.semilogx(kk, inp, color=INK, lw=2.5, ls="--", label="input: CAMB / Eisenstein-Hu, linear")
    for z, col in (("0", LINES[1]), ("1", LINES[2])):
        r = np.array([b[f"pk_z{z}"] / a[f"pk_z{z}"] for a, b in zip(eh, cb)])
        bx.semilogx(kk, r.mean(axis=0), color=col, lw=3.5, label=f"measured, z = {z} ({len(r)} phase pairs)")
    bx.axhline(1.0, color=INK, lw=1.0)
    bx.set_ylim(0.94, 1.06)
    bx.set_xlabel("k  [h/Mpc]")
    bx.set_ylabel(f"{lc} / {le} input")
    bx.legend(frameon=False, loc="lower left", fontsize=22, ncol=3)
    bx.spines[["top", "right"]].set_visible(False)
    x = 0.73
    fig.text(x, 0.88, "Short-range force", fontsize=46)
    fig.text(x, 0.83, "P3M against the Mira-Titan IV emulator", fontsize=30, color=MUTED)
    notes = ["shaded grey: the emulator's quoted 3 percent", "coloured bands: range over three phase seeds",
             "particle Nyquist: pi for 256 Mpc/h, 2 pi for 128",
             "", "lower panel: the same phases started", "from CAMB and from the Eisenstein-Hu fit"]
    for i, s in enumerate(notes):
        fig.text(x, 0.72 - 0.05 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


CASES = {"E2": (1.0, 1.2, 0.5), "E3": (1.0, 1.0, 0.4), "E4": (1.0, 1.0, 0.5), "E5": (1.0, 1.0, 0.3),
         "E6": (0.5, 0.6, 0.4)}


def _poisson_errors():
    out = {}
    for name, L in CASES.items():
        N = tuple(int(round(c / 0.015 / 2)) * 2 for c in topology.cover(name, L))
        A = twisted.lattice(name, L)
        src = A @ np.array([0.31, 0.27, 0.12])
        pts = (A @ np.random.default_rng(2).uniform(0, 1, (40, 3)).T).T
        ana = twisted.eigen_potential(name, L, src, pts, smooth=0.06, nmax=int(max(N) * 0.45))
        good = twisted.TwistedPoisson(name, L, N, smooth=0.06).potential(src[None], pts)
        bad = twisted.TwistedPoisson(name, L, N, smooth=0.06, images=False).potential(src[None], pts)
        s = np.abs(ana).max()
        out[name] = (np.abs(good - ana).max() / s, np.abs(bad - ana).max() / s)
    return out


def twisted_plate(npz, dest):
    lay = npz["layers"]
    fig = plt.figure(figsize=(38.4, 21.6), dpi=100)
    size = 0.45
    for j in range(4):
        ax = fig.add_axes([0.02 + (j % 2) * size * 2160 / 3840 * 1.02, 0.51 - (j // 2) * size * 1.02,
                           size * 2160 / 3840, size])
        ax.imshow(np.log10(np.clip(1 + lay[j], 1e-2, None)).T, origin="lower", cmap="magma", vmin=-1, vmax=2,
                  interpolation="lanczos")
        ax.set_xticks([])
        ax.set_yticks([])
        ax.text(0.03, 0.94, f"layer {j + 1}", transform=ax.transAxes, color="#f4f1ea", fontsize=26)
    err = _poisson_errors()
    bx = fig.add_axes([0.60, 0.12, 0.36, 0.38])
    names = list(err)
    xs = np.arange(len(names))
    bx.bar(xs - 0.2, [err[n][0] for n in names], width=0.4, color=LINES[1], label="twisted solve")
    bx.bar(xs + 0.2, [err[n][1] for n in names], width=0.4, color=LINES[2], label="planted: untwisted torus")
    bx.set_yscale("log")
    bx.set_xticks(xs, names)
    bx.set_ylabel("max |Phi - eigen sum| / max |Phi|")
    bx.legend(frameon=False, fontsize=22, loc="lower left", bbox_to_anchor=(0.0, 1.02), ncol=2)
    bx.spines[["top", "right"]].set_visible(False)
    x = 0.60
    fig.text(x, 0.88, "Gravity in a twisted box", fontsize=46)
    fig.text(x, 0.83, "E3: each pass along z turns the box a quarter", fontsize=30, color=MUTED)
    notes = ["left: z = 0 density in the four 32 Mpc/h layers", "of the 128 Mpc/h covering torus; each layer",
             "is the one before it turned 90 degrees",
             "below: the Poisson solve against COMPACT's", "eigenmodes, E2 to E6"]
    for i, s in enumerate(notes):
        fig.text(x, 0.75 - 0.045 * i, s, fontsize=28)
    fig.savefig(dest, dpi=100)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="+", default=[])
    ap.add_argument("--camb", nargs=2, default=None)
    ap.add_argument("--twisted", default=None)
    ap.add_argument("--out", default="out/cosmo")
    a = ap.parse_args()
    _fonts()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    if a.runs and a.camb:
        pk_plate(dict(_load(s) for s in a.runs), [_load(s) for s in a.camb], out / "plate_p3m_vs_emulator.png")
    if a.twisted:
        twisted_plate(dict(np.load(a.twisted)), out / "plate_twisted_e3.png")
    print("wrote plates to", out)


if __name__ == "__main__":
    main()
