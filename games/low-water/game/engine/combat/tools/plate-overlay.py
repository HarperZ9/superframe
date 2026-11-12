"""Draw each plate's fight ground over the painting, to check the mapping by eye.

    python game/engine/combat/tools/plate-overlay.py [plate ...]

Reads out/plates/<plate>.json (from tools/plate-arenas.mjs) and the plate's first painted variant,
projects every walkable cell (a dot, value by surface), the spawns (Lamb a ring, opponents
crosses), lamps (stars) and exits (boxes) through the affine fit, and writes
out/plates/<plate>-overlay.png at half size.
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "out" / "plates"
CONTENT = HERE.parents[3] / "content"
SURF = {"s": (90, 200, 255), "m": (200, 150, 60), "w": (60, 200, 90), "S": (255, 255, 255), "g": (255, 255, 255)}


def proj(fit, x, y, z):
    u, v = fit["u"], fit["v"]
    return (u[0] * x + u[1] * y + u[2] * z + u[3], v[0] * x + v[1] * y + v[2] * z + v[3])


def one(name):
    d = json.loads((OUT / f"{name}.json").read_text(encoding="utf-8"))
    place = json.loads((CONTENT / name / "place.json").read_text(encoding="utf-8"))
    variant = (place.get("variants") or ["night"])[0]
    img = Image.open(CONTENT / name / f"{variant}.png").convert("RGB")
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0)); g = ImageDraw.Draw(ov)
    fit, c, (ox, oz) = d["fit"], d["cell"], d["origin"]
    for i, cell in enumerate(d["cells"]):
        if not cell: continue
        x, z = ox + (i % d["w"] + 0.5) * c, oz + (i // d["w"] + 0.5) * c
        u, v = proj(fit, x, cell[1], z); col = SURF.get(cell[0], (255, 255, 255))
        g.ellipse([u - 3, v - 3, u + 3, v + 3], fill=col + (110,))
    hy = lambda x, z: 0
    lx, lz = d["spawns"]["lamb"]; u, v = proj(fit, lx, 0, lz)
    g.ellipse([u - 22, v - 22, u + 22, v + 22], outline=(255, 255, 255, 255), width=5)
    for fx, fz in d["spawns"]["foes"]:
        u, v = proj(fit, fx, 0, fz); g.line([u - 18, v - 18, u + 18, v + 18], fill=(255, 60, 60, 255), width=5); g.line([u - 18, v + 18, u + 18, v - 18], fill=(255, 60, 60, 255), width=5)
    for L in d["lights"]:
        u, v = proj(fit, L["x"], 0, L["z"]); g.regular_polygon((u, v, 16), 5, fill=(255, 230, 120, 230))
    for e in d["exits"]:
        a = proj(fit, e[0], 0, e[1]); b = proj(fit, e[2], 0, e[3]); g.rectangle([min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])], outline=(120, 255, 120, 255), width=4)
    out = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    out = out.resize((out.width // 2, out.height // 2))
    out.save(OUT / f"{name}-overlay.png")
    print(name, "->", OUT / f"{name}-overlay.png")


if __name__ == "__main__":
    names = sys.argv[1:] or [p.stem for p in OUT.glob("*.json")]
    for n in names: one(n)
