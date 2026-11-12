"""Parametric grotesque head and hands as SDF clusters.

A character is a set of numbers on one face (CHARACTERS-ART rule 6), pushed far enough that the
three principals cannot be confused at any size: Keel's head is a tall wet egg, Sabine's a wide
loaf, Lamb's a beak on a stalk.
"""
import numpy as np
from sdf import (sphere, ellipsoid, capsule, round_cone, box, onion, smax, smin, length,
                 Frame, ridged, fbm, vnoise)
from model import Cluster

HEAD_DEFAULT = dict(
    s=1.0,
    cran=(0.085, 0.105, 0.100), cran_c=(0.0, 0.025, -0.012),
    face=(0.066, 0.075, 0.07), face_c=(0.0, -0.045, 0.035),
    jaw_w=0.060, jaw_y=-0.055, jaw_len=0.125, chin_z=0.072, chin_r=0.026, jaw_r=0.024,
    cheek=(0.047, -0.012, 0.068, 0.024),
    brow=(0.043, 0.036, 0.083, 0.014),
    eye_x=0.034, eye_y=0.014, eye_z=0.080, eye_r=0.0125, iris=0.48,
    lid_up=0.15, lid_lo=-0.55, lid_tilt=0.0, lid_t=0.0022,
    nose_bridge=(0.020, 0.090), nose_tip=(-0.035, 0.118), nose_r=(0.009, 0.012),
    hook=0.0, nose_wing=0.012, wing_r=0.0105,
    mouth_y=-0.066, mouth_z=0.086, mouth_w=0.024, lip_t=0.006, smile=0.0, lip_full=1.0,
    ear=(0.026, 0.0), jowl=0.0, neck_len=0.14, neck_r=0.045,
    gaze=(0.0, 0.0, 1.0),
)


def _p(prm, key):
    return prm.get(key, HEAD_DEFAULT[key])


