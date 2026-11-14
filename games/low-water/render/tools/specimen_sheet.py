# Lay the paint language's specimen swatches (render/tools/specimen.mjs) on one sheet with a title block: the strokes,
# the materials under stroke light, the eras and decay. The regression image for design/art/PAINT-LANGUAGE.md;
# regenerate it after every painter change and compare it with the last.
#   python render/tools/specimen_sheet.py game/capture/paint/specimen [commit]
import json, os, sys, datetime
from PIL import Image, ImageDraw, ImageFont
src = sys.argv[1]; rev = sys.argv[2] if len(sys.argv) > 2 else ""
rec = json.load(open(os.path.join(src, "swatches.json")))
def font(size):
    for f in ("C:/Windows/Fonts/consola.ttf", "C:/Windows/Fonts/arial.ttf"):
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()
SW, SH, LAB, PAD = 360, 300, 40, 18
rows = [("strokes", "STROKES, EACH ALONE"), ("materials", "MATERIALS UNDER STROKE LIGHT"), ("eras", "ERAS AND DECAY: ONE CORNER, A LIT WINDOW")]
cols = max(len([r for r in rec if r["row"] == k]) for k, _ in rows)
W = PAD * 2 + cols * SW; H = 130 + len(rows) * (SH + LAB + 40) + 60
S = Image.new("RGB", (W, H), (233, 226, 208)); d = ImageDraw.Draw(S)
d.text((PAD, 24), "LOW WATER  /  THE PAINT LANGUAGE  /  SPECIMEN SHEET", fill=(40, 30, 26), font=font(34))
d.text((PAD, 72), "Each stroke the painted style uses, each material's stroke in the light, each era's palette. Regression image for design/art/PAINT-LANGUAGE.md.", fill=(70, 60, 52), font=font(18))
y = 130
for key, title in rows:
    d.text((PAD, y), title, fill=(120, 40, 30), font=font(22)); y += 34
    for k, r in enumerate([r for r in rec if r["row"] == key]):
        x = PAD + k * SW
        S.paste(Image.open(os.path.join(src, f"{key}-{r['name']}.png")).convert("RGB"), (x, y))
        d.rectangle([x, y, x + SW - 1, y + SH - 1], outline=(60, 50, 44))
        d.text((x + 6, y + SH + 6), r["name"].upper(), fill=(40, 30, 26), font=font(16))
        d.text((x + 6, y + SH + 24), r["note"][:44], fill=(90, 80, 70), font=font(12))
    y += SH + LAB + 40
# the title block, as a drawing's: what, when, which painter
bx, by = W - 560, H - 52
d.rectangle([bx, by - 40, W - PAD, H - 12], outline=(40, 30, 26), width=2)
d.text((bx + 10, by - 34), "SHEET  paint-language specimen", fill=(40, 30, 26), font=font(14))
d.text((bx + 10, by - 14), f"DATE   {datetime.date.today().isoformat()}   PAINTER  {rev or 'working tree'}", fill=(40, 30, 26), font=font(14))
out = os.path.join(src, "specimen-sheet.png"); S.save(out); print(out, S.size)
