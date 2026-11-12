# Side-by-side stills, current figures against new, from the captures and the composites in out/.
#   python proto/stills.py      (run from characters/; writes stills/01..06)
from PIL import Image, ImageDraw, ImageFont
import os

CAP = '../game/capture/playthrough/'
try:
    FONT = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 22); SMALL = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 17)
except OSError:
    FONT = SMALL = ImageFont.load_default()

def label(im, text, sub=None):
    d = ImageDraw.Draw(im)
    w = max(d.textlength(text, font=FONT), d.textlength(sub or '', font=SMALL)) + 24
    d.rectangle([0, 0, w, 58 if sub else 36], fill=(16, 12, 14))
    d.text((12, 5), text, fill=(236, 230, 220), font=FONT)
    if sub: d.text((12, 33), sub, fill=(180, 172, 160), font=SMALL)
    return im

def crop(path, box, size):
    return Image.open(path).convert('RGB').crop(box).resize(size, Image.NEAREST if (box[2] - box[0]) * 2 <= size[0] else Image.LANCZOS)

def grid(panels, cols, size, out):
    rows = (len(panels) + cols - 1) // cols
    m = Image.new('RGB', (cols * size[0], rows * size[1]), (10, 8, 10))
    for i, p in enumerate(panels): m.paste(p, ((i % cols) * size[0], (i // cols) * size[1]))
    m.save(out); print(out)

S = (960, 540)
os.makedirs('stills', exist_ok=True)
# 01 the quay at play distance
q = (300, 170, 940, 530); S3 = (640, 360)
grid([
    label(crop(CAP + 'q02-quay.png', q, S3), "Current figures, today's camera", 'figures.mjs cutouts drawn 1.2x, from the playthrough'),
    label(crop('out/cmp-quay-A-z1.png', q, S3), "New, today's camera, true scale", 'about 48 px a person: too small for anything'),
    label(crop('out/cmp-quay-A-z1_s135.png', q, S3), "New, today's camera, drawn 1.35x", 'people again, but two together still crowd'),
    label(Image.open('out/cmp-quay-A-z2.5.png').convert('RGB').resize(S3, Image.LANCZOS), 'New, a 2.5x closer camera', 'about 110 px a person (plate upscaled as a stand-in)'),
    label(crop('out/cmp-quay-A-z2.5.png', (420, 170, 820, 395), S3), 'Detail: two people together', 'apron against coat; the lamp rim splits them'),
    label(crop('out/cmp-quay-A-z2.5.png', (300, 420, 620, 600), S3), 'Detail: the deacon on the steps', 'below the quay wall, lit by the lamps above'),
], 3, S3, 'stills/01-quay-distance.png')
# 02 the rooms
grid([
    label(crop(CAP + 'q10-wenna.png', (300, 120, 860, 435), S), 'Current figures, the Brine', 'flat fills, ball heads, dot eyes'),
    label(crop('out/cmp-brine-A-z2.png', (160, 40, 1120, 580), S), 'New figures, the Brine, 2x camera', 'Fennick and Lamb (talk_a, talk_b) under paraffin'),
    label(crop(CAP + 'q16-weigh.png', (400, 440, 880, 710), S), 'Current figures, the weigh-house', 'Lamb as drawn today, among the baked Guild'),
    label(crop('out/cmp-weigh-A-z2.png', (160, 40, 1120, 580), S), 'New figures, the weigh-house, 2x camera', 'Marrow (talk_c) and Lamb among the baked Guild'),
], 2, S, 'stills/02-rooms.png')
# 03 up close
cur = Image.new('RGB', (1440, 560), (16, 12, 14)); src = Image.open(CAP + 'q10-wenna.png').convert('RGB')
cur.paste(src.crop((380, 220, 520, 400)).resize((420, 540), Image.NEAREST), (20, 10)); cur.paste(src.crop((700, 200, 860, 340)).resize((480, 420), Image.NEAREST), (480, 70)); cur.paste(src.crop((800, 360, 862, 520)).resize((240, 540), Image.NEAREST), (1000, 10))
label(cur, 'Current figures up close (the Brine, enlarged from the capture)')
live = label(Image.open('out/closeups.png').convert('RGB'), 'New: the real-time look (play)', 'sculpted heads, self-shadow from the lamp, banded light, violet shadows, ink')
painted = label(Image.open('out/closeups-painted.png').convert('RGB'), 'New: the painter over the same figures (portraits and slow shots)', 'raw-native web/shaders/paintover/painter.mjs, the pass that painted the plates')
m = Image.new('RGB', (1440, 560 * 3)); [m.paste(p, (0, i * 560)) for i, p in enumerate([cur, live, painted])]; m.save('stills/03-closeups.png'); print('stills/03-closeups.png')
# 05 prototypes A and C on the same plates
grid([
    label(crop('out/cmp-quay-A-z2.5.png', (380, 200, 860, 470), S), 'A: real-time skinned, painterly shading', 'about 6 ms a figure at this size (CPU, Node)'),
    label(crop('out/cmp-quay-C-z2.5.png', (380, 200, 860, 470), S), 'C: the engine painter over the same G-buffer, relit', 'about 1.5 s a figure offline; no visible difference at play size'),
    label(crop('out/cmp-brine-A-z2.png', (380, 120, 860, 390), S), 'A: the Brine', ''),
    label(crop('out/cmp-brine-C-z2.png', (380, 120, 860, 390), S), 'C: the Brine', 'the painter boils frame to frame (proto/boil.mjs)'),
], 2, S, 'stills/05-pipeline-a-vs-c.png')
