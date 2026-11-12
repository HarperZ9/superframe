"""Lamp Quay at night as SDF: wet flagstones, coping, the harbour, sodium posts, the crooked row,
the Brine's lit door, a crate with a cart-sized fish, bollards and rope, Mother far off."""
import numpy as np
from sdf import (sphere, ellipsoid, capsule, round_cone, box, cyl_y, cone_y, torus_y, smin, smax,
                 length, vnoise, fbm, rot_y, rot_z, rot_x, Frame)

E = dict(stone=0, coping=1, water=2, wall=4, roof=5, win_dark=6, win_lit=7, door_lit=8, wood=9,
         iron=10, sodium=11, fish=12, rope=13, tower=14, lens=15, fish_eye=16, sign=17)

QUAY_EDGE = 2.3
WATER_Y = -1.15


def _ground(P):
    d = box(P, (0, -1.5, QUAY_EDGE - 21.15), (40, 1.5, 21.15))
    near = np.abs(P[:, 1]) < 0.06
    if np.any(near):
        Q = P[near]
        row = np.floor(Q[:, 2] / 0.62)
        off = (row % 2) * 0.47
        u = (Q[:, 0] + off) / 0.94
        fu = np.abs(u - np.round(u)) * 0.94
        fv = np.abs(Q[:, 2] / 0.62 - np.round(Q[:, 2] / 0.62)) * 0.62
        seam = np.minimum(fu, fv)
        groove = 0.007 * np.clip(1 - seam / 0.018, 0, 1)
        bump = 0.004 * fbm(Q, 1.6, 2, 1)
        d[near] += groove - bump
    return d


def _water(P):
    d = P[:, 1] - WATER_Y
    near = np.abs(d) < 0.08
    if np.any(near):
        Q = P[near]
        d[near] -= 0.025 * (fbm(Q * [1, 0, 2.2], 1.6, 3, 7) - 0.5)
    return d


def _post(base, arm_dir):
    base = np.asarray(base, float)
    top = base + [0, 4.0, 0]
    hd = top + np.asarray(arm_dir, float) * 0.55 + [0, 0.12, 0]
    parts = [lambda P: cyl_y(P, base + [0, 2.0, 0], 0.065, 2.0),
             lambda P: cone_y(P, base + [0, 0.25, 0], 0.16, 0.08, 0.25),
             lambda P: capsule(P, top, top + np.asarray(arm_dir, float) * 0.35 + [0, 0.22, 0], 0.035),
             lambda P: capsule(P, top + np.asarray(arm_dir, float) * 0.35 + [0, 0.22, 0], hd, 0.03),
             lambda P: cone_y(P, hd + [0, -0.02, 0], 0.26, 0.06, 0.09)]
    glass = lambda P: ellipsoid(P, hd + [0, -0.16, 0], (0.17, 0.08, 0.17))
    return parts, glass, hd + [0, -0.17, 0]


POST_L = _post((-2.85, 0, 2.45), (0.75, 0, -0.65))
POST_R = _post((2.15, 0, 1.95), (-0.55, 0, -0.85))

# crooked row: (x0, x1, eave height, ridge add, lean, lit-window seed)
HOUSES = [(-11.5, -8.6, 6.8, 2.2, 0.03, 1), (-8.6, -6.3, 8.4, 1.6, -0.025, 2), (-6.3, -3.9, 7.1, 2.6, 0.04, 3),
          (-3.9, -1.6, 9.0, 1.8, -0.02, 4), (-1.6, 0.6, 7.6, 2.4, 0.035, 5), (0.6, 2.6, 8.8, 1.5, -0.03, 6),
          (6.2, 8.4, 8.0, 2.3, 0.02, 7), (8.4, 11.5, 6.9, 2.0, -0.035, 8)]
ROW_Z = -5.2
BRINE = (2.6, 6.2, 4.4)


def _hash(a, b):
    return ((a * 73856093) ^ (b * 19349663)) % 1000 / 1000.0


