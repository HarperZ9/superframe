"""Run Articulate check on every extracted prose file and print one table row per district.

    python content/tools/articulate_table.py content/act1/.prose [label]
Counts are pattern hits per 1,000 words as well as raw, so districts of different length compare.
Local only: Articulate's check is a local linter; nothing is sent anywhere. Director's tool.
"""
import json, subprocess, sys, pathlib, collections

def run(path):
    out = subprocess.run(["articulate", "check", "--mode", "literary-fiction/narrate", "--json", str(path)],
                         capture_output=True, text=True, timeout=600)
    return json.loads(out.stdout)["results"][0]

def main(d, label=""):
    rows, kinds = [], collections.Counter()
    for f in sorted(pathlib.Path(d).glob("*.txt")):
        if f.stem == "world":
            continue
        r = run(f)
        words = len(f.read_text(encoding="utf-8").split())
        h, m, l = len(r["high"]), len(r["medium"]), len(r["low"])
        for x in r["high"] + r["medium"]:
            kinds[(x.get("category") or x.get("rule_id") or "?")] += 1
        rows.append((f.stem, words, h, m, l, round((h + m) * 1000 / max(words, 1), 2), r["texture_score"], r["verdict"]))
    print(f"| District {label} | Words | High | Medium | Low | High+Medium per 1,000 words | Texture | Verdict |")
    print("|---|---|---|---|---|---|---|---|")
    for row in rows:
        print("| " + " | ".join(str(x) for x in row) + " |")
    print("\nHigh and medium findings by rule:", ", ".join(f"{k} {v}" for k, v in kinds.most_common()))

if __name__ == "__main__":
    main(*sys.argv[1:])
