# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build an instrument and its inserts from a patch record (patches.py).

Engines (what makes one note):
  modal   an arrange.Instrument: a shape of a measured material, struck, plucked or blown. Shape arguments
          are a list in which "@name" stands for materials.material(name). Built exactly as inline code
          builds it, so a recalled patch renders the same bytes.
  piano   three waveguide strings under one felt hammer (waveguide.piano); a harder note has a shorter
          contact (contact / (0.5 + velocity)), so loudness and brightness rise together.
  rhodes  tine and tone bar with a neoprene tip (rhodes.note); hammer speed = velocity * v_max.
  pluck   one waveguide string, plucked at a position, from seeded noise.
  bowed   a bowed string in Helmholtz motion (sustain.bowed) with a bow attack and release.
  floor   coloured noise f^-beta (wind.coloured_noise): room tone, a noise floor.
  pad     a subtractive unison pad (subtractive.pad, gap G14). piano takes "inharmonicity": a number B, or
          "register" for dispersion.piano_b of the note (gap G19).
Every engine but modal passes each note through a DC blocker (a one-pole high pass at DC_HZ): a pluck or a
hammer pushes the string one way, so the waveguide output carries a slow offset that would otherwise take the
peak and leave the audible part quiet after normalisation. Every engine but modal ends a note with a damper: after the held length the note falls with release_t60,
and starts with an optional raised-cosine attack (seconds). Deterministic engines cache their notes by
(pitch, length, velocity); engines that draw noise seed each note from the patch hash and the note itself.
"""
import math
from dataclasses import dataclass, field

import numpy as np
from scipy.signal import butter, lfilter, sosfilt

from . import effects, rhodes, sustain, waveguide, wind
from . import materials as M
from . import superstack as ss
from . import shapes_1d, shapes_2d
from .arrange import Instrument
from .modes import midi_hz
from .tape_echo import TapeEcho, spring_tank

DC_HZ = 20.0

SHAPES = {"String": shapes_1d.String, "Bar": shapes_1d.Bar, "Tube": shapes_1d.Tube,
          "CircularMembrane": shapes_2d.CircularMembrane, "RectPlate": shapes_2d.RectPlate,
          "CircularPlate": shapes_2d.CircularPlate}


def _arg(v):
    return M.material(v[1:]) if isinstance(v, str) and v.startswith("@") else v


def _modal(p):
    shape = SHAPES[p["shape"]](*[_arg(v) for v in p["args"]])
    return Instrument(p.get("label", p["shape"]), shape, p.get("kind", "strike"), tuple(p.get("x_in", (0.23,))),
                      tuple(p.get("x_out", (0.71,))), p.get("tau", 1e-3), p.get("tail", 2.0), p.get("tuned", True))


def _envelope(y, fs, hold, attack, release_t60):
    n = len(y)
    if attack and attack > 0:
        m = min(n, max(1, int(attack * fs)))
        y[:m] *= 0.5 * (1 - np.cos(math.pi * np.arange(m) / m))
    i = int(hold * fs)
    if release_t60 and i < n:
        y[i:] *= np.exp(-6.9078 * np.arange(n - i) / (release_t60 * fs))
    return y


def _piano(p, f, seconds, fs, vel, rng):
    contact = p.get("contact", 3e-3) / (0.5 + vel)
    b = p.get("inharmonicity", 0.0)
    if b == "register":
        from .dispersion import piano_b
        b = piano_b(69 + 12 * math.log2(f / 440.0))
    return waveguide.piano(f, seconds, fs, tuple(p.get("detune_cents", (-0.8, 0.0, 0.9))), p.get("t60", 6.0),
                           contact, fast=True, b=float(b))


def _pad(p, f, seconds, fs, vel, rng):
    from .subtractive import pad
    keys = ("voices", "detune", "shape", "cutoff", "env_amount", "k", "attack", "decay", "sustain", "release",
            "drift", "drift_rate")
    return pad(f, seconds, fs, rng, seconds - p.get("tail", 2.0), **{k: p[k] for k in keys if k in p})


def _rhodes(p, f, seconds, fs, vel, rng):
    v, _ = rhodes.note(f, fs, seconds, max(0.2, vel * p.get("v_max", 2.0)), p.get("shore_a", 50),
                       p.get("offset", 0.25))
    return v


def _pluck(p, f, seconds, fs, vel, rng):
    return waveguide.string(f, seconds, fs, waveguide.pluck(f, fs, rng, p.get("position", 0.2)),
                            p.get("t60", 3.0), fast=True)


def _bowed(p, f, seconds, fs, vel, rng):
    y, _ = sustain.bowed(f, seconds, fs, p.get("beta", 0.127), p.get("bow_velocity", 0.2), p.get("force", 3.0),
                         p.get("loss", 0.995))
    y = y - np.mean(y)
    return y / max(np.max(np.abs(y)), 1e-12)


def _floor(p, f, seconds, fs, vel, rng):
    return wind.coloured_noise(int(seconds * fs), fs, p.get("beta", 2.0), rng, p.get("f_lo", 20.0))


ENGINES = {"piano": (_piano, False), "rhodes": (_rhodes, False), "pluck": (_pluck, True),
           "bowed": (_bowed, False), "floor": (_floor, True), "pad": (_pad, True)}


@dataclass
class Voice:
    """A note maker for one patch, with the arrange.Instrument play() interface."""
    name: str
    engine: str
    params: dict
    key: str
    cache: dict = field(default_factory=dict)

    def play(self, note, fs, seconds_per_beat, rng):
        fn, noisy = ENGINES[self.engine]
        p = self.params
        hold = note.beats * seconds_per_beat
        seconds = hold + p.get("tail", 2.0)
        ck = (round(float(note.pitch), 4), round(hold, 6), round(float(note.velocity), 4))
        if not noisy and ck in self.cache:
            return self.cache[ck]
        sub = np.random.default_rng(ss.xmur3(f"{self.key}:{ck}:{round(float(note.beat), 6)}")) if noisy else None
        y = np.asarray(fn(p, midi_hz(note.pitch), seconds, fs, float(note.velocity), sub), float)
        r = math.exp(-2 * math.pi * DC_HZ / fs)
        y = lfilter([1.0, -1.0], [1.0, -r], y)
        y = y / max(np.max(np.abs(y)), 1e-12) * float(note.velocity)
        y = _envelope(y.copy(), fs, hold, p.get("attack", 0.0), p.get("release_t60", 0.8))
        if not noisy:
            self.cache[ck] = y
        return y


def build(rec):
    from .patches import digest
    if rec["engine"] == "modal":
        return _modal(rec["params"])
    if rec["engine"] not in ENGINES:
        raise KeyError(f"engine {rec['engine']!r}; known: modal, {', '.join(sorted(ENGINES))}")
    return Voice(rec["name"], rec["engine"], rec["params"], digest(rec))


def _filter(kind):
    def run(x, fs, cutoff, order=2):
        return sosfilt(butter(order, cutoff, kind, fs=fs, output="sos"), x)
    return run


def _tape(x, fs, dry=1.0, **kw):
    return TapeEcho(**kw).render(x, fs, dry)


def _spring(x, fs, mix=0.3, **kw):
    return x + mix * spring_tank(x, fs, **kw)


INSERTS = {"tape_echo": _tape, "spring": _spring, "tremolo": effects.tremolo, "lowpass": _filter("lowpass"),
           "highpass": _filter("highpass"), "gain": lambda x, fs, db: x * 10 ** (db / 20)}


def build_inserts(rec):
    out = []
    for name, args in rec.get("inserts") or []:
        if name not in INSERTS:
            raise KeyError(f"insert {name!r}; known: {', '.join(sorted(INSERTS))}")
        out.append(lambda x, fs, _f=INSERTS[name], _a=dict(args): _f(x, fs, **_a))
    return out
