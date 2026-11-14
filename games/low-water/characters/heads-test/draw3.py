"""Blind test, amendment 2: task E, old portrait against new at the talk panel's 720p size.

    python heads-test/draw3.py packet <old portraits> <new portraits> <seed> <packet dir> <key file>
    python heads-test/draw3.py pool <out.json> <key> <answers> [<key> <answers> ...]

Per viewer 12 people; per person E1 and E2 on the neutral paraffin pair, E3 on a pair in one
expression (wary, startled or set) drawn at random. Sides at random per pair. The viewer is told
neither which is old nor that one is a revision.
"""
import json, random, sys
from pathlib import Path
from PIL import Image
from draw import wilson

BG = (58, 36, 22)  # .pframe mid stop
PANEL = (161, 201)


def panel(path):
    im = Image.open(path).convert("RGBA")
    base = Image.new("RGBA", im.size, BG + (255,))
    return Image.alpha_composite(base, im).convert("RGB").resize(PANEL, Image.LANCZOS)


def cmd_packet(old, new, seed, pdir, keyfile):
    rng = random.Random(int(seed)); old, new, pdir = Path(old), Path(new), Path(pdir); pdir.mkdir(parents=True, exist_ok=False)
    people = sorted(p.name for p in new.iterdir() if p.is_dir() and (old / p.name).is_dir()); names = set()

    def put(img):
        while True:
            n = "%08x.png" % rng.getrandbits(32)
            if n not in names:
                names.add(n); break
        img.save(pdir / n); return n

    key = {"seed": int(seed), "E": []}
    lines = ["# Viewer instructions", "",
             "You are looking at portraits of characters from a video game, at the size they appear beside the dialogue. Open each image with the Read tool, using the full paths given. Use no other tool: do not list folders, search, or open any other file.", "",
             "Each item shows two portraits of the same character, LEFT and RIGHT. Answer the question asked for that item with LEFT or RIGHT. There is no right answer; give your own judgement.", ""]
    k = 0
    for w in rng.sample(people, 12):
        expr = rng.choice(["wary", "startled", "set"])
        for q, (exp, text) in {"E1": ("neutral", "Which reads more like a real person?"),
                               "E2": ("neutral", "Which would you rather talk to in a game?"),
                               "E3": (expr, "Both show the same expression. Which shows the emotion more clearly?")}.items():
            k += 1
            new_left = rng.random() < 0.5
            a, b = (new, old) if new_left else (old, new)
            L, R = put(panel(a / w / f"{exp}-paraffin.png")), put(panel(b / w / f"{exp}-paraffin.png"))
            key["E"].append({"id": f"E{k:02d}", "q": q, "who": w, "expr": exp, "new": "LEFT" if new_left else "RIGHT"})
            lines.append(f"- E{k:02d}: {text}  LEFT {pdir / L}  RIGHT {pdir / R}")
    lines += ["", "## Your answer", "", "End your reply with one JSON object and nothing after it, in this form:",
              '{"E": {"E01": "LEFT", "E02": "RIGHT", ...}}', "Answer every item."]
    (pdir / "INSTRUCTIONS.md").write_text("\n".join(lines), encoding="utf8")
    Path(keyfile).parent.mkdir(parents=True, exist_ok=True); Path(keyfile).write_text(json.dumps(key, indent=1), encoding="utf8")
    print("packet E", pdir, len(key["E"]), "items")


def cmd_pool(out, *pairs):
    items, per = [], []
    for kf, af in zip(pairs[::2], pairs[1::2]):
        key = json.loads(Path(kf).read_text(encoding="utf8")); ans = json.loads(Path(af).read_text(encoding="utf8"))
        sc = [{**it, "said": (ans["E"].get(it["id"]) or "").upper(), "viewer_seed": key["seed"]} for it in key["E"]]
        for i in sc:
            i["chose_new"] = i["said"] == i["new"]
        items += sc
        per.append({"seed": key["seed"], **{q: sum(i["chose_new"] for i in sc if i["q"] == q) for q in ("E1", "E2", "E3")}})
    res = {}
    for q in ("E1", "E2", "E3"):
        L = [i for i in items if i["q"] == q]; k = sum(i["chose_new"] for i in L); p, lo, hi = wilson(k, len(L))
        res[q] = {"new_chosen": k, "n": len(L), "p": round(p, 3), "wilson95": [round(lo, 3), round(hi, 3)], "pass": lo > 0.5}
    by = {}
    for i in items:
        by.setdefault(i["who"], [0, 0]); by[i["who"]][0] += i["chose_new"]; by[i["who"]][1] += 1
    res["per_person_new_of_n"] = {w: f"{a}/{n}" for w, (a, n) in sorted(by.items())}
    Path(out).write_text(json.dumps({"per_viewer": per, "pooled": res, "items": items}, indent=1), encoding="utf8")
    print(json.dumps({"per_viewer": per, "pooled": res}, indent=1))


if __name__ == "__main__":
    c, *a = sys.argv[1:]
    {"packet": cmd_packet, "pool": cmd_pool}[c](*a)
