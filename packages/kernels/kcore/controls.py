# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""False-success controls: realistic ways a GPU port drifts from the contract.

Each control builds a variant of a kernel that a performance-minded port would plausibly
write, and asks whether the bit-identical comparator flags it. If a control passes the
comparator, the contract is not testing what it claims.
"""
import numpy as np

from kcore.ops import NumpyOps, TorchOps, cuda_available
from kcore.run import run_device


def _blend_variants(inp):
    import torch
    import blend.kernel as K
    ops = TorchOps()
    d = K.prepare(inp, ops)
    x, w, ratio, gain, t = d["x"], d["w"], d["ratio"], d["gain"], d["t"]
    n, c, length = x.shape
    acc = torch.zeros((c, t.shape[0]), dtype=torch.float32, device=x.device)
    per_source = []
    for i in range(n):
        p = t * ratio[i]
        fp = p - length * torch.floor(p / length)
        fp = torch.where(fp >= length, torch.zeros_like(fp), fp)
        i0 = fp.long()
        fr = (fp - i0.double()).float()
        s = x[i][:, i0] * (1 - fr) + x[i][:, (i0 + 1) % length] * fr
        per_source.append(s)
        acc = torch.addcmul(acc, w[i][:, None], s)  # one fused multiply-add per source
    fused = (gain * acc).cpu().numpy()
    tree = (gain * (torch.stack(per_source) * w[:, :, None]).sum(0)).cpu().numpy()
    return {"fused multiply-add accumulation (torch.addcmul)": fused,
            "library reduction order (torch.sum over sources)": tree}


def run(name, rng):
    """[{name, caught, fraction_of_outputs_differing}] for the kernel, CUDA only."""
    if name != "blend" or not cuda_available():
        return []
    import blend.kernel as K
    inp = K.make_inputs(rng, K.CHECK_SIZE)
    good = run_device(K, inp, NumpyOps())["y"]
    out = []
    for label, y in _blend_variants(inp).items():
        out.append({"name": label, "caught": not np.array_equal(y, good),
                    "fraction_differing": float((y != good).mean()),
                    "max_abs": float(np.abs(y - good).max())})
    return out
