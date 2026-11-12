"""Materials, surface wear and the light terms every direction shares.

Light composition follows the author's Elder ENB night balance (enbseries.ini, 2026-03-05):
direct moonlight weak (0.2) and fully desaturated, ambient low (0.15), fire-type practicals strong
(2.0) with heavy specular (3.5), strong bounce (SSIL 2.25) and AO (2.0). Here: sodium and paraffin
are the practicals, the moon is a cold, colourless rim, the ambient is a thin violet lift.
Sodium is monochromatic: a surface under it answers only with its reflectance near 589 nm.
"""
import numpy as np
from sdf import vnoise, fbm, ridged

# ---------------------------------------------------------------- materials
# id: (albedo linear, roughness, f0, metal, emissive rgb, wrap)
MAT = {
    0: ((0.10, 0.095, 0.09), 0.35, 0.03, 0, None, 0),     # wet flagstone
    1: ((0.20, 0.19, 0.18), 0.45, 0.03, 0, None, 0),      # coping
    2: ((0.01, 0.012, 0.015), 0.05, 0.02, 0, None, 0),    # harbour water
    4: ((0.22, 0.18, 0.15), 0.9, 0.02, 0, None, 0),       # plaster
    5: ((0.05, 0.05, 0.06), 0.6, 0.03, 0, None, 0),       # slate
    6: ((0.015, 0.018, 0.022), 0.1, 0.04, 0, None, 0),    # dark pane
    7: ((0.0, 0.0, 0.0), 0.3, 0.04, 0, (0.9, 0.42, 0.14), 0),   # paraffin window
    8: ((0.0, 0.0, 0.0), 0.3, 0.04, 0, (1.3, 0.62, 0.22), 0),    # the Brine's door
    9: ((0.12, 0.075, 0.04), 0.7, 0.03, 0, None, 0),      # wood
    10: ((0.03, 0.028, 0.026), 0.5, 0.2, 1, None, 0),     # iron
    11: ((0.0, 0.0, 0.0), 0.2, 0.04, 0, (60.0, 21.0, 1.8), 0),  # sodium globe
    12: ((0.28, 0.29, 0.30), 0.25, 0.05, 0, None, 0.2),   # fish
    13: ((0.30, 0.22, 0.12), 0.9, 0.02, 0, None, 0),      # rope
    14: ((0.05, 0.05, 0.06), 0.8, 0.02, 0, None, 0),      # Mother
    15: ((0.0, 0.0, 0.0), 0.2, 0.04, 0, (0.35, 1.6, 0.6), 0),   # Mother's green lens
    16: ((0.6, 0.55, 0.3), 0.05, 0.08, 0, None, 0),       # fish eye
    17: ((0.20, 0.03, 0.03), 0.7, 0.03, 0, None, 0),      # sign
    20: ((0.36, 0.40, 0.36), 0.32, 0.04, 0, None, 0.35),  # Keel's skin, grey of a thumb kept in a bath
    21: ((0.55, 0.40, 0.30), 0.55, 0.03, 0, None, 0.3),   # Lamb's skin, sallow
    22: ((0.70, 0.40, 0.30), 0.45, 0.03, 0, None, 0.35),  # Sabine's skin, ruddy
    23: ((0.72, 0.68, 0.60), 0.05, 0.05, 0, None, 0.2),   # eye white
    24: ((0.005, 0.005, 0.005), 0.05, 0.05, 0, None, 0),  # pupil
    25: ((0.05, 0.03, 0.02), 0.5, 0.04, 0, None, 0),      # Sabine's hair
    26: ((0.42, 0.42, 0.40), 0.6, 0.03, 0, None, 0),      # grey whiskers
    27: ((0.45, 0.55, 0.58), 0.05, 0.05, 0, None, 0),     # Keel's iris, pale
    28: ((0.22, 0.14, 0.05), 0.05, 0.05, 0, None, 0),     # Lamb's iris, hazel
    29: ((0.06, 0.035, 0.02), 0.05, 0.05, 0, None, 0),    # Sabine's iris, black-brown
    30: ((0.018, 0.022, 0.045), 0.18, 0.06, 0, None, 0),  # Keel's coat, navy black with wet
    31: ((0.02, 0.025, 0.05), 0.25, 0.05, 0, None, 0),    # Keel's cap
    32: ((0.75, 0.52, 0.20), 0.3, 0.7, 1, None, 0),       # brass
    33: ((0.70, 0.67, 0.60), 0.7, 0.03, 0, None, 0.2),    # pale linen
    34: ((0.16, 0.18, 0.20), 0.85, 0.02, 0, None, 0.1),   # Lamb's slate greatcoat
    35: ((0.28, 0.035, 0.04), 0.7, 0.03, 0, None, 0.1),   # oxblood lining
    36: ((0.10, 0.085, 0.07), 0.9, 0.02, 0, None, 0),     # felt hat
    37: ((0.16, 0.09, 0.045), 0.5, 0.04, 0, None, 0),     # leather
    38: ((0.0, 0.0, 0.0), 0.1, 0.04, 0, (7.0, 3.6, 1.2), 0),     # lantern glass
    39: ((0.45, 0.45, 0.47), 0.35, 0.6, 1, None, 0),      # tin
    40: ((0.05, 0.04, 0.055), 0.8, 0.02, 0, None, 0.1),   # skirt
    41: ((0.72, 0.68, 0.58), 0.8, 0.02, 0, None, 0.15),   # striped apron
    42: ((0.58, 0.54, 0.48), 0.8, 0.02, 0, None, 0.15),   # blouse
    43: ((0.10, 0.16, 0.08), 0.95, 0.02, 0, None, 0.1),   # shawl, bottle-green knit
    44: ((0.06, 0.06, 0.07), 0.8, 0.02, 0, None, 0),      # trousers
    45: ((0.80, 0.74, 0.52), 0.3, 0.04, 0, None, 0.3),    # pickled egg
    46: ((0.02, 0.025, 0.03), 0.02, 0.10, 0, None, 0),    # drip water
    47: ((0.20, 0.13, 0.07), 0.6, 0.03, 0, None, 0),      # stick
    49: ((0.14, 0.10, 0.07), 0.7, 0.03, 0, None, 0),      # Lamb's hair
}
EMISSIVE = [k for k, v in MAT.items() if v[4] is not None]
SKIN = (20, 21, 22)


