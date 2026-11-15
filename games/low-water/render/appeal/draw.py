# The painted portrait appeal test P1 (render/appeal/PROTOCOL.md): one viewer's draw. Pairs of portraits at panel
# size (161 x 201 each) side by side on the dialogue box's board colour, saved under random hex names outside the
# repository; the key (who, which side is which) goes to render/appeal/results/P1-<seed>.json, never to the viewer.
#   python render/appeal/draw.py --seed 601 --bank game/capture/paint/portraits2 --out <folder outside the repo> [--round P2 --no-s3]
import argparse, json, os, random, secrets
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--seed", type=int, required=True); ap.add_argument("--bank", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--results", default="render/appeal/results"); ap.add_argument("--round", default="P1"); ap.add_argument("--no-s3", action="store_true")
a = ap.parse_args()
rng = random.Random(a.seed)
PW, PH, GAP, GROUND = 161, 201, 14, (33, 27, 23)
people = sorted(d for d in os.listdir(os.path.join(a.bank, "old")) if os.path.isdir(os.path.join(a.bank, "old", d)) and os.path.isdir(os.path.join(a.bank, "sc", d)))
v1 = os.path.join(a.bank, "v1")
os.makedirs(a.out, exist_ok=True); os.makedirs(a.results, exist_ok=True)

def pair(left, right):
    im = Image.new("RGB", (PW * 2 + GAP * 3, PH + GAP * 2), GROUND)
    for k, p in enumerate((left, right)):
        im.paste(Image.open(p).convert("RGB").resize((PW, PH), Image.LANCZOS), (GAP + k * (PW + GAP), GAP))
    name = secrets.token_hex(8) + ".png"; im.save(os.path.join(a.out, name)); return os.path.join(a.out, name)

items = []
for who in rng.sample(people, 12):
    sc_left = rng.random() < 0.5
    o, s = os.path.join(a.bank, "old", who, "neutral.png"), os.path.join(a.bank, "sc", who, "neutral.png")
    img = pair(s, o) if sc_left else pair(o, s)
    for q in ("S1", "S2"): items.append({"q": q, "who": who, "mood": "neutral", "image": img, "target": "LEFT" if sc_left else "RIGHT"})
    if a.no_s3: continue
    mood = rng.choice(["warm", "angry", "grieving"]); sc_left = rng.random() < 0.5
    o, s = os.path.join(a.bank, "old", who, mood + ".png"), os.path.join(a.bank, "sc", who, mood + ".png")
    items.append({"q": "S3", "who": who, "mood": mood, "image": pair(s, o) if sc_left else pair(o, s), "target": "LEFT" if sc_left else "RIGHT"})
pv1 = [p for p in people if os.path.exists(os.path.join(v1, p, "neutral.png"))]
for who in rng.sample(pv1, min(8, len(pv1))):
    new_left = rng.random() < 0.5
    n, f = os.path.join(a.bank, "old", who, "neutral.png"), os.path.join(v1, who, "neutral.png")
    items.append({"q": "P", "who": who, "mood": "neutral", "image": pair(n, f) if new_left else pair(f, n), "target": "LEFT" if new_left else "RIGHT"})
rng.shuffle(items)
for k, it in enumerate(items): it["id"] = f"P{k + 1:02d}"
json.dump({"seed": a.seed, "items": items}, open(os.path.join(a.results, f"{a.round}-{a.seed}.json"), "w"), indent=1)
print(json.dumps([{"id": it["id"], "q": it["q"], "image": it["image"]} for it in items]))
