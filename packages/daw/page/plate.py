# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The instruments plate, 3840 x 2160: mode shapes of every resonator family and their spectra.

    python -I packages/daw/page/plate.py OUT.png [DEMO_DIR]

Needs matplotlib (not a package dependency). Every category carries a colour and a marker or line style,
so the plate reads in greyscale and for colour-blind viewers. Hanken Grotesk is used when installed.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import font_manager  # noqa: E402

from daw import materials as M  # noqa: E402
from daw import propagate as P  # noqa: E402
from daw import voice as V  # noqa: E402
from daw.demo import LEAF, instruments  # noqa: E402
from daw.outline import Outline, polygon_mask  # noqa: E402
from daw.shapes_1d import Bar, free_free_shape  # noqa: E402
from daw.shapes_2d import clamped_circular_lambdas  # noqa: E402
from daw.synth import render  # noqa: E402

INK, GROUND, MUTED = "#1d1a16", "#f4f1ea", "#6f675c"
CAT = ["#0f6e8c", "#b5462a", "#4f7d2b", "#7a4f9a", "#c08a12", "#2a6f5f", "#9a3b6a"]
MARK = ["o", "s", "^", "D", "v", "P", "X"]
LINE = ["-", "--", "-.", ":", (0, (5, 1, 1, 1)), (0, (1, 1)), (0, (8, 2))]


def fonts():
    for f in ("hanken-grotesk-medium.ttf", "hanken-grotesk-regular.ttf"):
        for d in (Path("C:/Windows/Fonts"), Path.home() / "AppData/Local/Microsoft/Windows/Fonts"):
            if (d / f).exists():
                font_manager.fontManager.addfont(str(d / f))
    names = {f.name for f in font_manager.fontManager.ttflist}
    plt.rcParams.update({"font.family": "Hanken Grotesk" if "Hanken Grotesk" in names else "DejaVu Sans",
                         "font.size": 15, "axes.edgecolor": MUTED, "axes.labelcolor": INK, "text.color": INK,
                         "xtick.color": MUTED, "ytick.color": MUTED, "axes.facecolor": GROUND,
                         "figure.facecolor": GROUND, "axes.spines.top": False, "axes.spines.right": False})


def bar_modes(ax):
    x = np.linspace(0, 1, 400)
    roots = Bar(M.material("aluminium"), 0.3, 0.01).roots(4)
    for i, bl in enumerate(roots):
        y = free_free_shape(bl, x)
        ax.plot(x, y / np.abs(y).max(), color=CAT[i], ls=LINE[i], lw=3, marker=MARK[i], markevery=50, ms=9,
                label=f"mode {i + 1}, ratio {(bl / roots[0]) ** 2:.4f}")
    ax.set_title("Free bar: shapes and ratios 1 : 2.756 : 5.404 : 8.933", loc="left")
    ax.set_xlabel("position along the bar (x / L)"); ax.legend(frameon=False, fontsize=12)


def tube_modes(ax):
    x = np.linspace(0, 1, 300)
    for i in range(3):
        ax.plot(x, np.cos((2 * i + 1) * np.pi * x / 2), color=CAT[i], ls=LINE[i], lw=3, marker=MARK[i],
                markevery=40, ms=9, label=f"closed-open, {2 * i + 1} c / 4L")
    ax.set_title("Air column: pressure modes", loc="left")
    ax.set_xlabel("closed end to open end (x / L)"); ax.legend(frameon=False, fontsize=12)


def disc_image(ax, n, s, title):
    lam = clamped_circular_lambdas(n, s + 1)[s]
    xs = np.linspace(-1, 1, 360)
    X, Y = np.meshgrid(xs, xs)
    r, th = np.hypot(X, Y), np.arctan2(Y, X)
    from scipy.special import iv, jv
    w = (jv(n, lam * r) - jv(n, lam) / iv(n, lam) * iv(n, lam * r)) * np.cos(n * th)
    w[r > 1] = np.nan
    ax.imshow(w / np.nanmax(np.abs(w)), cmap="BrBG", vmin=-1, vmax=1)
    ax.contour(np.ma.masked_invalid(w), levels=[0], colors=INK, linewidths=1.5)
    ax.set_title(title, loc="left"); ax.axis("off")


def leaf_images(axes):
    o = Outline(polygon_mask(LEAF, 140), 0.3, M.material("glass_crown"), h=0.004, k=6)
    f = o.modes().freqs
    for ax, i in zip(axes, (0, 3)):
        img = o.mode_image(i).T
        ax.imshow(img / np.nanmax(np.abs(img)), cmap="BrBG", vmin=-1, vmax=1, origin="lower")
        ax.contour(np.ma.masked_invalid(img), levels=[0], colors=INK, linewidths=1.5, origin="lower")
        ax.set_title(f"Glass leaf, mode {i + 1}: {f[i]:.0f} Hz", loc="left"); ax.axis("off")


