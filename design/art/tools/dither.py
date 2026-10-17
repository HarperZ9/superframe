"""Direction B, 'Two Inks and a Lamp': ordered-dither night with a reduced palette.

After the author's GlagStone breakdown (darkness is an 8x8 Bayer pattern, each light a radial mask
quantised through it) and the monochrome first-person stills (fine dither over a scanline grid).
Five inks on a ramp, plus one reserved colour: evidence red, which appears only where paraffin
light (Lamb's lantern, the Brine's door) shows a surface its true colour. Sodium erases colour, so
under sodium the frame is two inks and a lamp; colour coming back is the game's mechanic made
visible.
"""
import sys
import numpy as np
import cv2
from PIL import Image
import cine
import shading as sh
import scene as scn
import paint

RAMP = np.array([[14, 10, 18], [43, 26, 46], [110, 46, 24], [214, 112, 34], [243, 231, 201]], float) / 255.0
EVIDENCE = np.array([194, 52, 44], float) / 255.0
BAYER8 = np.array([[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
                   [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
                   [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
                   [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]], float) / 64.0


def paraffin_fraction(G, T, n):
    names = [k for k in T['diff']]
    tot = np.zeros(len(T['idx'])) + 1e-6
    par = np.zeros(len(T['idx']))
    for k in names:
        v = (T['diff'][k] + T['spec'][k]).sum(1)
        tot += v
        if k in ('lantern', 'door'):
            par += v
    frac = np.zeros(n)
    frac[T['idx']] = par / tot
    sat = np.zeros(n)
    a = T['alb']
    red = (a[:, 0] > 1.6 * a[:, 1]) & (a[:, 0] > 1.6 * a[:, 2])
    sat[T['idx']] = (a.max(1) - a.min(1)) / (a.max(1) + 1e-4) * red
    return frac, sat


def render_dither(npz, out, scale=3, exposure=1.0, opts=None):
    opts = opts or {}
    G = np.load(npz)
    w, h = int(G['w']), int(G['h'])
    _, lights = scn.build(opts.get('scene', 'hero'))
    co = dict(scatter=0.45, fog=0.03, refl=0.9)
    co.update(opts.get('cine', {}))
    hdr, T = cine.shade_hdr(G, lights, co)
    if opts.get('auto'):
        exposure = exposure * cine.auto_exposure(hdr, G, opts.get('auto'))
    n = w * h
    frac, sat = paraffin_fraction(G, T, n)
    emis = np.isin(G['mat'], sh.EMISSIVE)
    W, H = w // scale, h // scale
    hdr_s = cv2.resize(hdr.astype(np.float32), (W, H), interpolation=cv2.INTER_AREA)
    ldr = cine.filmic(hdr_s * exposure)
    L = paint.lum(ldr)
    v = np.clip(L, 0, 1) ** (1 / opts.get('gamma', 2.0))
    v = np.clip((v - 0.03) / 0.92, 0, 1)
    # ordered dither onto the five-ink ramp
    th = np.tile(BAYER8, (H // 8 + 1, W // 8 + 1))[:H, :W]
    q = v * (len(RAMP) - 1)
    lo = np.floor(q)
    idx = (lo + ((q - lo) > th)).astype(int)
    idx = np.clip(idx, 0, len(RAMP) - 1)
    img = RAMP[idx]
    # evidence colour where paraffin reveals a saturated surface
    fr = cv2.resize(frac.reshape(h, w).astype(np.float32), (W, H), interpolation=cv2.INTER_AREA)
    st = cv2.resize(sat.reshape(h, w).astype(np.float32), (W, H), interpolation=cv2.INTER_AREA)
    gs = (G['gid'].reshape(h, w) >= 0).astype(np.float32)
    gsm = cv2.resize(gs, (W, H), interpolation=cv2.INTER_AREA) > 0.5
    ev = (fr > 0.35) & (st > 0.45) & (v > 0.18) & gsm
    evd = ev & (((v - 0.18) * 2.5 + 0.3) > th)
    img[evd] = EVIDENCE
    # emissive practicals print as paper, sodium globes ring with rust
    # practicals: windows print as a sodium-and-rust dither, only the door, lantern and globes as paper
    matm = G['mat'].reshape(h, w)
    win = cv2.resize((matm == 7).astype(np.float32), (W, H), interpolation=cv2.INTER_AREA) > 0.5
    hot = cv2.resize(np.isin(matm, (8, 11, 38)).astype(np.float32), (W, H), interpolation=cv2.INTER_AREA) > 0.5
    wv = np.where(th < 0.3, 2, 3)
    img[win] = RAMP[wv[win]]
    img[hot & (v > 0.5)] = RAMP[4]
    # ink outline at the working resolution
    Gs = {}
    yy = (np.arange(H) * scale + scale // 2)
    xx = (np.arange(W) * scale + scale // 2)
    sel = (yy[:, None] * w + xx[None, :]).ravel()
    for k in ('t', 'hit', 'N', 'gid', 'mat', 'D'):
        Gs[k] = G[k][sel]
    line = paint.ink_lines(Gs, W, H, k_sil=1.0 * 1920 / W, k_crease=1.0 * 1920 / W, wobble=0.0)
    line = (line > opts.get('line_t', 0.45))
    img[line] = RAMP[0] if not opts.get('light_line', False) else RAMP[1]
    # a one-pixel rust rim outside each person keeps the figure off the dark ground
    rim = cv2.dilate(gsm.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~gsm
    dark = img.sum(1 if img.ndim == 2 else 2) < RAMP[2].sum()
    img[rim & dark] = RAMP[2]
    # scanline grid at output size: the last row of each working pixel dips a little
    big = np.repeat(np.repeat(img, scale, 0), scale, 1)
    rows = (np.arange(H * scale) % scale) == scale - 1
    big[rows] *= opts.get('scan', 0.82)
    Image.fromarray((np.clip(big, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out)
    print(out, f'{W}x{H} working, x{scale}', flush=True)
    return big


if __name__ == '__main__':
    render_dither(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3)
