# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build the BuildLang real-time kernels (bld/dsp.bld) and call them from Python, for tests and offline use.

buildc compiles the BuildLang source to C; the system C compiler makes a shared library; ctypes calls the
exports. The compiler is the BUILDC environment variable, else `buildc` on PATH. unavailable() returns the
reason the core cannot be built here (no compiler, or a buildc older than the features the source uses), so
tests can skip with that reason instead of passing silently.
"""
import ctypes
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

from . import PKG

SOURCES = [PKG / "bld" / "dsp.bld", PKG / "bld" / "dsp32.bld", PKG / "bld" / "live.bld"]   # the kernels; bld/main.bld is the host program
_LIB = None
_WHY = None


def _buildc():
    return os.environ.get("BUILDC") or shutil.which("buildc")


def _cc():
    return os.environ.get("CC") or shutil.which("gcc") or shutil.which("cc") or shutil.which("clang")


def _compile(work):
    # One file, not modules: buildc prefixes the C names of exports inside a module (dsp_daw_...).
    text = (chr(10) * 2).join(src.read_text(encoding="utf-8") for src in SOURCES)
    (work / "main.bld").write_text(text, encoding="utf-8")
    r = subprocess.run([_buildc(), "build", "--emit", "c", "--release", str(work)], capture_output=True, text=True)
    c_file = work / "target" / "release" / "main.c"
    if r.returncode != 0 or not c_file.exists():
        tail = (r.stdout + r.stderr).strip().splitlines()[-3:]
        raise RuntimeError("buildc could not compile the kernels: " + " | ".join(tail))
    lib = work / ("engine.dll" if sys.platform == "win32" else "libengine.so")
    # buildc's own release flags: DETMATH (no contraction, no fast maths) and vectorisation with alias checks
    flags = ["-O2", "-ftree-vectorize", "-fvect-cost-model=dynamic", "-ffp-contract=off", "-fno-fast-math",
             "-shared"] + ([] if sys.platform == "win32" else ["-fPIC"])
    libs = ["-lm"] + (["-lws2_32"] if sys.platform == "win32" else [])
    r = subprocess.run([_cc(), *flags, "-o", str(lib), str(c_file), *libs], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("C compile of the buildc output failed: " + r.stderr[-400:])
    return lib


def unavailable():
    """None when the core is built and loaded; otherwise the reason it is not."""
    global _LIB, _WHY
    if _LIB is not None or _WHY is not None:
        return _WHY
    if not _buildc():
        _WHY = "no buildc (set BUILDC or put buildc on PATH)"
    elif not _cc():
        _WHY = "no C compiler (set CC)"
    else:
        try:
            work = Path(tempfile.mkdtemp(prefix="daw-bld-"))
            _LIB = ctypes.CDLL(str(_compile(work)))
        except RuntimeError as e:
            _WHY = str(e)
    return _WHY


def _p(a):
    return np.ascontiguousarray(a, dtype=np.float64).ctypes.data_as(ctypes.POINTER(ctypes.c_double))


def lib():
    why = unavailable()
    if why:
        raise RuntimeError(why)
    return _LIB


def modal_coeffs(freqs, alphas, fs):
    f, a = np.ascontiguousarray(freqs, float), np.ascontiguousarray(alphas, float)
    a1, a2 = np.zeros(len(f)), np.zeros(len(f))
    lib().daw_modal_coeffs(_p(f), _p(a), ctypes.c_size_t(len(f)), ctypes.c_double(fs), _p(a1), _p(a2))
    return a1, a2


def modal_process(a1, a2, b, state, x, period=128):
    """Run the bank over x in periods of `period` frames; state = (y1, y2) arrays, updated in place."""
    y1, y2 = state
    out, n = np.zeros(len(x)), len(a1)
    arrs = [np.ascontiguousarray(v, float) for v in (a1, a2, b)]
    xs = np.ascontiguousarray(x, float)
    for s in range(0, len(x), period):
        m = min(period, len(x) - s)
        xi, oi = xs[s:s + m].copy(), np.zeros(m)
        lib().daw_modal_process(_p(arrs[0]), _p(arrs[1]), _p(arrs[2]), _p(y1), _p(y2), ctypes.c_size_t(n),
                                _p(xi), _p(oi), ctypes.c_size_t(m))
        out[s:s + m] = oi
    return out


def path_linear(x, s0, v, lis, c, fs, n_out):
    xs, y = np.ascontiguousarray(x, float), np.zeros(n_out)
    s0, v, lis = (np.ascontiguousarray(q, float) for q in (s0, v, lis))
    lib().daw_path_linear(_p(xs), ctypes.c_size_t(len(xs)), _p(s0), _p(v), _p(lis), ctypes.c_double(c),
                          ctypes.c_double(fs), _p(y), ctypes.c_size_t(n_out))
    return y


def bank_process(a1, a2, b, voices, modes, start, retrigger, spacing, frames):
    """daw_bank_process over fresh state: `voices` voices of `modes` modes in flat arrays, one output."""
    arrs = [np.ascontiguousarray(v, float) for v in (a1, a2, b)]
    y1, y2, out = np.zeros(voices * modes), np.zeros(voices * modes), np.zeros(frames)
    lib().daw_bank_process(_p(arrs[0]), _p(arrs[1]), _p(arrs[2]), _p(y1), _p(y2), ctypes.c_size_t(voices),
                           ctypes.c_size_t(modes), ctypes.c_int64(start), ctypes.c_int64(retrigger),
                           ctypes.c_int64(spacing), _p(out), ctypes.c_size_t(frames))
    return out


def voice_set(state, v, modes, f1, eta, amp, fs):
    """daw_voice_set on flat arrays state = (a1, a2, b, y1, y2), each voices * modes long, changed in place."""
    lib().daw_voice_set(*(_p(x) for x in state), ctypes.c_size_t(v), ctypes.c_size_t(modes), ctypes.c_double(f1),
                        ctypes.c_double(eta), ctypes.c_double(amp), ctypes.c_double(fs))


def bank_live(state, voices, modes, hits, frames):
    """daw_bank_live over flat state (a1, a2, b, y1, y2); hits[v] is the strike sample this period or -1."""
    out, h = np.zeros(frames), np.ascontiguousarray(hits, float)
    a1, a2, b, y1, y2 = state
    lib().daw_bank_live(_p(a1), _p(a2), _p(b), _p(y1), _p(y2), ctypes.c_size_t(voices), ctypes.c_size_t(modes),
                        _p(h), _p(out), ctypes.c_size_t(frames))
    return out


def bank_f32(state32, voices, modes, hits, frames):
    """daw_bank_f32 over float32 state (a1, a2, b, y1, y2, yb), each voices * modes long, changed in place."""
    f32p = lambda a: a.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
    out, h = np.zeros(frames), np.ascontiguousarray(hits, float)
    lib().daw_bank_f32(*(f32p(a) for a in state32), ctypes.c_size_t(voices), ctypes.c_size_t(modes), _p(h), _p(out),
                       ctypes.c_size_t(frames))
    return out


def voice_strike_at(state, v, modes, f1, eta, amp, x, fs):
    """daw_voice_strike_at: voice v becomes a free bar struck at position x (0 to 1)."""
    lib().daw_voice_strike_at(*(_p(a) for a in state), ctypes.c_size_t(v), ctypes.c_size_t(modes),
                              ctypes.c_double(f1), ctypes.c_double(eta), ctypes.c_double(amp), ctypes.c_double(x),
                              ctypes.c_double(fs))


def bubble_set(state, v, f, delta, amp, fs):
    """daw_bubble_set: one-mode voice v rings at f, decaying at pi f delta per second."""
    lib().daw_bubble_set(*(_p(a) for a in state), ctypes.c_size_t(v), ctypes.c_double(f), ctypes.c_double(delta),
                         ctypes.c_double(amp), ctypes.c_double(fs))
