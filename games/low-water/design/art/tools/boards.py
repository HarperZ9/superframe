"""Compose one board per direction and a three-way comparison from the finished frames."""
import os
from PIL import Image, ImageDraw, ImageFont

F = '../frames'
DIRS = [('A-oil-and-ink', 'A  Oil and Ink'), ('B-two-inks', 'B  Two Inks and a Lamp'), ('C-sodium-cinema', 'C  Sodium Cinema')]
BG = (16, 12, 20)
INKC = (232, 222, 200)


def font(sz):
    for p in ('C:/Windows/Fonts/consola.ttf', 'C:/Windows/Fonts/arial.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()


def board(d, title):
    hero = Image.open(f'{F}/{d}/01-quay-hero.png').convert('RGB')
    play = Image.open(f'{F}/{d}/02-play-size.png').convert('RGB')
    pors = [Image.open(f'{F}/{d}/0{i}-portrait-{w}.png').convert('RGB') for i, w in ((3, 'keel'), (4, 'lamb'), (5, 'sabine'))]
    W = 1920 + 40
    pw = 420
    ph = int(pw * 1.25)
    H = 70 + 1080 + 20 + ph + 60
    B = Image.new('RGB', (W, H), BG)
    dr = ImageDraw.Draw(B)
    dr.text((20, 20), title, fill=INKC, font=font(30))
    B.paste(hero, (20, 70))
    y = 70 + 1080 + 20
    x = 20
    for p, nm in zip(pors, ('Keel', 'Lamb', 'Sabine')):
        B.paste(p.resize((pw, ph), Image.LANCZOS), (x, y))
        dr.text((x, y + ph + 12), nm + '  (portrait 1024 x 1280)', fill=INKC, font=font(18))
        x += pw + 20
    pl = play.resize((W - 20 - x, int((W - 20 - x) * 9 / 16)), Image.LANCZOS)
    B.paste(pl, (x, y))
    dr.text((x, y + pl.height + 8), 'play size: game camera, 35.26 deg down, near-orthographic', fill=INKC, font=font(18))
    B.save(f'{F}/{d}/00-board.png')
    return B


if __name__ == '__main__':
    bs = [board(d, t) for d, t in DIRS]
    w = 1280
    rows = [b.resize((w, int(b.height * w / b.width)), Image.LANCZOS) for b in bs]
    C = Image.new('RGB', (w, sum(r.height for r in rows)), BG)
    y = 0
    for r in rows:
        C.paste(r, (0, y))
        y += r.height
    C.save(f'{F}/00-compare.png')
    # the same portrait across directions, the test the author's 'not distinct enough' asks for
    for i, who in ((3, 'keel'), (4, 'lamb'), (5, 'sabine')):
        ims = [Image.open(f'{F}/{d}/0{i}-portrait-{who}.png').convert('RGB') for d, _ in DIRS]
        S = Image.new('RGB', (sum(im.width for im in ims), ims[0].height), BG)
        x = 0
        for im in ims:
            S.paste(im, (x, 0))
            x += im.width
        S.save(f'{F}/00-portrait-{who}-ABC.png')
    print('boards written')
