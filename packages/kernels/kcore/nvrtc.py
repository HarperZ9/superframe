# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Compile CUDA C with NVRTC and launch it through the driver API, by ctypes (no dependency).

Bit-identical kernels compile with --fmad=false --prec-div=true --prec-sqrt=true --ftz=false, so every
+ - * / and sqrt is one correctly rounded IEEE operation with denormals kept, the same as numpy.
Uses the NVRTC that ships with torch and the context torch has made current.
"""
import ctypes
import os

STRICT = ["--gpu-architecture=compute_89", "--fmad=false", "--prec-div=true", "--prec-sqrt=true",
          "--ftz=false", "--std=c++17"]
_nvrtc = _cu = None


def _libs():
    global _nvrtc, _cu
    if _nvrtc is None:
        import torch
        lib = os.path.join(os.path.dirname(torch.__file__), "lib")
        os.add_dll_directory(lib)
        _nvrtc = ctypes.CDLL(os.path.join(lib, "nvrtc64_120_0.dll"))
        _cu = ctypes.CDLL(os.path.join(os.environ["SystemRoot"], "System32", "nvcuda.dll"))
        torch.zeros(1, device="cuda")  # makes torch's primary context current
    return _nvrtc, _cu


def _check(code, what):
    if code != 0:
        raise RuntimeError(f"{what} returned {code}")


def compile_ptx(src, name="kernel.cu", options=STRICT):
    nv, _ = _libs()
    prog = ctypes.c_void_p()
    _check(nv.nvrtcCreateProgram(ctypes.byref(prog), src.encode(), name.encode(), 0, None, None),
           "nvrtcCreateProgram")
    opts = (ctypes.c_char_p * len(options))(*[o.encode() for o in options])
    rc = nv.nvrtcCompileProgram(prog, len(options), opts)
    size = ctypes.c_size_t()
    nv.nvrtcGetProgramLogSize(prog, ctypes.byref(size))
    log = ctypes.create_string_buffer(size.value)
    nv.nvrtcGetProgramLog(prog, log)
    if rc != 0:
        raise RuntimeError(f"NVRTC compile failed: {log.value.decode(errors='replace')}")
    nv.nvrtcGetPTXSize(prog, ctypes.byref(size))
    ptx = ctypes.create_string_buffer(size.value)
    _check(nv.nvrtcGetPTX(prog, ptx), "nvrtcGetPTX")
    nv.nvrtcDestroyProgram(ctypes.byref(prog))
    return ptx.raw


class Kernel:
    def __init__(self, src, fn, options=STRICT):
        _, cu = _libs()
        self.ptx = compile_ptx(src, options=options)
        self.options = list(options)
        mod, f = ctypes.c_void_p(), ctypes.c_void_p()
        _check(cu.cuModuleLoadData(ctypes.byref(mod), self.ptx), "cuModuleLoadData")
        _check(cu.cuModuleGetFunction(ctypes.byref(f), mod, fn.encode()), "cuModuleGetFunction")
        self.mod, self.f = mod, f

    def launch(self, grid, block, args, stream=0):
        """args: list of ctypes values (c_void_p for device pointers, c_int, c_float)."""
        _, cu = _libs()
        arr = (ctypes.c_void_p * len(args))(*[ctypes.cast(ctypes.pointer(a), ctypes.c_void_p) for a in args])
        _check(cu.cuLaunchKernel(self.f, grid, 1, 1, block, 1, 1, 0, ctypes.c_void_p(stream), arr, None),
               "cuLaunchKernel")
