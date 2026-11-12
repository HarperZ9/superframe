"""Brevity measures per district: narration share and simile density (the story editor's L6 and L4).

    python content/tools/brevity.py content/act1 [file.lwd ...]
Narration share = words in nar: lines / words in nar, line, inst and voice lines.
Similes = "like a", "like an", "as if", "as though", "the way a", "the way one", "the way people",
counted in narration, voices and dialogue, per 1,000 words of those lines. Director's tool.
"""
import re, sys, pathlib

SIMILE = re.compile(r"\b(like an?|as if|as though|the way (?:a|an|one|people))\b", re.I)

def measure(path):
    words = {"nar": 0, "line": 0, "inst": 0, "voice": 0}; sim = 0
    for raw in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^(nar|line|inst|voice):\s?(.*)$", raw)
        if not m:
            continue
        k, v = m.groups()
        v = re.sub(r"\s*\{[^{}]*\}\s*$", "", v)
        if k != "nar" and ": " in v:
            v = v.split(": ", 1)[1]
        words[k] += len(v.split()); sim += len(SIMILE.findall(v))
    total = sum(words.values())
    return total, words["nar"], sim

def main(d, *only):
    files = [pathlib.Path(d) / f for f in only] if only else sorted(pathlib.Path(d).glob("*.lwd"))
    print("| File | Words in lines | Narration share | Similes | Similes per 1,000 |")
    print("|---|---|---|---|---|")
    for f in files:
        t, n, s = measure(f)
        if t:
            print(f"| {f.name} | {t} | {round(100 * n / t)}% | {s} | {round(1000 * s / t, 2)} |")

if __name__ == "__main__":
    main(*sys.argv[1:])
