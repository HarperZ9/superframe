"""Blind distinctness test (heads-test/PROTOCOL.md): crops, viewer packets, scoring.

    python heads-test/draw.py crop  <bank>                         face crops from stimuli.mjs renders
    python heads-test/draw.py packet <bank> <portraits> <seed> <packet dir> <key file>
    python heads-test/draw.py score <key file> <answers file>      prints and returns the scores
    python heads-test/draw.py pool <out.json> <key> <answers> [<key> <answers> ...]

The packet folder holds only images under random names and INSTRUCTIONS.md; the key goes elsewhere.
"""
import json, math, random, sys
from pathlib import Path
from PIL import Image

EXPR = ["neutral", "wary", "startled", "set"]
LIGHTS = ["paraffin", "sodium"]
TWINS = {frozenset(("mab", "noll"))}
GROUND = (82, 82, 82)
DESC = json.loads((Path(__file__).parent / "descriptions.json").read_text(encoding="utf8"))["people"]


def crop_face(src, dst):
    im = Image.open(src).convert("RGBA")
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if not box:
        raise SystemExit(f"empty render {src}")
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    px, py = w * 0.08, h * 0.08
    x0, x1, y0, y1 = x0 - px, x1 + px, y0 - py, y1 + py
    w, h = x1 - x0, y1 - y0
    if w / h < 0.8:  # widen to 4:5
        c = (x0 + x1) / 2; w = h * 0.8; x0, x1 = c - w / 2, c + w / 2
    else:
        c = (y0 + y1) / 2; h = w / 0.8; y0, y1 = c - h / 2, c + h / 2
    base = Image.new("RGBA", im.size, GROUND + (255,))
    flat = Image.alpha_composite(base, im)
    big = Image.new("RGB", (im.width * 3, im.height * 3), GROUND)
    big.paste(flat.convert("RGB"), (im.width, im.height))
    out = big.crop((int(x0 + im.width), int(y0 + im.height), int(x1 + im.width), int(y1 + im.height))).resize((256, 320), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)


def cmd_crop(bank):
    bank = Path(bank)
    n = 0
    for f in sorted((bank / "face").glob("*/*.png")):
        crop_face(f, bank / "crops" / f.parent.name / f.name); n += 1
    print("cropped", n)


def full_portrait(portraits, who):
    im = Image.open(Path(portraits) / who / "neutral-paraffin.png").convert("RGBA")
    base = Image.new("RGBA", im.size, (58, 36, 22, 255))
    return Image.alpha_composite(base, im).convert("RGB").resize((256, 320), Image.LANCZOS)


def cmd_packet(bank, portraits, seed, pdir, keyfile):
    rng = random.Random(int(seed))
    bank, pdir = Path(bank), Path(pdir)
    pdir.mkdir(parents=True, exist_ok=False)
    people = sorted(p.name for p in (bank / "crops").iterdir() if p.is_dir())
    names = set()

    def put(img_or_path):
        while True:
            n = "%08x.png" % rng.getrandbits(32)
            if n not in names:
                names.add(n); break
        im = img_or_path if isinstance(img_or_path, Image.Image) else Image.open(img_or_path)
        im.save(pdir / n)
        return n

    crop = lambda w, e, l: bank / "crops" / w / f"{e}-{l}.png"
    key = {"seed": int(seed), "A": [], "B": [], "C": []}
    lines = ["# Viewer instructions", "",
             "You are looking at pictures of characters from a video game. Open each image with the Read tool, using the full paths given. Use no other tool: do not list folders, search, or open any other file.", "",
             "## Task A: same person or different person", "",
             "Each item shows two faces. The light and the expression may differ between the two pictures. Decide whether the two faces belong to the SAME person or to two DIFFERENT people. Give a confidence from 1 (a guess) to 3 (sure).", ""]
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
        left, right = put(crop(a, e1, l1)), put(crop(b, e2, l2))
        key["A"].append({"id": f"A{k:02d}", "kind": kind, "left": [a, e1, l1], "right": [b, e2, l2]})
        lines.append(f"- A{k:02d}: {pdir / left}  and  {pdir / right}")
    lines += ["", "## Task B: which description fits this face", "",
              "Each item shows one face and five descriptions. Pick the letter of the description that fits the face best. Hats, clothes and props are not shown; judge by the head and face.", ""]
    blist = [w for w in DESC if w in people]
    for k, w in enumerate(rng.sample(blist, 12), 1):
        opts = [w] + rng.sample([x for x in blist if x != w], 4); rng.shuffle(opts)
        img = put(crop(w, "neutral", "paraffin"))
        key["B"].append({"id": f"B{k:02d}", "who": w, "options": opts, "answer": "ABCDE"[opts.index(w)]})
        lines.append(f"- B{k:02d}: {pdir / img}")
        lines += [f"  - {L}: {DESC[o]['face']}" for L, o in zip("ABCDE", opts)]
    lines += ["", "## Task C: which description fits this portrait", "",
              "Each item shows one portrait as it appears in the game, and five descriptions. Pick the letter of the description that fits best.", ""]
    for k, w in enumerate(rng.sample(blist, 8), 1):
        opts = [w] + rng.sample([x for x in blist if x != w], 4); rng.shuffle(opts)
        img = put(full_portrait(portraits, w))
        key["C"].append({"id": f"C{k:02d}", "who": w, "options": opts, "answer": "ABCDE"[opts.index(w)]})
        lines.append(f"- C{k:02d}: {pdir / img}")
        lines += [f"  - {L}: {DESC[o]['full']}" for L, o in zip("ABCDE", opts)]
    lines += ["", "## Your answer", "",
              "End your reply with one JSON object and nothing after it, in this form:",
              '{"A": {"A01": ["SAME", 2], "A02": ["DIFFERENT", 3], ...}, "B": {"B01": "C", ...}, "C": {"C01": "A", ...}}',
              "Answer every item. Before the JSON, a sentence or two per task on what you looked at is welcome."]
    (pdir / "INSTRUCTIONS.md").write_text("\n".join(lines), encoding="utf8")
    Path(keyfile).parent.mkdir(parents=True, exist_ok=True)
    Path(keyfile).write_text(json.dumps(key, indent=1), encoding="utf8")
    print("packet", pdir, "items", len(key["A"]), len(key["B"]), len(key["C"]))


