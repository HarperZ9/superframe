# Before and after strips from two feel captures (game/engine/combat/tools/feel_capture.py), cropped on a
# tracked body: python proto/feel_compare.py <before dir> <after dir> <out dir>
# Each move: the before capture's frames on top, the after capture's below, every 6 frames from the event.
import json, os, sys
from PIL import Image, ImageDraw
B, A, OUT = sys.argv[1:4]; os.makedirs(OUT, exist_ok=True)
def track(d): return {r[0]: r for r in json.load(open(f'{d}/capture.json'))['track']}
def strip(d, f0, n, step, who, half=170):
    T, ims = track(d), []
    for f in range(f0, f0 + n * step, step):
        p = f'{d}/frames/f{f:05d}.png'
        if not os.path.exists(p) or f not in T: continue
        r = T[f]; pts = [r[1]] + r[2]; cx, cy = pts[min(who, len(pts) - 1)]
        im = Image.open(p).convert('RGB').crop((cx - half, cy - int(half * 1.4), cx + half, cy + int(half * 0.6)))
        ImageDraw.Draw(im).text((4, 4), f'{f - f0:+d}', fill=(240, 232, 214)); ims.append(im)
    return ims
# move, (before frame, body), (after frame, body), frames, step; body 0 Lamb, 1 the first warden, 2 the second
MOVES = [
    ('lunge', (196, 1), (515, 1), 11, 6),
    ('throw', (91, 1), (91, 1), 15, 6),
    ('knockdown', (1079, 1), (610, 0), 11, 6),
    ('hit-reaction', (927, 1), (867, 1), 8, 3),
]
for name, (fb, wb), (fa, wa), n, step in MOVES:
    top, bot = strip(B, fb, n, step, wb), strip(A, fa, n, step, wa)
    if not top or not bot: print(name, 'missing frames'); continue
    w = max(sum(i.width for i in top), sum(i.width for i in bot)); h = top[0].height
    c = Image.new('RGB', (w, h * 2 + 24), (20, 14, 22)); d = ImageDraw.Draw(c)
    x = 0
    for i in top: c.paste(i, (x, 0)); x += i.width
    x = 0
    for i in bot: c.paste(i, (x, h + 24)); x += i.width
    d.text((6, h + 6), f'{name}: before (top, feel4 frame {fb}) and after (bottom, frame {fa}), every {step} frames at 60 fps', fill=(240, 232, 214))
    c.save(f'{OUT}/{name}.png'); print(f'{OUT}/{name}.png')
