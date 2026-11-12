"""Clay preview of a G-buffer: key, rim, AO, material tint. For checking sculpts, not a style."""
import sys
import numpy as np
from PIL import Image

TINT = {20: (.55, .58, .55), 21: (.75, .6, .5), 22: (.85, .55, .45), 23: (.95, .95, .9), 24: (0, 0, 0),
        25: (.15, .1, .08), 26: (.6, .6, .6), 27: (.6, .7, .75), 28: (.35, .25, .1), 29: (.2, .12, .05),
        30: (.08, .1, .18), 31: (.08, .1, .18), 32: (.8, .6, .2), 33: (.95, .95, .9), 34: (.35, .38, .42),
        35: (.45, .08, .08), 36: (.25, .22, .2), 37: (.3, .18, .1), 38: (1, .8, .4), 39: (.7, .7, .7),
        40: (.12, .1, .12), 41: (.85, .82, .75), 42: (.7, .65, .6), 43: (.25, .3, .2), 44: (.15, .15, .17),
        45: (.95, .92, .8), 46: (.7, .8, .9), 47: (.4, .3, .2), 0: (.4, .4, .42)}


def clay(npz, out):
    g = np.load(npz)
    w, h = int(g['w']), int(g['h'])
    N = g['N'].astype(float)
    hit = g['hit']
    mat = g['mat']
    A = g['A']
    L = np.array([-0.5, 0.6, 0.8]); L /= np.linalg.norm(L)
    R = np.array([0.6, 0.3, -0.75]); R /= np.linalg.norm(R)
    col = np.zeros((len(N), 3))
    for m, c in TINT.items():
        col[mat == m] = c
    other = hit & ~np.isin(mat, list(TINT))
    col[other] = (0.5, 0.5, 0.5)
    k = np.clip(N @ L, 0, 1) * 0.85 + 0.15
    rim = np.clip(N @ R, 0, 1) ** 2 * 0.6
    img = col * (k * A)[:, None] + rim[:, None] * 0.5
    img[~hit] = (0.12, 0.11, 0.14)
    img = np.clip(img, 0, 1) ** (1 / 2.2)
    Image.fromarray((img.reshape(h, w, 3) * 255).astype(np.uint8)).save(out)


if __name__ == '__main__':
    clay(sys.argv[1], sys.argv[2])