def spectra(ax):
    fs, ins = 48000, instruments()
    for i, (name, inst) in enumerate(ins.items()):
        from daw.modes import tune, midi_hz
        res = tune(inst.resonator, midi_hz(57))
        y = render(res.modes(), fs, 1.0, inst.x_in, inst.x_out, inst.kind, inst.tau,
                   rng=np.random.default_rng(1), velocity=1.0, hold=0.5)
        s = 20 * np.log10(np.abs(np.fft.rfft(y * np.hanning(len(y)))) + 1e-9)
        fr = np.fft.rfftfreq(len(y), 1 / fs)
        k = (fr > 50) & (fr < 8000)
        ax.semilogx(fr[k], np.maximum(s[k] - s.max(), -45) - 50 * i, color=CAT[i], ls=LINE[i], lw=1.6, marker=MARK[i],
                    markevery=900, ms=8, label=name)
    ax.set_title("One note, A3, from each instrument: top 45 dB, one band each", loc="left")
    ax.set_xlabel("frequency (Hz)"); ax.set_yticks([]); ax.set_ylabel("level, 45 dB per band")
    for i, name in enumerate(ins):
        ax.text(62, -50 * i - 22, name, color=CAT[i], fontsize=12, ha="left")


def voice_panel(ax):
    f = np.linspace(50, 4500, 1500)
    open_v = (np.r_[np.full(9, 1e-4), np.full(8, 7e-4)], np.full(17, 0.01))
    for i, (lab, tract) in enumerate((("uniform 17.5 cm tube", V.uniform_tract()), ("narrow back, wide front", open_v))):
        h = 20 * np.log10(np.minimum(V.response(f, *tract), 1e3))
        ax.plot(f, h, color=CAT[i], ls=LINE[i], lw=2.5, label=lab)
        fm = V.formants(*tract, fmax=4500)
        ax.plot(fm, np.full(len(fm), 62 - 4 * i), MARK[i], color=CAT[i], ms=11, ls="none")
    ax.set_title("Vocal tract: transfer, formants", loc="left")
    ax.set_xlabel("frequency (Hz)"); ax.set_ylabel("|U lips / U glottis| (dB)"); ax.legend(frameon=False, fontsize=12)


def air_panel(ax):
    f = np.logspace(2.7, 4.2, 200)
    rows = [r for r in M.table().values() if r["id"].startswith("air.atten.")]
    for i, rh in enumerate((10, 30, 50, 90)):
        ax.loglog(f, P.iso9613_alpha(f, 20.0, rh) * 1000, color=CAT[i], ls=LINE[i], lw=2.5, label=f"ISO 9613-1, RH {rh} %")
        pts = [(r["f_hz"], r["value"]) for r in rows if r["rh_percent"] == rh]
        ax.loglog(*zip(*pts), MARK[i], color=CAT[i], ms=9, mfc="none", mew=2)
    ax.set_title("Air absorption, 20 C", loc="left")
    ax.set_xlabel("frequency (Hz)"); ax.set_ylabel("dB per km"); ax.legend(frameon=False, fontsize=11)


def build(out):
    fonts()
    fig = plt.figure(figsize=(19.2, 10.8), dpi=200)
    g = fig.add_gridspec(3, 4, hspace=0.42, wspace=0.28, left=0.045, right=0.985, top=0.86, bottom=0.075)
    fig.text(0.04, 0.95, "Physical-model instruments: shapes, modes and spectra", fontsize=30, weight="medium")
    fig.text(0.04, 0.915, "Materials from Kaye and Laby. Plate values checked against Leissa 1969. Air: ISO 9613-1 lines, "
             "NPL table markers. Formants as markers. Nodal lines in ink.", fontsize=14, color=MUTED)
    bar_modes(fig.add_subplot(g[0, 0:2])); tube_modes(fig.add_subplot(g[0, 2]))
    disc_image(fig.add_subplot(g[0, 3]), 2, 0, "Clamped disc, (n 2, s 0)")
    disc_image(fig.add_subplot(g[1, 0]), 0, 1, "Clamped disc, (n 0, s 1)")
    disc_image(fig.add_subplot(g[1, 1]), 1, 1, "Clamped disc, (n 1, s 1)")
    leaf_images([fig.add_subplot(g[1, 2]), fig.add_subplot(g[1, 3])])
    spectra(fig.add_subplot(g[2, 0:2])); voice_panel(fig.add_subplot(g[2, 2])); air_panel(fig.add_subplot(g[2, 3]))
    fig.savefig(out, dpi=200, facecolor=GROUND)


if __name__ == "__main__":
    build(sys.argv[1])
