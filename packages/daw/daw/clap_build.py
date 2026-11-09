# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build the CLAP instruments (clap/bars.c over the BuildLang kernels, clap/piano.c over clap/piano_table.h, clap/organ.c over clap/organ_table.h) and the test host (clap/host_check.c).

    python -m daw.clap_build OUT_DIR           # writes superframe.clap and host_check(.exe)

buildc compiles bld/*.bld to C exactly as daw.native does, with buildc's release flags (DETMATH: no
contraction, no fast maths), and the system C compiler links that C with the CLAP wrapper into one shared
library. A .clap file is that shared library under the name CLAP hosts look for. The CLAP headers are
vendored in clap/include (MIT, free-audio/clap 1.2.10).
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from . import PKG, native

CLAP = PKG / "clap"
FLAGS = ["-O2", "-ftree-vectorize", "-fvect-cost-model=dynamic", "-ffp-contract=off", "-fno-fast-math"]


def unavailable():
    """None when buildc and a C compiler are present; otherwise the reason the plugin cannot be built here."""
    if not native._buildc():
        return "no buildc (set BUILDC or put buildc on PATH)"
    if not native._cc():
        return "no C compiler (set CC)"
    return None


def _kernels_c(work):
    text = (chr(10) * 2).join(src.read_text(encoding="utf-8") for src in native.SOURCES)
    (work / "main.bld").write_text(text, encoding="utf-8")
    r = subprocess.run([native._buildc(), "build", "--emit", "c", "--release", str(work)], capture_output=True, text=True)
    c_file = work / "target" / "release" / "main.c"
    if r.returncode != 0 or not c_file.exists():
        tail = (r.stdout + r.stderr).strip().splitlines()[-3:]
        raise RuntimeError("buildc could not compile the kernels: " + " | ".join(tail))
    return c_file


def _cc(args):
    r = subprocess.run([native._cc(), *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("C compile failed: " + r.stderr[-600:])


def build(out_dir=None):
    """Build the plugin and the host; return (plugin_path, host_path)."""
    why = unavailable()
    if why:
        raise RuntimeError(why)
    out = Path(out_dir) if out_dir else Path(tempfile.mkdtemp(prefix="daw-clap-"))
    out.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="daw-clap-bld-"))
    kernels = _kernels_c(work)
    win = sys.platform == "win32"
    plugin = out / "superframe.clap"
    host = out / ("host_check.exe" if win else "host_check")
    inc = "-I" + str(CLAP / "include")
    _cc([*FLAGS, "-shared", *([] if win else ["-fPIC", "-fvisibility=hidden"]), inc, "-o", str(plugin),
         str(CLAP / "bars.c"), str(CLAP / "piano.c"), str(CLAP / "organ.c"), str(kernels), "-lm", *(["-lws2_32"] if win else [])])
    _cc(["-O2", inc, "-o", str(host), str(CLAP / "host_check.c"), *([] if win else ["-ldl"])])
    return plugin, host


if __name__ == "__main__":
    p, h = build(sys.argv[1] if len(sys.argv) > 1 else None)
    print(p)
    print(h)
