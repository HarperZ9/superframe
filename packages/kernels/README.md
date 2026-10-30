# kernels

**Mission.** Kernels all the way down. Every piece of compute that a pipeline here
repeats becomes a kernel built to one contract, so that each new kernel makes the next
one cheaper to build, check and trust. A kernel that gives the same bytes on the CPU and
the GPU lets work move between them on every call, which is what lets the two devices
share the load. The aim is the fastest and the most efficient version of each kernel,
measured in results per second and joules per result, with its answer checked against
a slow reference that anyone can read.

## The contract

Every kernel ships:

1. **A spec** (`<kernel>/SPEC.md`): inputs, outputs, the maths in evaluation order, a
   cost model in bytes and flops, and the open built-in it competes with.
2. **A reference**: slow scalar loops in numpy or Python floats that follow the spec
   line by line.
3. **A fast CPU version**: numpy vectorised, split across threads where the kernel is
   separable (numba is not installed in the venv).
4. **A fast GPU version**: torch CUDA in eager mode, from the same kernel body. Both
   devices run one function written against `kcore/ops.py`, so they execute the same
   IEEE operations in the same order.
5. **An equivalence test** in one of two modes:
   - *bit-identical*: reference, CPU, threaded CPU and CUDA give equal bytes. The kernel
     uses only correctly rounded operations (+ - * /, sqrt, floor, compare, select,
     gather), a fixed reduction order (`kcore/fixed.py` for long sums) and no fused
     multiply-add. Transcendentals are evaluated once on the host and passed in.
   - *tolerance*: the kernel states a ULP or relative bound and the reason for it.
6. **A benchmark** (`kernels bench`): throughput, joules per result from
   `tools/joules`, percent of the roofline ceiling, the open built-in on the same
   machine, and the speed and energy optima across sizes.
7. **A receipt**: JSON with sha256 hashes of every input and output, the device, the
   kernel version and the mode, unsigned so it can be sealed later
   (`receipts/receipts.jsonl`).
8. **A BuildLang port note**: what blocks writing it in BuildLang today.

`kernels check` also runs controls that test the test: a 1-ulp perturbation must fail,
and two realistic GPU ports of `blend` (fused multiply-add accumulation, a library tree
sum) must fail. If a control passed, the contract would not be checking what it says.

## Kernels

| Kernel | Mode | What it does |
|---|---|---|
| `blend` | bit-identical | per-channel weights over N periodic sources, gain, detune by read-rate ratio |
| `advect_diffuse` | bit-identical | semi-Lagrangian advection then explicit diffusion on a periodic 2-D grid |
| `lattice_resample` | bit-identical | sample on a hex or square lattice and reconstruct the pixel grid |
| `spectral_shade` | bit-identical | two materials' n, k mixed per pixel, Fresnel at an angle, then CIE XYZ |
| `fixed_sum` (shared) | bit-identical | power-of-two tree reduction used inside other kernels |

`kernels.json` is the registry; `kernels check` writes each kernel's equivalence result
and output hash into it, and `kernels pipeline` records the composed pipeline.

## Run it

```
kernels.cmd check        # every equivalence test, known answer and control
kernels.cmd pipeline     # blend > resample > shade on all 8 device placements, plus a split call
kernels.cmd bench        # smoke benchmark
kernels.cmd list
```

`kernels.cmd` uses `KERNELS_PY` if set, else the PyTorch CUDA venv at
else `python` (CPU only). Point `KERNELS_PY` at a Python with PyTorch CUDA for the
GPU path. The equivalent direct call is `python -B kernels.py check`.

## Composition

`pipeline.py` chains three kernels: three two-channel source layers are blended, the
blend is resampled onto a hex lattice and reconstructed, and the reconstruction drives a
gold and BK7 spectral shade. Every placement of the three stages on {CPU, CUDA} gives the
same bytes at every stage, and so does a run where `blend` and `spectral_shade` each
split one call 37 % CPU and 63 % GPU (`kcore/run.py`, `run_shared`). That split is the
primitive a dynamic scheduler needs: any fraction gives the same result.

## Efficiency

Speed and energy are both targets. For every kernel and device the benchmark reports
results per second, joules per result, and the percent of the roofline bound
`max(bytes / peak bandwidth, flops / peak flops)` over the measured time. The peaks live
in `kcore/hw.py`, each graded FETCHED, MEMORY or DERIVED; today all are MEMORY or
DERIVED. Where the fastest size and the least-energy size differ, both are reported
with the Pareto front.

Energy is the whole machine (CPU package plus GPU board, about one sample per second)
integrated over each timed window. Any other job running inside the window lands in
those joules, so numbers taken while the machine is busy are labelled
"under load, not valid".

Hardware settings stay as they are. The harness does not change GPU power limits,
clocks or any system setting. A power-limit sweep, which would find the energy-optimal
operating point per kernel, is a later experiment, and it needs the author's approval
because it changes a system setting.

## Where it stands (2026-10-30)

All four kernels pass bit-identical equivalence on reference, CPU, threaded CPU and
CUDA (RTX 4090), with every known answer and control. The eager GPU versions are far
below their roofline bound (0.01 % to 2 % in the smoke run, invalid under load): eager
torch materialises every temporary. The next step for speed is one fused CUDA kernel
per kernel, compiled without contraction (`-fmad=false`) in the same operation order,
so the bits stay fixed while the traffic drops to the cost model.
