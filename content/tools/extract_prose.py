"""Extract the spoken and narrated lines from LWD files, without markup, for Articulate.

    python content/tools/extract_prose.py content/act1 content/act1/.prose
Writes one <district>.txt per .lwd file (narration, character lines, instrument and voice lines,
and the words Lamb chooses), one line per paragraph, speaker names removed. Director's tool.
"""
import re, sys, pathlib

KEYS = ("nar", "line", "inst", "voice", "opt", "check", "claim")

def prose(text):
    out = []
    for raw in text.splitlines():
        m = re.match(r"^(\w+):\s?(.*)$", raw)
        if not m or m.group(1) not in KEYS:
            continue
        key, v = m.groups()
        v = re.sub(r"\s*\{[^{}]*\}\s*$", "", v)          # trailing attribute block
        if key in ("opt", "check", "claim"):
            q = re.match(r'^"([^"]*)"', v)
            if not q:
                continue
            v = re.sub(r"^\[[A-Z .]+\]\s*", "", q.group(1))  # the [VOICE] tag on checks
        elif key in ("line", "inst", "voice"):
            v = v.split(": ", 1)[1] if ": " in v else v       # speaker or voice id
        v = re.sub(r"\{\{[^}]*\}\}", "some", v).strip()
        if v.startswith("SHELF:"):
            v = v[6:].strip()
        if v:
            out.append(v)
    return out

def main(src, dst):
    src, dst = pathlib.Path(src), pathlib.Path(dst)
    dst.mkdir(parents=True, exist_ok=True)
    for f in sorted(src.glob("*.lwd")):
        lines = prose(f.read_text(encoding="utf-8"))
        if lines:
            (dst / (f.stem + ".txt")).write_text("\n\n".join(lines) + "\n", encoding="utf-8")
            print(f"{f.stem}: {len(lines)} lines, {sum(len(l.split()) for l in lines)} words")

if __name__ == "__main__":
    main(*sys.argv[1:3])
