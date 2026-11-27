# SPDX-License-Identifier: MIT
"""Paired mutations: prove the vectors catch a broken implementation.

For each entry in tests/mutations.json and each language it names, copy the
implementation, apply the one-line change (the text must occur exactly once),
run that language's vector runner on the copy, and require (a) a non-zero exit
and (b) a FAIL line from the vector file the entry says should catch it. A
mutant that does not build counts as a harness error, never as a catch.

Usage: python tests/mutate.py [--lang py,js,cpp] [--cxx-build DIR]
The C++ leg configures tests/CMakeLists.txt once and rebuilds per mutant.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = {"py": "superstack.py", "js": "superstack.mjs", "cpp": "superstack.hpp"}


def run(cmd, **kw):
    return subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8",
                          errors="replace", **kw)


class Cxx:
    """Configure once with SUPERSTACK_INCLUDE pointing at a scratch folder."""

    def __init__(self, work: Path):
        self.inc = work / "include"
        self.inc.mkdir(parents=True, exist_ok=True)
        self.build = work / "build"
        shutil.copy(ROOT / FILES["cpp"], self.inc / FILES["cpp"])
        r = run(["cmake", "-S", ROOT / "tests", "-B", self.build, f"-DSUPERSTACK_INCLUDE={self.inc}",
                 "-DCMAKE_BUILD_TYPE=Release"])
        if r.returncode:
            raise SystemExit("cmake configure failed:\n" + r.stdout + r.stderr)

    def exe(self) -> Path:
        for p in (self.build / "Release" / "run_vectors.exe", self.build / "run_vectors.exe", self.build / "run_vectors"):
            if p.exists():
                return p
        raise SystemExit("run_vectors binary not found")

    def compile(self, text: str):
        (self.inc / FILES["cpp"]).write_text(text, encoding="utf-8", newline="\n")
        # --clean-first: MSBuild can miss a header rewritten within the same second.
        r = run(["cmake", "--build", self.build, "--config", "Release", "--clean-first"])
        return r.returncode == 0, r.stdout + r.stderr


def runner_cmd(lang, impl: Path, cxx: Cxx | None):
    if lang == "py":
        # -B: no bytecode cache. Python keys its cache on source mtime in whole
        # seconds and size, so two same-length mutants written within one
        # second would load the first one's bytecode for the second.
        return [sys.executable, "-B", ROOT / "tests" / "run_vectors.py", "--impl", impl]
    if lang == "js":
        return ["node", ROOT / "tests" / "run_vectors.mjs", "--impl", impl]
    return [cxx.exe(), ROOT]


def main(argv):
    langs = ["py", "js", "cpp"]
    if "--lang" in argv:
        langs = argv[argv.index("--lang") + 1].split(",")
    mutations = json.loads((ROOT / "tests" / "mutations.json").read_text(encoding="utf-8"))
    problems, caught, total = [], 0, 0
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        cxx = Cxx(work / "cxx") if "cpp" in langs else None
        for lang in langs:
            source = (ROOT / FILES[lang]).read_text(encoding="utf-8")
            impl = work / lang / FILES[lang]
            impl.parent.mkdir(parents=True, exist_ok=True)
            # Baseline: the unmutated copy must pass, or nothing below means anything.
            impl.write_text(source, encoding="utf-8", newline="\n")
            if lang == "cpp":
                ok, log = cxx.compile(source)
                if not ok:
                    raise SystemExit("baseline C++ build failed:\n" + log)
            base = run(runner_cmd(lang, impl, cxx))
            if base.returncode:
                raise SystemExit(f"baseline {lang} run failed:\n{base.stdout}{base.stderr}")
            for m in mutations:
                if lang not in m:
                    continue
                total += 1
                find, repl = m[lang]["find"], m[lang]["replace"]
                if source.count(find) != 1:
                    problems.append(f"{lang} {m['id']}: target text occurs {source.count(find)} times")
                    continue
                mutant = source.replace(find, repl)
                impl = work / lang / m["id"] / FILES[lang]  # a fresh path per mutant
                impl.parent.mkdir(parents=True, exist_ok=True)
                impl.write_text(mutant, encoding="utf-8", newline="\n")
                if lang == "cpp":
                    ok, log = cxx.compile(mutant)
                    if not ok:
                        problems.append(f"cpp {m['id']}: mutant does not build\n{log[-2000:]}")
                        continue
                r = run(runner_cmd(lang, impl, cxx))
                tagged = any(line.startswith(f"FAIL {m['caught_by']}:") for line in r.stdout.splitlines())
                if r.returncode and tagged:
                    caught += 1
                    print(f"caught   {lang:3} {m['id']:24} by {m['caught_by']}")
                else:
                    problems.append(f"{lang} {m['id']}: exit {r.returncode}, FAIL from {m['caught_by']}: {tagged}")
                    print(f"SURVIVED {lang:3} {m['id']}")
                    tail = (r.stdout + r.stderr).strip().splitlines()[-15:]
                    print("\n".join("    | " + line for line in tail))
        if cxx:  # leave the C++ build on the baseline
            cxx.compile((ROOT / FILES["cpp"]).read_text(encoding="utf-8"))
    for p in problems:
        print("PROBLEM", p)
    print(f"mutations: {caught}/{total} caught by their paired vector file")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
