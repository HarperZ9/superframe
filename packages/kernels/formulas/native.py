# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build every kernel.bld into one shared library and call the exports from Python.

Same route as packages/colourmix: buildc emits C, the system C compiler makes a shared library with
floating-point contraction off, and ctypes calls the exports. The compiler is the BUILDC environment
variable, else `buildc` on PATH. unavailable() returns the reason the kernels cannot be built here, so a
test can skip with that reason, or fail with it when FORMULAS_REQUIRE_NATIVE is set.

Every export has one shape: f64 inputs in the order the spec lists them, then a pointer to the outputs,
returning 0 when accepted or the 1-based index of the refused input.
"""
import ctypes
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from . import FOLDERS, PKG, modules
from .core import Refusal, finite

SENTINEL = -7777777.0
_LIB = None
_WHY = None


def sources():
    """Folder name to BuildLang source text."""
    return {f: (PKG / f / "kernel.bld").read_text(encoding="utf-8") for f in FOLDERS
            if (PKG / f / "kernel.bld").exists()}


def _buildc():
    return os.environ.get("BUILDC") or shutil.which("buildc")


def _cc():
    return os.environ.get("CC") or shutil.which("gcc") or shutil.which("cc") or shutil.which("clang")


def compile_library(texts):
    work = Path(tempfile.mkdtemp(prefix="formulas-bld-"))
    # One file, not modules: buildc prefixes the C names of exports inside a module.
    (work / "main.bld").write_text("\n\n".join(texts.values()), encoding="utf-8")
    r = subprocess.run([_buildc(), "build", "--emit", "c", "--release", str(work)], capture_output=True, text=True)
    c_file = work / "target" / "release" / "main.c"
    if r.returncode != 0 or not c_file.exists():
        tail = (r.stdout + r.stderr).strip().splitlines()[-3:]
        raise RuntimeError("buildc could not compile the formula kernels: " + " | ".join(tail))
    lib = work / ("formulas.dll" if sys.platform == "win32" else "libformulas.so")
    flags = ["-O2", "-ffp-contract=off", "-fno-fast-math", "-shared"] + ([] if sys.platform == "win32" else ["-fPIC"])
    libs = ["-lm"] + (["-lws2_32"] if sys.platform == "win32" else [])
    r = subprocess.run([_cc(), *flags, "-o", str(lib), str(c_file), *libs], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("C compile of the buildc output failed: " + r.stderr[-400:])
    return lib


def unavailable():
    """None when the library is built and loaded; otherwise the reason it is not."""
    global _LIB, _WHY
    if _LIB is not None or _WHY is not None:
        return _WHY
    if not _buildc():
        _WHY = "no buildc (set BUILDC or put buildc on PATH)"
    elif not _cc():
        _WHY = "no C compiler (set CC)"
    else:
        try:
            _LIB = ctypes.CDLL(str(compile_library(sources())))
        except (RuntimeError, OSError) as e:
            _WHY = str(e)
    return _WHY


def pending():
    """Ids whose BuildLang body is not written yet, with the missing compiler feature each one names."""
    return {m.SPEC["id"]: m.SPEC["bld_pending"] for m in modules() if m.SPEC.get("bld_pending")}


def function(mod):
    """The compiled export for one kernel, with the call shape and results of its reference."""
    why = unavailable()
    if why:
        raise RuntimeError(why)
    spec = mod.SPEC
    names = [name for name, _, _ in spec["inputs"]]
    ranges = {name: rng for name, _, rng in spec["inputs"]}
    width = len(spec["outputs"])
    export = getattr(_LIB, spec["export"])
    export.restype = ctypes.c_int32
    export.argtypes = [ctypes.c_double] * len(names) + [ctypes.POINTER(ctypes.c_double)]

    def fn(*args, **kwargs):
        values = dict(zip(names, args), **kwargs)
        for name in names:   # a value C cannot carry as a double is refused here, by name
            v = values.get(name)
            if not isinstance(v, (int, float)) or isinstance(v, bool):
                return Refusal(name, v, ranges[name])
        out = (ctypes.c_double * width)(*([SENTINEL] * width))
        status = export(*[float(values[name]) for name in names], out)
        if status != 0:
            if any(v != SENTINEL for v in out):
                raise AssertionError(f"{spec['id']} wrote an output on a refused call")
            name = names[status - 1]
            return Refusal(name, values[name], ranges[name])
        result = tuple(out)
        if not all(finite(v) for v in result):
            raise AssertionError(f"{spec['id']} accepted a call and returned a value that is not finite")
        return result

    return fn
