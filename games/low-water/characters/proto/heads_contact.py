"""Head contact sheets at the sizes a player sees: portraits at their baked size (512 x 640) and at
the talk panel's size (161 x 201 at 720p, 242 x 302 at 1080p: ux.css .pframe, 28vh, 4:5), and the
play-size figures from proto/heads_play.mjs. Nothing is sharpened; panel sizes are a plain
Lanczos resize, as a browser would draw them (object-fit cover on a 4:5 image is a plain scale).

    python proto/heads_contact.py <portraits dir> <play70 dir> <play105 dir> <out prefix> [who,...]

Writes <prefix>-portraits.png (the first seven at 512 x 640), <prefix>-panel720.png and
<prefix>-panel1080.png (everyone), <prefix>-play.png (everyone at both play scales).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

FIRST = ["lamb", "penhallow", "wenna", "gorm", "keel", "hobb", "marrow"]
PANEL_BG = (58, 36, 22)   # .pframe mid stop, #3a2416
PLAY_BG = (138, 122, 102)  # a daylit quay stone


def on(bg, im):
    base = Image.new("RGBA", im.size, bg + (255,))
    return Image.alpha_composite(base, im.convert("RGBA")).convert("RGB")


def label(draw, xy, text, fill=(235, 228, 214)):
    draw.text(xy, text, fill=fill)


def grid(cells, cols, cw, ch, pad=6, lab=14, bg=(24, 20, 22)):
    rows = (len(cells) + cols - 1) // cols
    W, H = cols * (cw + pad) + pad, rows * (ch + lab + pad) + pad
    out = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(out)
    for i, (name, im) in enumerate(cells):
        x, y = pad + (i % cols) * (cw + pad), pad + (i // cols) * (ch + lab + pad)
        out.paste(im, (x, y + lab))
        label(d, (x, y), name)
    return out


def main():
    pdir, p70, p105, pre = map(Path, sys.argv[1:5])
    who = sys.argv[5].split(",") if len(sys.argv) > 5 else None
    if who is None:
        who = FIRST + sorted(p.name for p in pdir.iterdir() if p.is_dir() and p.name not in FIRST)
    pre.parent.mkdir(parents=True, exist_ok=True)
    port = {w: Image.open(pdir / w / "neutral-paraffin.png") for w in who if (pdir / w / "neutral-paraffin.png").exists()}
    first = [w for w in FIRST if w in port] or [w for w in who if w in port][:8]   # another cast: its first eight
    grid([(w, on(PANEL_BG, port[w])) for w in first], 4, 512, 640).save(f"{pre}-portraits.png")
    for tag, (cw, ch) in {"panel720": (161, 201), "panel1080": (242, 302)}.items():
        cells = [(w, on(PANEL_BG, port[w].resize((cw, ch), Image.LANCZOS))) for w in who if w in port]
        grid(cells, 9 if cw < 200 else 6, cw, ch).save(f"{pre}-{tag}.png")
    cells = []
    for w in who:
        a, b = p70 / f"{w}.png", p105 / f"{w}.png"
        if not (a.exists() and b.exists()):
            continue
        A, B = Image.open(a), Image.open(b)
        im = Image.new("RGB", (A.width + B.width + 4, B.height), PLAY_BG)
        im.paste(on(PLAY_BG, A), (0, B.height - A.height))
        im.paste(on(PLAY_BG, B), (A.width + 4, 0))
        cells.append((w, im))
    if cells:
        cw, ch = max(c[1].width for c in cells), max(c[1].height for c in cells)
        grid([(n, i) for n, i in cells], 9, cw, ch).save(f"{pre}-play.png")
    print("wrote", pre)


if __name__ == "__main__":
    main()
