# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build the BuildLang kernels in bld/ and call them from Python.

buildc compiles the BuildLang source to C, the system C compiler makes a shared library, and ctypes calls
the exports. The compiler is the BUILDC environment variable, else `buildc` on PATH. unavailable() returns
the reason the kernels cannot be built here, so a test can skip with that reason instead of passing silently.
Kernels has the same function names and return shapes as reference.py.
"""
import ctypes
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from . import PKG
from .reference import i64, point
from .reference_modern import _f64

NAMES = ["mayer", "lambert", "benson", "rgbspace", "transfer", "modern"]
SENTINEL = -7777777
_KERNELS = None
_WHY = None
I64, I32, F64 = ctypes.c_int64, ctypes.c_int32, ctypes.c_double
PI64, PF64 = ctypes.POINTER(ctypes.c_int64), ctypes.POINTER(ctypes.c_double)
SIGNATURES = {   # export name: (result type, argument types)
    "cm_mayer_count": (I64, [I64]), "cm_mayer_mix": (I32, [I64, I64, I64, PI64]),
    "cm_mayer_index": (I64, [I64, I64, I64]), "cm_mayer_cell": (I32, [I64, I64, PI64]),
    "cm_lambert_side": (I64, [I64]), "cm_lambert_count": (I64, [I64]), "cm_lambert_total": (I64, []),
    "cm_lambert_mix": (I32, [I64, I64, I64, PI64]), "cm_benson_count": (I64, [I64]),
    "cm_benson_section": (I32, [I64, I64, I64, I64, I64, PI64]),
    "cm_benson_complement": (I32, [I64, I64, I64, I64, PI64]), "cm_benson_corner": (I64, [I64, I64, I64, I64]),
    "cm_benson_line": (I32, [I64, PI64, I64, I64, PI64]),
    "cm_modern_benson_linear_rgb": (I32, [I64, I64, I64, I64, PF64]),
    "cm_mayer_tab2": (I32, [I64, I64, I64, PI64]), "cm_lichtenberg_mass": (I32, [I64, I64, PI64]),
    "cm_lambert_white": (I32, [I64, PI64]), "cm_lambert_number": (I64, [I64, I64, I64]),
    "cm_modern_rgb_to_xyz": (I32, [I64, I64, F64, F64, F64, PF64]),
    "cm_modern_xyz_to_rgb": (I32, [I64, I64, F64, F64, F64, PF64]),
    "cm_modern_encode": (I32, [I64, F64, PF64]), "cm_modern_decode": (I32, [I64, F64, PF64]),
    "cm_modern_benson_xyz": (I32, [I64, I64, I64, I64, I64, I64, PF64]),
    "cm_modern_benson_encoded": (I32, [I64, I64, I64, I64, I64, PF64]),
}


def sources():
    """Kernel name to BuildLang source text."""
    return {name: (PKG / "bld" / f"{name}.bld").read_text(encoding="utf-8") for name in NAMES}


def _buildc():
    return os.environ.get("BUILDC") or shutil.which("buildc")


def _cc():
    return os.environ.get("CC") or shutil.which("gcc") or shutil.which("cc") or shutil.which("clang")


def compile_library(texts):
    """Compile the given sources (as sources() returns them) into a shared library; return its path."""
    work = Path(tempfile.mkdtemp(prefix="colourmix-bld-"))
    # One file, not modules: buildc prefixes the C names of exports inside a module.
    (work / "main.bld").write_text("\n\n".join(texts[name] for name in NAMES), encoding="utf-8")
    r = subprocess.run([_buildc(), "build", "--emit", "c", "--release", str(work)], capture_output=True, text=True)
    c_file = work / "target" / "release" / "main.c"
    if r.returncode != 0 or not c_file.exists():
        tail = (r.stdout + r.stderr).strip().splitlines()[-3:]
        raise RuntimeError("buildc could not compile the kernels: " + " | ".join(tail))
    lib = work / ("colourmix.dll" if sys.platform == "win32" else "libcolourmix.so")
    flags = ["-O2", "-ffp-contract=off", "-fno-fast-math", "-shared"] + ([] if sys.platform == "win32" else ["-fPIC"])
    libs = ["-lm"] + (["-lws2_32"] if sys.platform == "win32" else [])
    r = subprocess.run([_cc(), *flags, "-o", str(lib), str(c_file), *libs], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("C compile of the buildc output failed: " + r.stderr[-400:])
    return lib


class Kernels:
    """The exports of one compiled library, with the names and return shapes of reference.py."""

    def __init__(self, path):
        self.lib = ctypes.CDLL(str(path))
        for name, (restype, argtypes) in SIGNATURES.items():
            fn = getattr(self.lib, name)
            fn.restype, fn.argtypes = restype, argtypes

    def _args(self, name, args):
        """Each argument checked against the type the export declares: whole number, float or end points."""
        kinds = SIGNATURES[name][1]
        return [a.buf if type(a) is _Ends else (_f64(a) if kind is F64 else i64(a)) for a, kind in zip(args, kinds)]

    def _fill(self, name, args, width, ctype=ctypes.c_int64):
        """Call an export that fills `width` outputs. A buffer changed by a rejected call is reported."""
        out = (ctype * width)(*([SENTINEL] * width))
        status = getattr(self.lib, name)(*self._args(name, args), out)
        values = tuple(out)
        if status != 0:
            return status, (None if all(v == SENTINEL for v in values) else "wrote on reject")
        return status, values

    def _scalar(self, name, *args):
        return getattr(self.lib, name)(*self._args(name, args))

    def _one(self, name, *args):
        status, values = self._fill(name, args, 1, ctypes.c_double)
        return status, (values[0] if status == 0 else values)

    def mayer_count(self, n):
        return self._scalar("cm_mayer_count", n)

    def mayer_mix(self, n, row, col):
        return self._fill("cm_mayer_mix", (n, row, col), 3)

    def mayer_index(self, n, row, col):
        return self._scalar("cm_mayer_index", n, row, col)

    def mayer_cell(self, n, index):
        return self._fill("cm_mayer_cell", (n, index), 2)

    def lambert_side(self, tier):
        return self._scalar("cm_lambert_side", tier)

    def lambert_count(self, tier):
        return self._scalar("cm_lambert_count", tier)

    def lambert_total(self):
        return self._scalar("cm_lambert_total")

    def lambert_mix(self, tier, row, col):
        return self._fill("cm_lambert_mix", (tier, row, col), 3)

    def lambert_white(self, tier):
        return self._fill("cm_lambert_white", (tier,), 2)

    def lambert_number(self, tier, row, col):
        return self._scalar("cm_lambert_number", tier, row, col)

    def mayer_tab2(self, n, row, col):
        return self._fill("cm_mayer_tab2", (n, row, col), 3)

    def lichtenberg_mass(self, row, col):
        return self._fill("cm_lichtenberg_mass", (row, col), 3)

    def benson_count(self, n):
        return self._scalar("cm_benson_count", n)

    def benson_section(self, n, axis, level, u, v):
        return self._fill("cm_benson_section", (n, axis, level, u, v), 3)

    def benson_complement(self, n, r, g, b):
        return self._fill("cm_benson_complement", (n, r, g, b), 3)

    def benson_corner(self, n, r, g, b):
        return self._scalar("cm_benson_corner", n, r, g, b)

    def benson_line(self, n, a, b, steps, k):
        return self._fill("cm_benson_line", (n, _Ends(a, b), steps, k), 3)

    def modern_benson_linear_rgb(self, n, r, g, b):
        return self._fill("cm_modern_benson_linear_rgb", (n, r, g, b), 3, ctypes.c_double)

    def modern_rgb_to_xyz(self, space, white, r, g, b):
        return self._fill("cm_modern_rgb_to_xyz", (space, white, r, g, b), 3, ctypes.c_double)

    def modern_xyz_to_rgb(self, space, white, x, y, z):
        return self._fill("cm_modern_xyz_to_rgb", (space, white, x, y, z), 3, ctypes.c_double)

    def modern_encode(self, space, v):
        return self._one("cm_modern_encode", space, v)

    def modern_decode(self, space, e):
        return self._one("cm_modern_decode", space, e)

    def modern_benson_xyz(self, space, white, n, r, g, b):
        return self._fill("cm_modern_benson_xyz", (space, white, n, r, g, b), 3, ctypes.c_double)

    def modern_benson_encoded(self, space, n, r, g, b):
        return self._fill("cm_modern_benson_encoded", (space, n, r, g, b), 3, ctypes.c_double)


class _Ends:
    """The six end-point levels of a line as a C array, each checked as a 64-bit integer."""

    def __init__(self, a, b):
        self.buf = (ctypes.c_int64 * 6)(*point(a), *point(b))


def unavailable():
    """None when the kernels are built and loaded; otherwise the reason they are not."""
    global _KERNELS, _WHY
    if _KERNELS is not None or _WHY is not None:
        return _WHY
    if not _buildc():
        _WHY = "no buildc (set BUILDC or put buildc on PATH)"
    elif not _cc():
        _WHY = "no C compiler (set CC)"
    else:
        try:
            k = Kernels(compile_library(sources()))
            if k.mayer_mix(12, 5, 2) != (0, (7, 2, 3)):   # an old buildc drops writes through a raw slice
                _WHY = "this buildc does not compile writes through slice::from_raw_parts_mut; use a newer one"
            else:
                _KERNELS = k
        except (RuntimeError, OSError) as e:
            _WHY = str(e)
    return _WHY


def kernels():
    why = unavailable()
    if why:
        raise RuntimeError(why)
    return _KERNELS