def head(frame, prm, skin_mat, iris_mat, eye_mat=23, pupil_mat=24, disp=None, extra_skin=(),
         extra_carve=()):
    """Returns clusters for a head in `frame` (frame maps group-local to head-local)."""
    P = dict(HEAD_DEFAULT)
    P.update(prm)
    cr = np.array(P['cran']); cc = np.array(P['cran_c'])
    fr = np.array(P['face']); fc = np.array(P['face_c'])
    jw, jy, jl, cz = P['jaw_w'], P['jaw_y'], P['jaw_len'], P['chin_z']
    ex, ey, ez, er = P['eye_x'], P['eye_y'], P['eye_z'], P['eye_r']
    by, bz = P['brow'][1], P['brow'][2]
    nb, nt = P['nose_bridge'], P['nose_tip']
    my, mz, mw = P['mouth_y'], P['mouth_z'], P['mouth_w']
    gaze = np.asarray(P['gaze'], float); gaze = gaze / np.linalg.norm(gaze)
    eyes_c = [np.array([sx * ex, ey, ez - er * 0.45]) for sx in (-1, 1)]

    parts = [
        lambda X: ellipsoid(X, cc, cr),
        lambda X: ellipsoid(X, fc, fr),
        lambda X: round_cone(X, (-jw, jy, -0.012), (-0.012, -jl, cz - 0.004), P['jaw_r'], P['chin_r'] * 0.8),
        lambda X: round_cone(X, (jw, jy, -0.012), (0.012, -jl, cz - 0.004), P['jaw_r'], P['chin_r'] * 0.8),
        lambda X: sphere(X, (0, -jl, cz), P['chin_r']),
        lambda X: capsule(X, (-P['brow'][0], by, bz), (P['brow'][0], by, bz), P['brow'][3]),
        lambda X: round_cone(X, (0, nb[0], nb[1]), (0, nt[0], nt[1]), P['nose_r'][0], P['nose_r'][1]),
        lambda X: ellipsoid(X, (0, my + 0.0065, mz), (mw, P['lip_t'] * P['lip_full'], 0.015)),
        lambda X: ellipsoid(X, (0, my - 0.0075, mz - 0.002), (mw * 0.86, P['lip_t'] * 1.25 * P['lip_full'], 0.015)),
        lambda X: round_cone(X, (0, -0.07, -0.03), (0, -0.07 - P['neck_len'], -0.035), P['neck_r'], P['neck_r'] * 1.12),
    ]
    ck = P['cheek']
    for sx in (-1, 1):
        parts.append(lambda X, sx=sx: ellipsoid(X, (sx * ck[0], ck[1], ck[2]), (ck[3] * 1.15, ck[3] * 0.85, ck[3])))
        parts.append(lambda X, sx=sx: sphere(X, (sx * P['nose_wing'], nt[0] + 0.005, nt[1] - 0.013), P['wing_r']))
        e0, e1 = P['ear']
        if e0 > 0:
            parts.append(lambda X, sx=sx: ellipsoid(X, (sx * (cr[0] - 0.004 + e1), -0.008, -0.012),
                                                    (0.011, e0 * 1.35, e0 * 0.9)))
        if P['jowl'] > 0:
            parts.append(lambda X, sx=sx: sphere(X, (sx * (jw * 0.85), -0.075, 0.034), P['jowl']))
    if P.get('nose_hump') is not None:  # a two-segment beak: bridge to hump, hump down to the tip
        hp = P['nose_hump']
        parts[6] = lambda X: smin(round_cone(X, (0, nb[0], nb[1]), (0, hp[0], hp[1]), P['nose_r'][0], P['nose_r'][0] * 1.05),
                                  round_cone(X, (0, hp[0], hp[1]), (0, nt[0], nt[1]), P['nose_r'][0] * 1.05, P['nose_r'][1]), 0.006)
    elif P['hook'] != 0:
        mid = (np.array(nb) * 0.45 + np.array(nt) * 0.55)
        parts.append(lambda X: sphere(X, (0, mid[0], mid[1] + P['hook'] * 0.6), P['nose_r'][0] * 1.15))
    # eyelids: thin shells over the eyeball, cut by a tilted lid line
    lt = P['lid_t']
    for i, sx in enumerate((-1, 1)):
        ec = eyes_c[i]
        up_h = er * P['lid_up']
        lo_h = er * P['lid_lo']
        tilt = P['lid_tilt']

        def lid_up(X, ec=ec, sx=sx, up_h=up_h, tilt=tilt):
            q = X - ec
            yr = q[:, 1] - tilt * q[:, 0] * sx
            return np.maximum(onion(length(q) - (er + lt * 1.2), lt), up_h - yr)

        def lid_lo(X, ec=ec, sx=sx, lo_h=lo_h):
            q = X - ec
            return np.maximum(onion(length(q) - (er + lt * 1.0), lt * 0.8), q[:, 1] - lo_h)

        parts.append(lid_up)
        parts.append(lid_lo)
    parts.extend(extra_skin)

    carve = []
    for i, sx in enumerate((-1, 1)):
        ec = eyes_c[i]
        carve.append(lambda X, ec=ec: ellipsoid(X, ec + np.array([0, 0, 0.004]), (er * 1.55, er * 1.12, er * 1.15)))
    sm = P['smile']

    def mouth_slit(X):
        q = X - np.array([0, my, mz + 0.01])
        y = q[:, 1] - sm * (q[:, 0] / mw) ** 2 * 0.012
        return box(np.stack([q[:, 0], y, q[:, 2]], 1), (0, 0, 0), (mw * 0.98, 0.0012, 0.022))

    carve.append(mouth_slit)
    for sx in (-1, 1):
        carve.append(lambda X, sx=sx: sphere(X, (sx * P['nose_wing'] * 0.55, nt[0] - 0.006, nt[1] - 0.006), 0.0042))
    carve.extend(extra_carve)

    bound = (np.array([0, -0.06, 0.02]), 0.30)
    clusters = [Cluster(parts, skin_mat, k=0.012, carve=carve, carve_k=0.005, disp=disp,
                        frame=frame, bound=bound)]
    # eyeballs, irises, pupils
    eye_parts = [lambda X, ec=ec: sphere(X, ec, er) for ec in eyes_c]
    clusters.append(Cluster(eye_parts, eye_mat, frame=frame, bound=bound))
    ia = P['iris']
    iris_parts, pupil_parts = [], []
    for ec in eyes_c:
        iris_parts.append(lambda X, ec=ec: np.maximum(length(X - ec) - (er + 0.0004),
                                                       er * np.cos(ia) - (X - ec) @ gaze))
        pupil_parts.append(lambda X, ec=ec: np.maximum(length(X - ec) - (er + 0.0007),
                                                        er * np.cos(ia * 0.45) - (X - ec) @ gaze))
    clusters.append(Cluster(iris_parts, iris_mat, frame=frame, bound=bound))
    clusters.append(Cluster(pupil_parts, pupil_mat, frame=frame, bound=bound))
    return clusters


