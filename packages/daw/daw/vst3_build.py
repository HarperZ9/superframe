# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build the VST3 bundle (vst3/vst3.c over the CLAP instruments) and the VST3 test host (vst3/host_vst3.c).

    python -m daw.vst3_build OUT_DIR           # writes superframe.vst3/ and host_vst3(.exe)

The bundle follows the VST3 layout: superframe.vst3/Contents/x86_64-win/superframe.vst3 on Windows and
superframe.vst3/Contents/x86_64-linux/superframe.so on Linux. Its binary holds the same instruments as
superframe.clap (the same C files and BuildLang kernels, built with the same flags) behind the VST3 C API from
steinbergmedia/vst3_c_api v3.8.1_build_84 (BSD 3-clause), vendored in vst3/include with its licence.
"""
import sys
import tempfile
from pathlib import Path

from . import PKG
from .clap_build import CLAP, FLAGS, _cc, _kernels_c, unavailable

VST3 = PKG / "vst3"


def build(out_dir=None):
    """Build the bundle and the host; return (module_path, host_path)."""
    why = unavailable()
    if why:
        raise RuntimeError(why)
    out = Path(out_dir) if out_dir else Path(tempfile.mkdtemp(prefix="daw-vst3-"))
    win = sys.platform == "win32"
    arch = out / "superframe.vst3" / "Contents" / ("x86_64-win" if win else "x86_64-linux")
    arch.mkdir(parents=True, exist_ok=True)
    module = arch / ("superframe.vst3" if win else "superframe.so")
    host = out / ("host_vst3.exe" if win else "host_vst3")
    kernels = _kernels_c(Path(tempfile.mkdtemp(prefix="daw-vst3-bld-")))
    inc = ["-I" + str(CLAP / "include"), "-I" + str(VST3 / "include")]
    _cc([*FLAGS, "-shared", *([] if win else ["-fPIC", "-fvisibility=hidden"]), *inc, "-o", str(module),
         str(VST3 / "vst3.c"), str(CLAP / "bars.c"), str(CLAP / "piano.c"), str(CLAP / "organ.c"), str(kernels),
         "-lm", *(["-lws2_32"] if win else [])])
    _cc(["-O2", *inc, "-o", str(host), str(VST3 / "host_vst3.c"), *([] if win else ["-ldl"])])
    return module, host


if __name__ == "__main__":
    m, h = build(sys.argv[1] if len(sys.argv) > 1 else None)
    print(m)
    print(h)
