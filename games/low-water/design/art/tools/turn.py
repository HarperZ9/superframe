"""Turnaround test renders: each character front, three-quarter and profile, plus face close-ups."""
import sys, numpy as np
from PIL import Image
import render, preview
if __name__ == '__main__':
    who = sys.argv[1]; mode = sys.argv[2] if len(sys.argv) > 2 else 'body'
    tiles = []
    hy = dict(keel=2.02, lamb=1.83, sabine=1.37)[who]
    for ang in (0.0, 0.8, 1.57):
        if mode == 'body':
            dist = 6.0
            cam = dict(pos=[np.sin(ang) * dist, 1.2, np.cos(ang) * dist], target=[0, 1.1, 0], fov=26)
            w, h = 300, 520
        else:
            dist = 0.9
            fz = 0.06
            cam = dict(pos=[np.sin(ang) * dist, hy + 0.02, np.cos(ang) * dist + fz], target=[0, hy - 0.03, fz], fov=24)
            w, h = 360, 420
        out = f'../work/turn_{who}_{mode}_{ang:.2f}.npz'
        render.render(who, cam, w, h, out, 1, dict(reflect=False, ne=0.0004 if mode != 'body' else 0.0008), workers=12)
        preview.clay(out, out.replace('.npz', '.png'))
        tiles.append(Image.open(out.replace('.npz', '.png')))
    W = sum(t.width for t in tiles); H = tiles[0].height
    s = Image.new('RGB', (W, H)); x = 0
    for t in tiles:
        s.paste(t, (x, 0)); x += t.width
    s.save(f'../work/turn_{who}_{mode}.png')
