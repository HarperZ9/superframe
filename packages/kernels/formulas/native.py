# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Build every kernel.bld into one shared library and call the exports from Python.

Same route as packages/colourmix: buildc emits C, the system C compiler makes a shared library with
floating-point contraction off, and ctypes calls the exports. The compiler is the BUILDC environment
variable, else `buildc` on PATH. unavailable() returns the reason the kernels cannot be built here, so a
test can skip with that reason, or fail with it when FORMULAS_REQUIRE_NATIVE is set.

Every export has one shape: the inputs in the order the spec lists them (an f64, or for a name in
SPEC["array_inputs"] a pointer to f64 and an i64 length), then a pointer to the outputs, returning 0 when
accepted or the 1-based index of the refused input. Outputs are laid end to end: one f64 each, or for a name
in SPEC["array_outputs"] as many as the array input it names.
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
SHARED = PKG / "shared.bld"
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
    """Each kernel becomes a module named after its folder, beside the shared helpers; main.bld declares them.
    An extern "C" fn inside a module keeps its own C name (buildlang 12ddf3c1 and later)."""
    work = Path(tempfile.mkdtemp(prefix="formulas-bld-"))
    (work / "shared.bld").write_text(SHARED.read_text(encoding="utf-8"), encoding="utf-8")
    for folder, text in texts.items():
        (work / f"{folder}.bld").write_text(text, encoding="utf-8")
    (work / "main.bld").write_text("".join(f"mod {folder};\n" for folder in texts), encoding="utf-8")
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
    arrays = set(spec.get("array_inputs", ()))
    sized = spec.get("array_outputs", {})          # output name -> the array input whose length it has
    export = getattr(_LIB, spec["export"])
    export.restype = ctypes.c_int32
    argtypes = []
    for name in names:
        argtypes += [ctypes.POINTER(ctypes.c_double), ctypes.c_int64] if name in arrays else [ctypes.c_double]
    export.argtypes = argtypes + [ctypes.POINTER(ctypes.c_double)]

    def carries(name, v):
        """A value C can carry: a double, or for an array input a list or tuple of doubles."""
        def num(x):
            return isinstance(x, (int, float)) and not isinstance(x, bool)
        if name in arrays:
            return isinstance(v, (list, tuple)) and all(num(x) for x in v)
        return num(v)

    def fn(*args, **kwargs):
        values = dict(zip(names, args), **kwargs)
        for name in names:   # a value C cannot carry is refused here, by name
            if not carries(name, values.get(name)):
                return Refusal(name, values.get(name), ranges[name])
        call_args = []
        for name in names:
            v = values[name]
            if name in arrays:
                buf = (ctypes.c_double * max(1, len(v)))(*[float(x) for x in v])
                call_args += [buf, len(v)]
            else:
                call_args.append(float(v))
        widths = [len(values[sized[o]]) if o in sized else 1 for o, _ in spec["outputs"]]
        total = sum(widths)
        out = (ctypes.c_double * max(1, total))(*([SENTINEL] * max(1, total)))
        status = export(*call_args, out)
        if status != 0:
            if any(v != SENTINEL for v in out):
                raise AssertionError(f"{spec['id']} wrote an output on a refused call")
            name = names[status - 1]
            return Refusal(name, values[name], ranges[name])
        flat_out, result, at = list(out)[:total], [], 0
        for (o, _), w in zip(spec["outputs"], widths):
            result.append(tuple(flat_out[at:at + w]) if o in sized else flat_out[at])
            at += w
        if not all(finite(v) for v in flat_out):
            raise AssertionError(f"{spec['id']} accepted a call and returned a value that is not finite")
        return tuple(result)

    return fn
