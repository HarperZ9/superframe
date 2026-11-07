# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Tape echo and electric piano: audio examples and a 3840 x 2160 plate.

    python -I packages/daw/page/echo_plate.py OUT_DIR

Writes rhodes_dry.wav, rhodes_space.wav (mode 11 with wow, capstan flutter and hiss), echo_speeds.wav
(one pluck at three tape speeds) and echo_rhodes_plate.png. Needs matplotlib (not a package dependency).
Every series carries a colour and a marker or line style, so the plate reads in greyscale.
"""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from plate import CAT, GROUND, INK, LINE, MARK, MUTED, fonts  # noqa: E402

from daw import effects as fx  # noqa: E402
from daw import rhodes as R  # noqa: E402
from daw.export import write  # noqa: E402
from daw.tape_echo import TapeEcho  # noqa: E402

FS = 48000
PHRASE = [(0.0, 196.00, 0.25), (0.6, 246.94, 0.25), (1.2, 293.66, 0.25), (1.8, 392.00, 0.6), (2.6, 196.00, 0.05)]


def phrase(seconds=6.0):
    y = np.zeros(int(seconds * FS))
    for t0, f, off in PHRASE:
        v, _ = R.note(f, FS, seconds=seconds - t0, offset=off, release=1.2)
        i = int(t0 * FS)
        y[i:] += 0.18 * v[:len(y) - i]
    return y


def space_echo():
    return TapeEcho(speed=0.16, mode=11, intensity=0.28, wow_hz=0.8, wow_depth=0.003, capstan_ecc=3e-6,
                    hiss=True, drive=2.0, echo_mix=0.6, reverb_mix=0.25, seed=7)


def stereo(y):
    y = y / max(1e-9, np.max(np.abs(y))) * 0.89
    return np.stack([y, y], 1)


def recovery_rows():
    rows = []
    x = np.zeros(6 * FS)
    x[2400:2880] = 0.05 * np.hanning(480)
    for m in (1, 2, 3):
        e = TapeEcho(speed=0.2, mode=m, intensity=0.62)
        wet, _ = e.process(x, FS)
        d = fx.echo_spacing(x + wet, FS)
        rows.append((f"head {m} delay (ms)", e.head_delays()[m - 1] * 1e3, d * 1e3))
        if m == 2:
            rows.append(("intensity", 0.62, fx.echo_gain(x + wet, FS, d)))
    e = TapeEcho(speed=0.2, mode=2, intensity=0.0, wow_hz=0.8, wow_depth=0.003, capstan_ecc=4e-6)
    wet, _ = e.process(0.1 * np.sin(2 * math.pi * 1000 * np.arange(14 * FS) / FS), FS)
    wet = wet[FS // 2:]
    rate, depth, _ = fx.flutter(wet, FS, 0.2, 5)
    D = e.head_delays()[1]
    rows.append(("wow rate (Hz)", 0.8, rate))
    rows.append(("wow speed depth (%)", 0.3, 100 * depth / (2 * abs(math.sin(math.pi * rate * D)))))
    rate2, _, _ = fx.flutter(wet, FS, 5, 40)
    rows.append(("capstan rate (Hz)", 0.2 / (math.pi * e.capstan_d), rate2))
    return rows, wet


def panel_spectrogram(ax, y):
    ax.specgram(y, NFFT=4096, Fs=FS, noverlap=3584, cmap="magma", vmin=-140, vmax=-30)
    ax.set_ylim(0, 6000)
    ax.set_title("Electric piano phrase through the tape loop, mode 11 (three heads and the springs), intensity 0.28", loc="left")
    ax.set_xlabel("time (s)"); ax.set_ylabel("frequency (Hz)")


def panel_impulse(ax):
    x = np.zeros(int(1.4 * FS))
    x[480:960] = 0.05 * np.hanning(480)
    t = np.arange(len(x)) / FS * 1e3
    for i, m in enumerate((1, 2, 3)):
        wet, _ = TapeEcho(speed=0.2, mode=m, intensity=0.62).process(x, FS)
        ax.plot(t, np.abs(wet) / 0.05 + 1.2 * i, color=CAT[i], ls=LINE[i], lw=2.2,
                marker=MARK[i], markevery=3000, ms=8, label=f"mode {m}: head {m} alone, intensity 0.62")
    ax.set_title("Repeats per head: delay = head spacing / tape speed (spacing is a free parameter)", loc="left")
    ax.set_xlabel("time (ms)"); ax.set_yticks([]); ax.legend(frameon=False, fontsize=12, loc="upper right")


def panel_recovery(ax, rows):
    ax.axis("off")
    ax.set_title("Tape echo: settings read back from sound", loc="left")
    y = 0.9
    ax.text(0.0, y, "setting", weight="bold"); ax.text(0.5, y, "planted", weight="bold"); ax.text(0.75, y, "recovered", weight="bold")
    for name, want, got in rows:
        y -= 0.12
        ax.text(0.0, y, name); ax.text(0.5, y, f"{want:.4g}"); ax.text(0.75, y, f"{got:.4g}")


def panel_flutter(ax, wet):
    ph = np.unwrap(np.angle(__import__("scipy.signal", fromlist=["hilbert"]).hilbert(wet)))
    fi = np.diff(ph) * FS / (2 * math.pi)
    fi = fi[FS // 4:-FS // 4]
    rel = fi / np.median(fi) - 1
    rel -= rel.mean()
    n = 1 << 22
    sp = np.abs(np.fft.rfft(rel * np.hanning(len(rel)), n)) / len(rel) * 4
    f = np.fft.rfftfreq(n, 1 / FS)
    k = (f > 0.1) & (f < 40)
    ax.semilogy(f[k], sp[k] * 100, color=CAT[0], lw=2)
    for i, (fr, lab) in enumerate(((0.8, "wow 0.8 Hz"), (0.2 / (math.pi * 0.004), "capstan 15.9 Hz"))):
        ax.axvline(fr, color=CAT[i + 1], ls=LINE[i + 1], lw=2, label=lab)
    ax.set_title("Read pitch deviation of a 1 kHz tone, head 2", loc="left")
    ax.set_xlabel("modulation rate (Hz)"); ax.set_ylabel("pitch deviation (%)")
    ax.legend(frameon=False, fontsize=12)


def panel_fork(ax):
    steps = np.linspace(-4, 4, 33)
    for i, (br, q) in enumerate(((12, 2.0), (40, 2.0), (40, 8.0), (120, 8.0))):
        t60 = [R.Fork(R.tine_for(196 * 2 ** (s / 12)), 196.0, bar_ratio=br, mount_q=q).tine_mode()[1] for s in steps]
        t60 = np.array(t60) / t60[16]
        ax.plot(steps, t60, color=CAT[i], ls=LINE[i], marker=MARK[i], markevery=4, ms=8, lw=2.2,
                label=f"bar / tine mass {br}, mount Q {q:g}")
    ax.axvspan(-2, 2, color=MUTED, alpha=0.12, label="F to A around G (manual, qualitative)")
    ax.set_title("Sustain against tine detuning from its tone bar (G3)", loc="left")
    ax.set_xlabel("tine detuning (semitones)"); ax.set_ylabel("T60 / T60 tuned")
    ax.set_ylim(0, 1.55)
    ax.legend(frameon=False, fontsize=11, ncol=2, loc="upper center")


def panel_pickup(ax):
    y = 0.5e-3 * np.sin(2 * math.pi * 196 * np.arange(FS) / FS)
    offs = np.linspace(0, 1.5, 151)
    g = R.PICKUP_GAP[0]
    H = np.array([R.harmonics(R.pickup(y, FS, g, o * g), FS, 196.0) for o in offs])
    H = np.maximum(H / H.max(), 1e-6)
    for h in range(3):
        ax.semilogy(offs, H[:, h], color=CAT[h], ls=LINE[h], marker=MARK[h], markevery=15, ms=8, lw=2.2,
                label=f"harmonic {h + 1}")
    ax.set_title("Pickup harmonics against tine offset", loc="left")
    ax.set_xlabel("offset / pickup gap (gap 1/16 in, tip swing 0.5 mm)"); ax.set_ylabel("level relative to the largest"); ax.set_ylim(1e-4, 2)
    ax.legend(frameon=False, fontsize=12)


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    fonts()
    dry = phrase()
    wet = space_echo().render(np.concatenate([dry, np.zeros(3 * FS)]), FS)
    write(out / "rhodes_dry.wav", stereo(dry), FS)
    write(out / "rhodes_space.wav", stereo(wet), FS)
    pl, _ = R.note(293.66, FS, seconds=1.5, offset=0.3)
    pl = np.concatenate([pl * 0.2, np.zeros(int(1.5 * FS))])
    write(out / "echo_speeds.wav", stereo(np.concatenate(
        [TapeEcho(speed=v, mode=1, intensity=0.55).render(pl, FS) for v in (0.12, 0.2, 0.4)])), FS)
    rows, flut = recovery_rows()
    fig = plt.figure(figsize=(19.2, 10.8), dpi=200)
    gs = fig.add_gridspec(2, 3, hspace=0.38, wspace=0.25, left=0.04, right=0.985, top=0.9, bottom=0.07)
    fig.suptitle("Tape loop echo and electric piano tine: physical models read back by their own analyser",
                 x=0.04, ha="left", fontsize=24, color=INK)
    panel_spectrogram(fig.add_subplot(gs[0, 0:2]), wet)
    panel_recovery(fig.add_subplot(gs[0, 2]), rows)
    panel_flutter(fig.add_subplot(gs[1, 0]), flut)
    panel_fork(fig.add_subplot(gs[1, 1]))
    panel_pickup(fig.add_subplot(gs[1, 2]))
    fig.savefig(out / "echo_rhodes_plate.png", dpi=200, facecolor=GROUND)
    fig2 = plt.figure(figsize=(19.2, 10.8), dpi=200)
    panel_impulse(fig2.add_subplot(1, 1, 1))
    fig2.savefig(out / "echo_heads_plate.png", dpi=200, facecolor=GROUND)
    for name, want, got in rows:
        print(f"{name}: planted {want:.6g}, recovered {got:.6g}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "out/echo")
