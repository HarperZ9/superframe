"""Render the G-buffers for the play view and the three portraits, skipping any already done."""
import os, render, cams
JOBS = [('hero1920', cams.HERO, 1920, 1080, dict(reflect=True)),
        ('play', cams.play(), 1920, 1080, dict(reflect=True)),
        ('keel', cams.portrait('keel'), 1024, 1280, dict(reflect=False, ne=0.0004, eps_k=0.0003)),
        ('lamb', cams.portrait('lamb'), 1024, 1280, dict(reflect=False, ne=0.0004, eps_k=0.0003)),
        ('sabine', cams.portrait('sabine'), 1024, 1280, dict(reflect=False, ne=0.0004, eps_k=0.0003))]
if __name__ == '__main__':
    import sys
    only = sys.argv[1:]
    for name, cam, w, h, o in JOBS:
        out = f'../work/g/{name}.npz'
        if only and name not in only:
            continue
        if os.path.exists(out) and not only:
            continue
        render.render('hero', cam, w, h, out, 1, o, workers=16)
