# FLIP of the hero frame (lw_frame) against its path-traced reference, with native/scripts/rr_flip.py.
# Usage: lw_frame_flip.py RR_FLIP.py REFERENCE.png TEST.png MAP_OUT.png [DOWNSAMPLE]
import sys, json, importlib.util
import numpy as np
from PIL import Image
spec = importlib.util.spec_from_file_location("rr_flip", sys.argv[1]); rr = importlib.util.module_from_spec(spec); spec.loader.exec_module(rr)
ref = np.asarray(Image.open(sys.argv[2]).convert("RGB"), dtype=np.float64) / 255.0
tst = np.asarray(Image.open(sys.argv[3]).convert("RGB"), dtype=np.float64) / 255.0
step = int(sys.argv[5]) if len(sys.argv) > 5 else 1
if step > 1:  # box-downsample both to keep memory in budget; ppd scales with it
    h, w = ref.shape[0] // step * step, ref.shape[1] // step * step
    ref = ref[:h, :w].reshape(h // step, step, w // step, step, 3).mean((1, 3)); tst = tst[:h, :w].reshape(h // step, step, w // step, step, 3).mean((1, 3))
ppd = rr.PPD_DEFAULT / step
m = rr.flip_map(ref, tst, ppd)
out = {"mean": float(m.mean()), "median": float(np.median(m)), "p95": float(np.percentile(m, 95)), "p99": float(np.percentile(m, 99)),
       "pixels": int(m.size), "ppd": ppd, "downsample": step, "reference": sys.argv[2], "test": sys.argv[3]}
Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).save(sys.argv[4])
print(json.dumps(out))
