"""Print each cell's label lines under the cells of a sheet from proto/people_sheet.mjs.

    python proto/label_sheet.py <sheet.png> [title]   (reads <sheet>.json, writes <sheet>-labelled.png)
"""
import json
import sys

from PIL import Image, ImageDraw, ImageFont


def font(size):
    for name in ("C:/Windows/Fonts/arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main(path, title=""):
    meta = json.load(open(path[:-4] + ".json", encoding="utf8"))
    im = Image.open(path).convert("RGB")
    cols, w, h, labels = meta["cols"], meta["w"], meta["h"], meta["labels"]
    rows = (len(labels) + cols - 1) // cols
    band, top = 64, 44 if title else 0
    out = Image.new("RGB", (cols * w, top + rows * (h + band)), (24, 20, 18))
    d = ImageDraw.Draw(out)
    if title:
        d.text((12, 10), title, fill=(236, 228, 214), font=font(22))
    f1, f2 = font(17), font(14)
    for n, lines in enumerate(labels):
        c, r = n % cols, n // cols
        x, y = c * w, top + r * (h + band)
        out.paste(im.crop((x, r * h, x + w, r * h + h)), (x, y))
        for k, line in enumerate(lines):
            d.text((x + 8, y + h + 4 + k * 19), line, fill=(236, 228, 214) if k == 0 else (190, 180, 166), font=f1 if k == 0 else f2)
    dst = path[:-4] + "-labelled.png"
    out.save(dst)
    print(dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