def table(mat):
    n = len(mat)
    alb = np.zeros((n, 3)); rough = np.ones(n); f0 = np.full(n, 0.03); metal = np.zeros(n)
    emis = np.zeros((n, 3)); wrap = np.zeros(n)
    for k, (a, r, f, m, e, w) in MAT.items():
        s = mat == k
        if not np.any(s):
            continue
        alb[s] = a; rough[s] = r; f0[s] = f; metal[s] = m; wrap[s] = w
        if e is not None:
            emis[s] = e
    return alb, rough, f0, metal, emis, wrap


# ---------------------------------------------------------------- wear and pattern

def _house_tint(x):
    tints = np.array([(0.30, 0.10, 0.08), (0.34, 0.27, 0.10), (0.10, 0.22, 0.22), (0.26, 0.22, 0.18),
                      (0.30, 0.12, 0.10), (0.20, 0.24, 0.12), (0.32, 0.30, 0.24), (0.12, 0.16, 0.24), (0.3, 0.2, 0.1)])
    idx = (np.floor((x + 12) / 2.35).astype(int)) % len(tints)
    return tints[idx]


def surface(mat, P, loc, N, rough):
    """Albedo modulation, roughness and wetness from pattern and wear. Returns (alb_mul or alb, rough, wet)."""
    n = len(mat)
    alb, rough0, f0, metal, emis, wrap = table(mat)
    rough = rough0.copy()
    wet = np.zeros(n)

    def sel(*ids):
        return np.isin(mat, ids)

    s = sel(0)
    if np.any(s):
        Q = P[s]
        row = np.floor(Q[:, 2] / 0.62)
        col = np.floor((Q[:, 0] + (row % 2) * 0.47) / 0.94)
        h = ((row * 7919 + col * 104729) % 97) / 97.0
        base = 0.65 + 0.7 * h[:, None] * np.array([1, 0.95, 0.9])
        grime = 0.6 + 0.6 * fbm(Q, 2.5, 3, 4)[:, None]
        alb[s] = alb[s] * base * grime
        pud = fbm(Q * [1, 0, 1], 0.55, 3, 9)
        w = np.clip((pud - 0.47) * 6, 0, 1)
        wet[s] = 0.35 + 0.65 * w
        rough[s] = 0.35 * (1 - w) + 0.03 * w
    s = sel(4)
    if np.any(s):
        Q = P[s]
        alb[s] = _house_tint(Q[:, 0]) * (0.55 + 0.6 * fbm(Q, 1.5, 4, 2))[:, None]
        streak = vnoise(Q * [6, 0.4, 6], 2.0, 3)
        alb[s] *= (0.7 + 0.3 * streak)[:, None]
        alb[s] *= np.clip(0.45 + Q[:, 1] * 0.25, 0.45, 1.0)[:, None]  # grime at the foot of the walls
    s = sel(9, 47)
    if np.any(s):
        Q = P[s]
        alb[s] *= (0.6 + 0.6 * vnoise(Q * [30, 2, 30], 1.0, 1))[:, None]
    s = sel(12)
    if np.any(s):
        Q = P[s]
        belly = np.clip((-N[s, 1]) * 0.8 + 0.5, 0, 1)
        scales = 0.8 + 0.2 * np.sin(Q[:, 0] * 90) * np.sin(Q[:, 1] * 90)
        alb[s] = alb[s] * (0.4 + 0.9 * belly)[:, None] * scales[:, None]
        wet[s] = 0.8
    # skin: blotch, veins, stubble, red at the nose and ears
    for k in SKIN:
        s = sel(k)
        if not np.any(s):
            continue
        Q = loc[s]
        bl = fbm(Q, 40, 3, k)
        alb[s] *= (0.85 + 0.3 * bl)[:, None]
        red = np.clip(fbm(Q, 18, 2, k + 3) - 0.45, 0, 1) * 2.2
        alb[s] += red[:, None] * np.array([0.10, -0.04, -0.03]) * (1.6 if k == 22 else 0.8)
        if k == 20:
            wet[s] = 0.9
            rough[s] = 0.15
            veins = np.clip(1 - np.abs(ridged(Q, 30, 2, 5) - 0.85) * 12, 0, 1)
            alb[s] *= (1 - 0.25 * veins)[:, None] * np.array([1.0, 0.95, 1.05])
        if k == 21:
            stub = np.clip((1.74 - Q[:, 1]) * 14, 0, 1) * np.clip((vnoise(Q, 260, 7) - 0.4) * 3, 0, 1)
            alb[s] *= (1 - 0.45 * stub)[:, None]
    s = sel(30, 31)
    if np.any(s):
        Q = loc[s]
        runs = vnoise(Q * [14, 1.2, 14], 3.0, 13)
        wet[s] = 1.0
        rough[s] = 0.10 + 0.25 * runs
        alb[s] *= (0.75 + 0.5 * runs)[:, None]
    s = sel(34)
    if np.any(s):
        Q = loc[s]
        wear = fbm(Q, 9, 4, 17)
        alb[s] *= (0.7 + 0.6 * wear)[:, None]
        mud = np.clip((0.62 - Q[:, 1]) * 5, 0, 1) * np.clip(fbm(Q, 6, 3, 2) * 1.6 - 0.4, 0, 1)
        alb[s] = alb[s] * (1 - mud[:, None]) + mud[:, None] * np.array([0.10, 0.07, 0.04])
        patch = np.nonzero(s)[0][vnoise(Q, 4.5, 23) > 0.78]
        alb[patch] = alb[patch] * np.array([0.8, 0.85, 1.0])
    s = sel(41)
    if np.any(s):
        Q = loc[s]
        stripe = (np.sin(Q[:, 0] * 2 * np.pi / 0.045) > 0.55)
        alb[s] = np.where(stripe[:, None], np.array([0.30, 0.05, 0.05]), alb[s])
        stain = np.clip(fbm(Q, 7, 3, 41) * 2.4 - 1.25, 0, 1)
        alb[s] *= (1 - 0.55 * stain)[:, None] * np.array([1.0, 0.92, 0.8])
    s = sel(43)
    if np.any(s):
        Q = loc[s]
        knit = 0.75 + 0.25 * np.sin(Q[:, 1] * 300 + np.sin(Q[:, 0] * 150) * 2)
        alb[s] *= knit[:, None]
    s = sel(36, 37, 40, 44)
    if np.any(s):
        Q = loc[s]
        alb[s] *= (0.7 + 0.6 * fbm(Q, 14, 3, 37))[:, None]
    s = sel(32, 39)
    if np.any(s):
        Q = loc[s]
        tarn = fbm(Q, 25, 3, 32)
        alb[s] *= (0.55 + 0.6 * tarn)[:, None]
        rough[s] = 0.15 + 0.5 * (1 - tarn)
    s = sel(46)
    wet[s] = 1.0
    return alb, rough, f0, metal, emis, wrap, wet


