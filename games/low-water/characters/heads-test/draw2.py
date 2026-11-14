"""Blind distinctness test, amendment 1 (heads-test/PROTOCOL.md): face-core crops, tasks A2 and D.

    python heads-test/draw2.py core <bank>                                  needs <bank>/landmarks.json
    python heads-test/draw2.py packet <bank> <seed> <packet dir> <key file>
    python heads-test/draw2.py pool <out.json> <key> <answers> [<key> <answers> ...]
"""
import json, math, random, sys
from pathlib import Path
from PIL import Image
from draw import EXPR, LIGHTS, TWINS, score, wilson


def core_crop(src, lm, dst):
    """Centred between the eyes and the mouth, sized to the eye spacing, grey, contrast stretched."""
    im = Image.open(src).convert("RGBA")
    (ax, ay), (bx, by) = lm["eyes"]; mx, my = lm["mouth"]
    eye_d = math.hypot(bx - ax, by - ay)
    cx, cy = ((ax + bx) / 2 + mx) / 2, ((ay + by) / 2 + my) / 2
    w = 3.4 * eye_d; h = 1.25 * w
    g = im.convert("L"); a = im.getchannel("A")
    vals = sorted(v for v, al in zip(g.getdata(), a.getdata()) if al > 128)
    lo, hi = vals[int(len(vals) * 0.02)], vals[int(len(vals) * 0.98)]
    g = g.point(lambda v: max(0, min(255, int((v - lo) * 255 / max(1, hi - lo)))))
    flat = Image.composite(g, Image.new("L", im.size, 128), a.point(lambda v: 255 if v > 128 else 0))
    big = Image.new("L", (im.width * 3, im.height * 3), 128); big.paste(flat, (im.width, im.height))
    box = (int(cx - w / 2 + im.width), int(cy - h / 2 + im.height), int(cx + w / 2 + im.width), int(cy + h / 2 + im.height))
    dst.parent.mkdir(parents=True, exist_ok=True)
    big.crop(box).resize((256, 320), Image.LANCZOS).save(dst)


def cmd_core(bank):
    bank = Path(bank); L = json.loads((bank / "landmarks.json").read_text(encoding="utf8")); n = 0
    for f in sorted((bank / "face").glob("*/*.png")):
        who, expr = f.parent.name, f.stem.split("-")[0]
        core_crop(f, L[who][expr], bank / "core" / who / f.name); n += 1
    print("core crops", n)


