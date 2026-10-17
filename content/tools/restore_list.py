"""Nodes that lost most of their words between two versions of a district, before and after.

    python content/tools/restore_list.py content/act1/.orig3/quay.lwd content/act1/quay.lwd 0.4 > out.txt
For the story editor's T1: read each, and restore the line that was doing the work. Also lists
check-success nodes whose only content is a voice gated at the check's own target (editor T4).
Director's tool.
"""
import re, sys

KEYS = ("nar", "line", "inst", "voice")

def nodes(path):
    s = open(path, encoding="utf-8").read(); out = {}
    for m in re.finditer(r"^@node (\S+)\n(.*?)(?=^@|\Z)", s, re.S | re.M):
        out[m.group(1)] = m.group(2)
    return out

def prose(body):
    return [l for l in body.splitlines() if l.split(":", 1)[0] in KEYS]

def words(lines):
    return sum(len(re.sub(r"\{[^{}]*\}\s*$", "", l.split(":", 1)[1]).split()) for l in lines)

def main(old, new, frac="0.4"):
    o, n = nodes(old), nodes(new); frac = float(frac); hits = 0
    for nid, body in o.items():
        if nid not in n: continue
        a, b = prose(body), prose(n[nid]); wa, wb = words(a), words(b)
        if wa >= 12 and wb < wa * (1 - frac):
            hits += 1
            print(f"== {nid}  ({wa} -> {wb} words)")
            print("  BEFORE:"); [print("    " + l) for l in a]
            print("  AFTER:"); [print("    " + l) for l in b]
    # T4: check targets whose success node holds only a voice gated at the check's own dc
    s = open(new, encoding="utf-8").read()
    for m in re.finditer(r'^check: "[^"]*" -> (\S+) / \S+.*\{[^}]*skill: (\w+), dc: (\d+)', s, re.M):
        ok, skill, dc = m.groups()
        body = n.get(ok, "")
        pl = prose(body)
        if pl and all(l.startswith("voice:") for l in pl) and all(f"dc: {dc}" in l for l in pl):
            print(f"!! T4: {ok} holds only voices gated at dc {dc} ({skill}); a strained pass may show nothing")
    print(f"\n{hits} nodes lost more than {int(frac*100)} percent")

if __name__ == "__main__":
    main(*sys.argv[1:])
