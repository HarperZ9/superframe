# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""GPU energy from NVML's total-energy counter, through ctypes (no dependency).

Source: Yang, Adamek and Armour 2023 (corpus yang2023-nvidia-smi-parttime) show nvidia-smi and
NVML power readings cover only part of each update period on recent GPUs, so short or bursty work is
mis-measured; the NVML reference (corpus nvml-power-api) documents
nvmlDeviceGetTotalEnergyConsumption, millijoules since driver load, Volta and later.

A window's GPU energy is the counter's difference between its two ends: no sampling, no integration,
no timestamp rounding. power_mw() is kept for comparison with the old method.
"""
import ctypes
import ctypes.util
import os
import time

_lib = None
_handle = None


def _load():
    global _lib, _handle
    if _lib is not None:
        return _lib
    root = os.environ.get("SystemRoot") or os.environ.get("windir")
    path = os.path.join(root, "System32", "nvml.dll") if root else ctypes.util.find_library("nvidia-ml")
    if not path:
        raise OSError("no NVML library found (SystemRoot unset and libnvidia-ml not on the loader path)")
    lib = ctypes.CDLL(path)
    if lib.nvmlInit_v2() != 0:
        raise RuntimeError("nvmlInit_v2 failed")
    h = ctypes.c_void_p()
    if lib.nvmlDeviceGetHandleByIndex_v2(0, ctypes.byref(h)) != 0:
        raise RuntimeError("nvmlDeviceGetHandleByIndex_v2 failed")
    _lib, _handle = lib, h
    return lib


def total_energy_mj():
    """Millijoules since the driver loaded, or None where the card or driver does not support it."""
    try:
        lib = _load()
    except (OSError, RuntimeError):
        return None
    v = ctypes.c_ulonglong()
    return v.value if lib.nvmlDeviceGetTotalEnergyConsumption(_handle, ctypes.byref(v)) == 0 else None


def power_mw():
    lib = _load()
    v = ctypes.c_uint()
    return v.value if lib.nvmlDeviceGetPowerUsage(_handle, ctypes.byref(v)) == 0 else None


def supported():
    return total_energy_mj() is not None


class Window:
    """with Window() as w: ...   then w.joules (None if unsupported) and w.seconds."""

    def __enter__(self):
        self.t0, self.e0 = time.perf_counter(), total_energy_mj()
        return self

    def __exit__(self, *exc):
        self.e1, self.t1 = total_energy_mj(), time.perf_counter()
        self.seconds = self.t1 - self.t0
        self.joules = None if self.e0 is None or self.e1 is None else (self.e1 - self.e0) / 1000.0
        return False