def _houses(P):
    d = np.full(len(P), 1e9)
    m = np.full(len(P), E['wall'], np.int32)
    for (x0, x1, eh, ra, lean, seed) in HOUSES + [(BRINE[0], BRINE[1], BRINE[2], 1.4, 0.0, 99)]:
        cx = (x0 + x1) / 2
        hw = (x1 - x0) / 2 - 0.03
        Q = P.copy()
        Q[:, 0] = Q[:, 0] - Q[:, 1] * lean
        bb = box(Q, (cx, eh / 2, ROW_Z - 2.0), (hw, eh / 2, 2.0))
        # gable roof: ridge runs along z (gable faces the quay)
        slope = ra / hw
        roof = np.maximum(box(Q, (cx, eh + ra / 2, ROW_Z - 2.0), (hw + 0.12, ra / 2 + 0.06, 2.05)),
                          (Q[:, 1] - eh - ra + np.abs(Q[:, 0] - cx) * slope) / np.sqrt(1 + slope ** 2))
        wall = bb
        # windows and doors: recessed openings on the front face
        z_front = ROW_Z
        wy = []
        if seed == 99:
            win = [(cx - 1.0, 1.35, 0.85, 0.6), (cx + 0.9, 1.15, 0.48, 1.0)]  # bay window, door
        else:
            win = []
            nfl = int((eh - 1.0) // 2.2)
            for fl in range(nfl):
                for k, wxk in enumerate((cx - hw * 0.45, cx + hw * 0.45)):
                    win.append((wxk, 1.6 + fl * 2.2, 0.32, 0.55))
        for (wx, wyc, ww, wh) in win:
            hole = box(Q, (wx, wyc, z_front), (ww, wh, 0.12))
            wall = smax(wall, -hole, 0.01)
        d1 = np.minimum(wall, roof)
        sel = d1 < d
        d[sel] = d1[sel]
        m[sel] = np.where(roof[sel] < wall[sel], E['roof'], E['wall'])
        # panes set back in the openings
        for i, (wx, wyc, ww, wh) in enumerate(win):
            pane = box(Q, (wx, wyc, z_front - 0.09), (ww, wh, 0.02))
            lit = (seed == 99) or (_hash(seed, i) > 0.62)
            mat = E['door_lit'] if (seed == 99 and i == 1) else (E['win_lit'] if lit else E['win_dark'])
            sel = pane < d
            d[sel] = pane[sel]
            m[sel] = mat
            # mullions
            mul = np.minimum(box(Q, (wx, wyc, z_front - 0.07), (0.018, wh, 0.02)),
                             box(Q, (wx, wyc + wh * 0.15, z_front - 0.07), (ww, 0.018, 0.02)))
            if not (seed == 99 and i == 1):
                sel = mul < d
                d[sel] = mul[sel]
                m[sel] = E['wood']
    # the Brine's sign
    sign = box(P, (4.4, 3.35, ROW_Z + 0.12), (1.2, 0.28, 0.04), 0.02)
    sel = sign < d
    d[sel] = sign[sel]
    m[sel] = E['sign']
    return d, m


def _props(P):
    items = []
    # crate with slats
    items.append((box(P, (-2.45, 0.32, -1.25), (0.45, 0.32, 0.32), 0.02), E['wood']))
    # the cart-sized fish lying on the crate and the stones, mouth agape
    ff = Frame((-2.35, 0.78, -1.15), rot_y(0.5) @ rot_z(-0.25))
    Q = ff.to_local(P)
    body = ellipsoid(Q, (0, 0, 0), (0.85, 0.22, 0.16))
    body = smin(body, ellipsoid(Q, (0.62, 0.02, 0), (0.30, 0.25, 0.17)), 0.08)
    tail = np.maximum(box(Q, (-1.0, 0, 0), (0.22, 0.28, 0.015)), -box(Q, (-1.25, 0, 0), (0.12, 0.12, 0.1)))
    body = smin(body, tail, 0.06)
    body = smax(body, -ellipsoid(Q, (0.92, -0.04, 0), (0.12, 0.08, 0.2)), 0.02)
    items.append((body - 0.004 * vnoise(Q * [1, 3, 3], 40, 5), E['fish']))
    items.append((sphere(Q, (0.70, 0.07, 0.15), 0.05), E['fish_eye']))
    # bollards and rope
    for (bx, bz) in ((-3.7, 1.75), (2.95, 1.85)):
        items.append((smin(cyl_y(P, (bx, 0.22, bz), 0.15, 0.22), ellipsoid(P, (bx, 0.46, bz), (0.2, 0.08, 0.2)), 0.05),
                      E['iron']))
    for i in range(4):
        items.append((torus_y(P, (2.35, 0.03 + i * 0.05, 1.55), 0.30 - i * 0.03, 0.028), E['rope']))
    # coping stones along the quay edge
    items.append((box(P, (0, 0.05, QUAY_EDGE - 0.17), (40, 0.06, 0.19), 0.03), E['coping']))
    # sodium posts
    for parts, glass, _ in (POST_L, POST_R):
        dpost = parts[0](P)
        for f in parts[1:]:
            dpost = smin(dpost, f(P), 0.02)
        items.append((dpost, E['iron']))
        items.append((glass(P), E['sodium']))
    # Mother: far, a swollen head on a goitred neck, the lens band glowing
    mb = np.array([-8.0, 0, -26.0])
    tw = smin(cone_y(P, mb + [0, 7, 0], 2.2, 1.3, 7), sphere(P, mb + [0.4, 13.2, 0], 2.0), 0.8)
    tw = smin(tw, sphere(P, mb + [0, 17.0, 0], 2.9), 0.6)
    items.append((tw, E['tower']))
    items.append((np.maximum(sphere(P, mb + [0, 17.0, 0], 2.95), np.abs(P[:, 1] - mb[1] - 17.2) - 0.7), E['lens']))
    d = items[0][0]
    m = np.full(len(P), items[0][1], np.int32)
    for di, mi in items[1:]:
        sel = di < d
        d = np.where(sel, di, d)
        m[sel] = mi
    return d, m


def env(P):
    d = _ground(P)
    m = np.full(len(P), E['stone'], np.int32)
    w = _water(P)
    sel = w < d
    d[sel] = w[sel]
    m[sel] = E['water']
    # buildings only near the row
    nearm = P[:, 2] < ROW_Z + 2.0
    far = ~nearm
    d[far] = np.minimum(d[far], P[far, 2] - (ROW_Z + 0.3))
    near = np.nonzero(nearm)[0]
    if len(near):
        dh, mh = _houses(P[near])
        sel = dh < d[near]
        d[near[sel]] = dh[sel]
        m[near[sel]] = mh[sel]
    dp, mp = _props(P)
    sel = dp < d
    d[sel] = dp[sel]
    m[sel] = mp[sel]
    return d, m


def ground_only(P):
    d = P[:, 1].copy()
    m = np.zeros(len(P), np.int32)
    return d, m
