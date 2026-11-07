# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Compile a CUDA C kernel at run time and launch it on torch tensors, with no compiler installed.

torch's CUDA wheels ship NVIDIA's run-time compiler (nvrtc) and the display driver ships the CUDA driver
library, so ctypes can reach both: nvrtc turns kernel source into PTX, the driver loads the PTX into the
context torch already made current and launches it on torch's current stream. Nothing here is imported
unless a CUDA kernel is asked for, so the CPU path needs neither torch nor a GPU.
"""
import ctypes
import glob
import os
import sys


def _load(names):
    for name in names:
        try:
            return ctypes.CDLL(name)
        except OSError:
            continue
    raise OSError(f"none of {names} could be loaded")


def _nvrtc_lib():
    import torch
    libdir = os.path.join(os.path.dirname(torch.__file__), "lib")
    pat = "nvrtc64_*.dll" if sys.platform == "win32" else "libnvrtc*.so*"
    found = sorted(glob.glob(os.path.join(libdir, pat)))
    if not found:   # Linux wheels keep nvrtc in the nvidia-cuda-nvrtc package
        import nvidia.cuda_nvrtc as pkg  # type: ignore
        found = sorted(glob.glob(os.path.join(os.path.dirname(pkg.__file__), "lib", "libnvrtc.so*")))
    return _load(found)


def _driver_lib():
    return _load(["nvcuda.dll"] if sys.platform == "win32" else ["libcuda.so.1", "libcuda.so"])


def _check(code, what):
    if code != 0:
        raise RuntimeError(f"{what} failed with CUDA error {code}")


class Kernel:
    """One __global__ function from CUDA C source. Arguments are passed by type: torch tensors as device
    pointers, Python ints as int32, floats as float32."""

    def __init__(self, source, name):
        import torch
        self.torch = torch
        torch.cuda.init()
        torch.zeros(1, device="cuda")                       # makes torch's primary context current
        major, minor = torch.cuda.get_device_capability()
        ptx = _compile(source, name, f"--gpu-architecture=compute_{major}{minor}")
        drv = _driver_lib()
        self._drv = drv
        mod = ctypes.c_void_p()
        _check(drv.cuModuleLoadData(ctypes.byref(mod), ctypes.c_char_p(ptx)), "cuModuleLoadData")
        fn = ctypes.c_void_p()
        _check(drv.cuModuleGetFunction(ctypes.byref(fn), mod, name.encode()), "cuModuleGetFunction")
        self._mod, self._fn = mod, fn

    def __call__(self, grid, block, *args):
        t = self.torch
        holders = []
        for a in args:
            if isinstance(a, t.Tensor):
                if not (a.is_cuda and a.is_contiguous()):
                    raise ValueError("kernel tensors must be contiguous CUDA tensors")
                holders.append(ctypes.c_void_p(a.data_ptr()))
            elif isinstance(a, bool) or isinstance(a, int):
                holders.append(ctypes.c_int(int(a)))
            elif isinstance(a, float):
                holders.append(ctypes.c_float(a))
            else:
                raise TypeError(f"unsupported kernel argument {type(a)}")
        params = (ctypes.c_void_p * len(holders))(*[ctypes.cast(ctypes.pointer(h), ctypes.c_void_p) for h in holders])
        stream = ctypes.c_void_p(t.cuda.current_stream().cuda_stream)
        g = tuple(grid) + (1,) * (3 - len(grid))
        b = tuple(block) + (1,) * (3 - len(block))
        _check(self._drv.cuLaunchKernel(self._fn, *[ctypes.c_uint(v) for v in g], *[ctypes.c_uint(v) for v in b],
                                        ctypes.c_uint(0), stream, params, None), "cuLaunchKernel")


def _compile(source, name, arch):
    lib = _nvrtc_lib()
    prog = ctypes.c_void_p()
    _check(lib.nvrtcCreateProgram(ctypes.byref(prog), source.encode(), f"{name}.cu".encode(), 0, None, None),
           "nvrtcCreateProgram")
    opts = [arch.encode()]
    arr = (ctypes.c_char_p * len(opts))(*opts)
    code = lib.nvrtcCompileProgram(prog, len(opts), arr)
    if code != 0:
        size = ctypes.c_size_t()
        lib.nvrtcGetProgramLogSize(prog, ctypes.byref(size))
        log = ctypes.create_string_buffer(size.value)
        lib.nvrtcGetProgramLog(prog, log)
        raise RuntimeError(f"nvrtc could not compile {name}:\n{log.value.decode(errors='replace')}")
    size = ctypes.c_size_t()
    _check(lib.nvrtcGetPTXSize(prog, ctypes.byref(size)), "nvrtcGetPTXSize")
    ptx = ctypes.create_string_buffer(size.value)
    _check(lib.nvrtcGetPTX(prog, ptx), "nvrtcGetPTX")
    lib.nvrtcDestroyProgram(ctypes.byref(prog))
    return ptx.value