# ---------------------------------------------------------------- lighting

def r589(alb):
    """Reflectance at the sodium line from RGB albedo: yellow sits between the R and G primaries."""
    return 0.58 * alb[:, 0] + 0.40 * alb[:, 1] + 0.02 * alb[:, 2]


def light_terms(G, lights, prefix='', sodium_mono=True):
    """Per-light diffuse and specular radiance (linear HDR) for the hit pixels of a G-buffer layer.
    Returns dict with arrays over hits: diff[name] (n,3), spec[name] (n,3), amb (n,3), emis (n,3), alb."""
    hit = G[prefix + 'hit']
    idx = np.nonzero(hit)[0]
    P = G[prefix + 'P'][idx].astype(float)
    N = G[prefix + 'N'][idx].astype(float)
    D = G[prefix + 'D'][idx].astype(float)
    loc = G[prefix + 'loc'][idx].astype(float)
    mat = G[prefix + 'mat'][idx].astype(int)
    S = G[prefix + 'S'][idx].astype(float)
    A = G[prefix + 'A'][idx].astype(float)
    alb, rough, f0, metal, emis, wrap, wet = surface(mat, P, loc, N, None)
    V = -D
    out = dict(idx=idx, mat=mat, alb=alb, N=N, P=P, wet=wet, rough=rough, A=A, emis=emis, diff={}, spec={},
               ndl={}, vis={})
    for j, L in enumerate(lights):
        col = np.asarray(L['col'], float)
        if L['type'] == 'dir':
            Ld = -np.asarray(L['dir'], float)
            Ld = np.broadcast_to(Ld, P.shape)
            att = np.full(len(P), L['I'])
        else:
            Lv = np.asarray(L['pos'], float) - P
            d2 = np.einsum('ij,ij->i', Lv, Lv)
            Ld = Lv / np.sqrt(d2)[:, None]
            att = L['I'] / (d2 + 0.25)
            if 'cone' in L:  # luminaire cutoff: light leaves the housing downward only
                ci, co = L['cone']
                c = Ld[:, 1]
                x = np.clip((c - co) / (ci - co), 0, 1)
                att = att * (x * x * (3 - 2 * x) * 0.97 + 0.03)
        ndl = np.einsum('ij,ij->i', N, Ld)
        w = wrap
        ndlw = np.clip((ndl + w) / (1 + w), 0, 1)
        vis = S[:, j]
        if L['name'].startswith('sodium') and sodium_mono:
            a = r589(alb)[:, None] * col[None, :]
        elif L['name'] == 'moon':
            a = (alb.mean(1, keepdims=True)) * col[None, :]  # ENB: night direct light fully desaturated
        else:
            a = alb * col[None, :]
        diff = a * (ndlw * vis * att)[:, None] * (1 - metal)[:, None]
        H = Ld + V
        H /= np.maximum(np.linalg.norm(H, axis=1, keepdims=True), 1e-6)
        ndh = np.clip(np.einsum('ij,ij->i', N, H), 0, 1)
        sh = np.clip(2.0 / np.maximum(rough, 0.02) ** 2 - 2, 1, 4000)
        vdn = np.clip(np.einsum('ij,ij->i', V, N), 0, 1)
        fres = f0 + (1 - f0) * (1 - vdn) ** 5
        fres = fres * (0.4 + 0.6 * (1 - rough))
        specw = np.where(metal > 0, 1.0, 1.0) * (1 + 2.5 * wet)
        sc = np.where(metal[:, None] > 0, alb, 1.0)
        spec = sc * col[None, :] * ((sh + 8) / (8 * np.pi) * ndh ** sh * np.clip(ndl, 0, 1) * vis * att * fres * specw)[:, None]
        out['diff'][L['name']] = diff
        out['spec'][L['name']] = spec
        out['ndl'][L['name']] = ndl
        out['vis'][L['name']] = vis
    sky = 0.5 + 0.5 * N[:, 1]
    out['amb'] = (alb.mean(1, keepdims=True) * 0.6 + alb * 0.4) * (A * sky)[:, None]
    return out
