"""Produce every style frame from the shared G-buffers: three directions x (hero, play, three portraits)."""
import os, sys
import paint, dither, cine

G = '../work/g'
OUT = '../frames'
SETS = {
    'A-oil-and-ink': lambda src, dst, kind: paint.render_paint(src, dst, 0.85 if kind != 'portrait' else 1.0, opts=dict(auto=0.8) if kind == 'portrait' else None),
    'B-two-inks': lambda src, dst, kind: dither.render_dither(src, dst, 3 if kind == 'hero' else 2, 1.0 if kind == 'hero' else (1.6 if kind == 'play' else 1.0), opts=dict(auto=0.75) if kind == 'portrait' else None),
    'C-sodium-cinema': lambda src, dst, kind: cine.render_cine(
        src, dst, exposure=0.75 if kind != 'portrait' else 1.0,
        opts=dict(scatter=0.22 if kind == 'hero' else 0.08, fog=0.02 if kind == 'hero' else (0.004 if kind == 'play' else 0.01),
                  halation=0.15, bloom=0.12, focus={'hero': 6.3, 'play': None, 'portrait': None}[kind], dof=1.2,
                  letterbox=2.39 if kind == 'hero' else None, grain=0.035, auto=0.7 if kind == 'portrait' else None)),
}
NAMES = [('hero1920', '01-quay-hero', 'hero'), ('play', '02-play-size', 'play'),
         ('keel', '03-portrait-keel', 'portrait'), ('lamb', '04-portrait-lamb', 'portrait'),
         ('sabine', '05-portrait-sabine', 'portrait')]
if __name__ == '__main__':
    only = sys.argv[1:]
    for d, fn in SETS.items():
        if only and d not in only:
            continue
        os.makedirs(f'{OUT}/{d}', exist_ok=True)
        for src, name, kind in NAMES:
            fn(f'{G}/{src}.npz', f'{OUT}/{d}/{name}.png', kind)
            print(d, name, flush=True)
