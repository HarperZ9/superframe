# SPDX-License-Identifier: MIT
"""Rebuild every example output, reconcile it, and run the controls.

  python examples/run_all.py           everything available on this machine
  python examples/run_all.py --ci      no raw-native binary, no browser

Steps: raw-native (only when RAW_NATIVE_CLI names its binary; otherwise the
recorded 0.4.0 outputs in reference/ stand in), the numpy port, the Python and
Node sound paths, the browser (only when Playwright is installed; set
SUPERSTACK_GPU=1 for the hardware GPU), the check and the controls.

Exit 1 when a stated expectation fails: the numpy port must be verified
against the reference, the two exact sound paths must MATCH, every receipt
must verify, and every control must fail as stated. Byte identity of the
pixel port is reported, not required, because numpy's float32 cos and sin
differ between platforms.
"""
from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PY = sys.executable
PROOF_RECORDED = {"pixels": "0282ef9cc07a0012da9da3217c164f44d00a3e9f7704ff719770e832c9ca6d44",
                  "sound": "692ead20dfdc1665251a0010a0fea40065adb46c03e841be38b32abe4aa2ac7b"}


def run(*cmd, env=None):
    print("$", " ".join(str(c) for c in cmd), flush=True)
    r = subprocess.run([str(c) for c in cmd], cwd=HERE, env={**os.environ, **(env or {})})
    if r.returncode:
        raise SystemExit(f"step failed with exit {r.returncode}: {cmd}")


def main(argv):
    ci = "--ci" in argv
    raw = os.environ.get("RAW_NATIVE_CLI")
    if raw and not ci:
        run(raw, HERE / "out/raw-native", "--width", 256, "--height", 256)
    run(PY, "pixels/py_backend.py", "pixels/scene.json", "out/python")
    run(PY, "sound/sound_ir.py", "sound/sound.json", "out/sound-reference")
    run("node", "sound/sound_exact.mjs", "sound/sound.json", "out/sound-js-exact")
    if not ci and importlib.util.find_spec("playwright"):
        run(PY, "run_browser.py", env={"SUPERSTACK_GPU": "0"})
        if os.environ.get("SUPERSTACK_GPU") == "1":
            run(PY, "run_browser.py", env={"SUPERSTACK_GPU": "1"})
    sys.path.insert(0, str(HERE))
    import check
    import controls
    report = check.main()
    ok = controls.main()
    py = report["pixels"].get("python")
    if not py or py["tolerance"]["verdict"] != "verified":
        print("EXPECTATION FAILED: numpy port not verified against the reference")
        ok = False
    snd = report["sound"].get("sound-js-exact")
    if not snd or snd["identity"] != "MATCH":
        print("EXPECTATION FAILED: the two exact sound paths differ")
        ok = False
    import json
    for name, key in (("python", "pixels"), ("sound-reference", "sound")):
        rec = json.loads((HERE / "out" / name / "receipt.json").read_text(encoding="utf-8"))
        same = rec["content_sha256"] == PROOF_RECORDED[key]
        print(f"observed: {name} content hash {'equals' if same else 'differs from'} the proof's recorded "
              f"{PROOF_RECORDED[key][:8]} on this platform")
    print("examples:", "all expectations held" if ok else "an expectation failed")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
