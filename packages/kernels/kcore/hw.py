# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Published peak figures for the roofline, each graded by where the number came from.

FETCHED: read from the vendor's page during this work, with the URL.
MEMORY:  recalled, not re-read; treat as approximate until someone fetches it.
DERIVED: computed from other figures here, with the formula.
"""

SPECS = {
    "cuda": {
        "device": "NVIDIA GeForce RTX 4090 (AD102, 128 SMs, 24 GB GDDR6X)",
        "mem_bw_GBs": (1008.0, "MEMORY", "384-bit GDDR6X at 21 Gbps: 21 * 384 / 8 = 1008 GB/s"),
        "fp32_GFLOPs": (82580.0, "MEMORY", "16384 CUDA cores * 2 * 2.52 GHz boost"),
        "fp64_GFLOPs": (1290.0, "DERIVED", "fp32 / 64 (AD102 FP64 rate is 1/64 of FP32)"),
    },
    "cpu": {
        "device": "Intel Core i7-13700KF (8 P-cores, 8 E-cores, 24 threads)",
        "mem_bw_GBs": (89.6, "MEMORY", "Intel ARK max memory bandwidth, DDR5-5600 dual channel"),
        "fp64_GFLOPs": (906.0, "DERIVED",
                        "AVX2 FMA: 8 P * 16 flop/cycle * 5.4 GHz + 8 E * 8 flop/cycle * 4.2 GHz (clocks MEMORY)"),
        "fp32_GFLOPs": (1812.0, "DERIVED", "2 * fp64 (twice the lanes per vector)"),
    },
}


def peaks(device, dtype_bits):
    s = SPECS[device]
    flops = s["fp32_GFLOPs"] if dtype_bits == 32 else s["fp64_GFLOPs"]
    return s["mem_bw_GBs"][0] * 1e9, flops[0] * 1e9, (s["mem_bw_GBs"][1], flops[1])


def roofline_pct(device, dtype_bits, bytes_, flops, seconds):
    """Percent of the roofline bound: the time the hardware could at best need for this
    traffic and arithmetic, max(bytes / BW, flops / F), over the measured time. A kernel
    at 100 % is at the ceiling; the model's byte and flop counts are analytic, so this
    is an estimate of headroom, not a measurement of either resource."""
    bw, fl, grades = peaks(device, dtype_bits)
    bound = max(bytes_ / bw, flops / fl)
    return 100.0 * bound / seconds, ("memory" if bytes_ / bw >= flops / fl else "compute"), grades