def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0, 1.0)
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (p, max(0.0, c - h), min(1.0, c + h))


def score(key, ans):
    out = {"A": [], "B": [], "C": []}
    for it in key["A"]:
        a = ans["A"].get(it["id"]); said = (a[0] if a else "").upper()
        ok = (said == "SAME") == (it["kind"] == "same") and said in ("SAME", "DIFFERENT")
        out["A"].append({**it, "said": said, "conf": a[1] if a else None, "ok": ok})
    for t in ("B", "C"):
        for it in key[t]:
            said = (ans[t].get(it["id"]) or "").strip().upper()[:1]
            out[t].append({**it, "said": said, "said_who": it["options"]["ABCDE".index(said)] if said in "ABCDE" and said else None, "ok": said == it["answer"]})
    return out


def summary(items):
    A = items["A"]; same = [i for i in A if i["kind"] == "same"]; diff = [i for i in A if i["kind"] == "diff"]
    s = lambda L: (sum(i["ok"] for i in L), len(L))
    res = {}
    for name, L in (("A", A), ("A_same", same), ("A_diff", diff), ("B", items["B"]), ("C", items["C"])):
        k, n = s(L); p, lo, hi = wilson(k, n); res[name] = {"correct": k, "n": n, "p": round(p, 3), "wilson95": [round(lo, 3), round(hi, 3)]}
    res["pass"] = {"A": res["A"]["wilson95"][0] >= 0.70 and res["A_same"]["p"] >= 0.70 and res["A_diff"]["p"] >= 0.70,
                   "B": res["B"]["wilson95"][0] > 0.20, "C": res["C"]["wilson95"][0] > 0.20}
    return res


def cmd_pool(out, *pairs):
    pooled = {"A": [], "B": [], "C": []}; per = []
    for kf, af in zip(pairs[::2], pairs[1::2]):
        key = json.loads(Path(kf).read_text(encoding="utf8")); ans = json.loads(Path(af).read_text(encoding="utf8"))
        sc = score(key, ans)
        for t in pooled:
            pooled[t] += [{**i, "viewer_seed": key["seed"]} for i in sc[t]]
        per.append({"seed": key["seed"], **summary(sc)})
    res = {"per_viewer": per, "pooled": summary(pooled), "items": pooled}
    Path(out).write_text(json.dumps(res, indent=1), encoding="utf8")
    print(json.dumps({"per_viewer": per, "pooled": res["pooled"]}, indent=1))


if __name__ == "__main__":
    c, *a = sys.argv[1:]
    {"crop": cmd_crop, "packet": cmd_packet, "pool": cmd_pool}[c](*a)