def cmd_packet(bank, seed, pdir, keyfile):
    rng = random.Random(int(seed)); bank, pdir = Path(bank), Path(pdir); pdir.mkdir(parents=True, exist_ok=False)
    people = sorted(p.name for p in (bank / "core").iterdir() if p.is_dir()); names = set()

    def put(path):
        while True:
            n = "%08x.png" % rng.getrandbits(32)
            if n not in names:
                names.add(n); break
        Image.open(path).save(pdir / n); return n

    core = lambda w, e, l: bank / "core" / w / f"{e}-{l}.png"
    key = {"seed": int(seed), "A2": [], "D": []}
    lines = ["# Viewer instructions", "",
             "You are looking at grey close-ups of faces of characters from a video game. Open each image with the Read tool, using the full paths given. Use no other tool: do not list folders, search, or open any other file.", "",
             "## Task A2: same person or different person", "",
             "Each item shows two face close-ups. Light and expression may differ. Decide whether the two faces belong to the SAME person or to two DIFFERENT people. Give a confidence from 1 (a guess) to 3 (sure).", ""]
    items = [("same", w) for w in rng.sample(people, 12)]
    while len([i for i in items if i[0] == "diff"]) < 12:
        a, b = rng.sample(people, 2)
        if frozenset((a, b)) in TWINS or any(i[0] == "diff" and set(i[1]) == {a, b} for i in items):
            continue
        items.append(("diff", (a, b)))
    rng.shuffle(items)
    for k, (kind, who) in enumerate(items, 1):
        e1, e2 = rng.sample(EXPR, 2) if kind == "same" else (rng.choice(EXPR), rng.choice(EXPR))
        a, b = (who, who) if kind == "same" else who
        l1, l2 = rng.sample(LIGHTS, 2)
        left, right = put(core(a, e1, l1)), put(core(b, e2, l2))
        key["A2"].append({"id": f"A{k:02d}", "kind": kind, "left": [a, e1, l1], "right": [b, e2, l2]})
        lines.append(f"- A{k:02d}: {pdir / left}  and  {pdir / right}")
    lines += ["", "## Task D: how many different people", "",
              "Each item shows six face close-ups. Some may be the same person seen in a different light, and some may be different people. Say how many different people you believe the six pictures show, from 1 to 6.", ""]
    for k in range(1, 5):
        while True:
            six = rng.sample(people, 6)
            if not any(frozenset((x, y)) in TWINS for x in six for y in six if x < y):
                break
        files = [put(core(w, "neutral", rng.choice(LIGHTS))) for w in six]
        key["D"].append({"id": f"D{k}", "who": six})
        lines.append(f"- D{k}: " + "  ".join(str(pdir / f) for f in files))
    lines += ["", "## Your answer", "", "End your reply with one JSON object and nothing after it, in this form:",
              '{"A2": {"A01": ["SAME", 2], "A02": ["DIFFERENT", 3], ...}, "D": {"D1": 4, "D2": 6, ...}}', "Answer every item."]
    (pdir / "INSTRUCTIONS.md").write_text("\n".join(lines), encoding="utf8")
    Path(keyfile).parent.mkdir(parents=True, exist_ok=True); Path(keyfile).write_text(json.dumps(key, indent=1), encoding="utf8")
    print("packet2", pdir)


def cmd_pool(out, *pairs):
    A2, D, per = [], [], []
    for kf, af in zip(pairs[::2], pairs[1::2]):
        key = json.loads(Path(kf).read_text(encoding="utf8")); ans = json.loads(Path(af).read_text(encoding="utf8"))
        a = score({"A": key["A2"], "B": [], "C": []}, {"A": ans["A2"], "B": {}, "C": {}})["A"]
        d = [{**it, "said": int(ans["D"].get(it["id"], 0))} for it in key["D"]]
        A2 += [{**i, "viewer_seed": key["seed"]} for i in a]; D += [{**i, "viewer_seed": key["seed"]} for i in d]
        per.append({"seed": key["seed"], "A2": round(sum(i["ok"] for i in a) / len(a), 3), "D_mean": sum(i["said"] for i in d) / len(d)})
    same = [i for i in A2 if i["kind"] == "same"]; diff = [i for i in A2 if i["kind"] == "diff"]

    def w(L):
        k, n = sum(i["ok"] for i in L), len(L); p, lo, hi = wilson(k, n)
        return {"correct": k, "n": n, "p": round(p, 3), "wilson95": [round(lo, 3), round(hi, 3)]}

    xs = [i["said"] / 6 for i in D]; m = sum(xs) / len(xs); sd = (sum((x - m) ** 2 for x in xs) / (len(xs) - 1)) ** 0.5
    t = {12: 2.201, 8: 2.365, 4: 3.182}.get(len(xs), 2.0); h = t * sd / len(xs) ** 0.5
    res = {"A2": w(A2), "A2_same": w(same), "A2_diff": w(diff),
           "D": {"mean_fraction": round(m, 3), "ci95": [round(m - h, 3), round(m + h, 3)], "grids": len(xs), "answers": [i["said"] for i in D]}}
    res["A2_pass"] = res["A2"]["wilson95"][0] >= 0.70 and res["A2_same"]["p"] >= 0.70 and res["A2_diff"]["p"] >= 0.70
    Path(out).write_text(json.dumps({"per_viewer": per, "pooled": res, "items": {"A2": A2, "D": D}}, indent=1), encoding="utf8")
    print(json.dumps({"per_viewer": per, "pooled": res}, indent=1))


if __name__ == "__main__":
    c, *a = sys.argv[1:]
    {"core": cmd_core, "packet": cmd_packet, "pool": cmd_pool}[c](*a)