def hand(frame, mat, size=1.0, curl=0.3, thumb=0.5, spread=0.08, fat=1.0, length_k=1.0):
    """A hand in `frame`: wrist at origin, fingers along local -y, palm facing local +z,
    thumb on local +x. curl in radians per joint (0 open, 1.4 fist)."""
    s = size
    parts = [lambda X: box(X, (0, -0.045 * s, 0.0), (0.040 * s * fat, 0.045 * s, 0.014 * s * fat), 0.012 * s)]
    lens = np.array([0.044, 0.050, 0.047, 0.038]) * s * length_k
    xs = np.array([0.028, 0.009, -0.010, -0.028]) * s * fat
    for i in range(4):
        base = np.array([xs[i], -0.088 * s, 0.0])
        ang = spread * (i - 1.5)
        segs = [0.45, 0.32, 0.23]
        pts = [base]
        a = 0.0
        for j, sl in enumerate(segs):
            a += curl * (1.0 if j else 0.8)
            dirv = np.array([np.sin(ang), -np.cos(a), np.sin(a)])
            dirv = dirv / np.linalg.norm(dirv)
            pts.append(pts[-1] + dirv * lens[i] * sl * 1.6)
        r0 = 0.0105 * s * fat
        for j in range(3):
            a0, a1 = pts[j], pts[j + 1]
            parts.append(lambda X, a0=a0, a1=a1, r=r0 * (1 - 0.12 * j): round_cone(X, a0, a1, r, r * 0.9))
    tb = np.array([0.038 * s * fat, -0.025 * s, 0.008 * s])
    t1 = tb + np.array([0.02, -0.03, 0.02 + 0.02 * thumb]) * s * length_k
    t2 = t1 + np.array([-0.005 - 0.015 * thumb, -0.025, 0.012 + 0.012 * thumb]) * s * length_k
    parts.append(lambda X: round_cone(X, tb, t1, 0.013 * s * fat, 0.011 * s * fat))
    parts.append(lambda X: round_cone(X, t1, t2, 0.011 * s * fat, 0.0095 * s * fat))
    return Cluster(parts, mat, k=0.008 * s, frame=frame, bound=(np.array([0, -0.08 * s, 0.02 * s]), 0.16 * s))


def look_frame(origin, forward, up=(0, 1, 0)):
    """Frame at origin whose local +z points along forward, local +y near up."""
    f = np.asarray(forward, float); f = f / np.linalg.norm(f)
    u = np.asarray(up, float)
    x = np.cross(u, f); x = x / np.linalg.norm(x)
    y = np.cross(f, x)
    R = np.stack([x, y, f], 1)
    return Frame(origin, R)


def hand_frame(wrist, fingers_dir, palm_dir):
    """Frame for hand(): local -y along fingers_dir, local +z along palm_dir."""
    yv = -np.asarray(fingers_dir, float); yv /= np.linalg.norm(yv)
    z = np.asarray(palm_dir, float)
    z = z - yv * (z @ yv); z /= np.linalg.norm(z)
    x = np.cross(yv, z)
    return Frame(wrist, np.stack([x, yv, z], 1))
