"""Lamb, Keel and Sabine as SDF groups, pushed for silhouette and face.

Body-local axes: +y up, +z the way the character faces, +x the character's left.
Design intent per character (design/ART-DIRECTION.md section 4):
  Keel   a 2.3 m wet black column, a tall grey prune of a face under a funnel cap, a puddle.
  Lamb   a coat-hanger: sloped shoulders, bell coat, a beak on a long neck under a tipped hat.
  Sabine a 1.5 m barrel on tiptoe, a loaf-wide face split by a grin, a fork through the bun.
"""
import numpy as np
from sdf import (sphere, ellipsoid, capsule, round_cone, box, cyl_y, cone_y, torus_y, onion,
                 smin, smax, length, Frame, rot_x, rot_y, rot_z, ridged, fbm, vnoise)
from model import Cluster, Group
from anatomy import head, hand, look_frame, hand_frame

M = dict(
    skin_keel=20, skin_lamb=21, skin_sab=22, eye=23, pupil=24, hair_dark=25, hair_grey=26,
    iris_keel=27, iris_lamb=28, iris_sab=29, coat_keel=30, cap_keel=31, brass=32, pale=33,
    coat_lamb=34, lining=35, hat_lamb=36, leather=37, lantern=38, tin=39, skirt=40, apron=41,
    blouse=42, shawl=43, trousers=44, egg=45, drip=46, stick=47, lips_sab=48, hair_lamb=49,
)


# One sheet per person: head, neck and collar. Shared with the character forge (design/art/heads.json).
HEADS = dict(
    keel=dict(
            cran=(0.080, 0.135, 0.098), cran_c=(0, 0.045, -0.015),
            face=(0.060, 0.11, 0.066), face_c=(0, -0.055, 0.032),
            jaw_w=0.052, jaw_y=-0.07, jaw_len=0.190, chin_z=0.064, chin_r=0.025, jaw_r=0.02,
            cheek=(0.045, -0.030, 0.062, 0.018),
            brow=(0.040, 0.040, 0.082, 0.010),
            eye_x=0.031, eye_y=0.016, eye_z=0.076, eye_r=0.0135, iris=0.52,
            lid_up=0.32, lid_lo=-0.25, lid_tilt=-0.35,
            nose_bridge=(0.025, 0.088), nose_tip=(-0.060, 0.104), nose_r=(0.007, 0.010), nose_wing=0.010,
            mouth_y=-0.118, mouth_z=0.074, mouth_w=0.013, lip_t=0.004, lip_full=0.8, smile=-0.6,
            ear=(0.024, 0.0), neck_len=0.17, neck_r=0.040, gaze=(0.35, -0.05, 1.0),
    ),
    lamb=dict(
            cran=(0.083, 0.108, 0.104), cran_c=(0, 0.03, -0.022),
            face=(0.058, 0.085, 0.062), face_c=(0, -0.05, 0.028),
            jaw_w=0.050, jaw_y=-0.065, jaw_len=0.150, chin_z=0.085, chin_r=0.022, jaw_r=0.018,
            cheek=(0.044, -0.022, 0.062, 0.017),
            brow=(0.030, 0.038, 0.080, 0.0095),
            eye_x=0.031, eye_y=0.016, eye_z=0.077, eye_r=0.0115, iris=0.5,
            lid_up=-0.05, lid_lo=-0.6, lid_tilt=-0.25,
            nose_bridge=(0.030, 0.092), nose_hump=(-0.002, 0.150), nose_tip=(-0.050, 0.152), nose_r=(0.0080, 0.0060),
            hook=0.0, nose_wing=0.0085, wing_r=0.0070,
            mouth_y=-0.082, mouth_z=0.088, mouth_w=0.024, lip_t=0.0045, lip_full=0.8, smile=-0.3,
            ear=(0.022, 0.0), neck_len=0.20, neck_r=0.036, gaze=(-0.35, 0.0, 1.0),
    ),
    sabine=dict(
            cran=(0.112, 0.092, 0.098), cran_c=(0, 0.035, -0.015),
            face=(0.092, 0.072, 0.07), face_c=(0, -0.035, 0.032),
            jaw_w=0.085, jaw_y=-0.05, jaw_len=0.105, chin_z=0.066, chin_r=0.03, jaw_r=0.032,
            cheek=(0.058, -0.030, 0.064, 0.032),
            brow=(0.048, 0.030, 0.078, 0.011),
            eye_x=0.036, eye_y=0.010, eye_z=0.078, eye_r=0.0095, iris=0.62,
            lid_up=0.25, lid_lo=-0.35, lid_tilt=0.4,
            nose_bridge=(0.010, 0.088), nose_tip=(-0.028, 0.110), nose_r=(0.008, 0.016), nose_wing=0.015,
            mouth_y=-0.060, mouth_z=0.090, mouth_w=0.058, lip_t=0.0075, lip_full=1.1, smile=1.6,
            ear=(0.025, 0.0), jowl=0.022, neck_len=0.09, neck_r=0.055, gaze=(-0.45, 0.05, 1.0),
    ),
)


def _limb(a, b, r1, r2):
    return lambda X: round_cone(X, a, b, r1, r2)


# ============================================================== KEEL

def keel(gid, origin, yaw):
    fr = Frame(origin, rot_y(yaw))
    C = []
    # greatcoat: a long narrow column, hem flared, buttoned to the throat
    coat = [
        _limb((0, 0.10, 0.0), (0, 1.05, 0.0), 0.255, 0.175),
        _limb((0, 1.05, 0.0), (0, 1.68, -0.005), 0.175, 0.165),
        _limb((-0.17, 1.70, -0.01), (0.17, 1.70, -0.01), 0.07, 0.07),
        lambda X: cyl_y(X, (0, 1.80, 0.0), 0.078, 0.085),  # standing collar
    ]

    def hem_rag(X):  # ragged, sodden hem: noise eats the bottom 6 cm
        return np.where(X[:, 1] < 0.2, (0.16 - X[:, 1]) * 0.0 + 0.012 * (vnoise(X, 18, 3) - 0.5), 0.0)

    C.append(Cluster(coat, M['coat_keel'], k=0.05, disp=hem_rag,
                     carve=[lambda X: box(X, (0, 0.0, 0), (0.5, 0.075, 0.5))]))
    # coat skirt slit at back + lapel seams as raised strips
    C.append(Cluster([lambda X: box(X, (0.0, 1.1, 0.17), (0.006, 0.55, 0.02), 0.004)], M['coat_keel']))
    # two rows of brass buttons following the coat surface
    btn = []
    for i in range(7):
        y = 0.62 + i * 0.165
        r = 0.255 + (0.175 - 0.255) * min(1, (y - 0.10) / 0.95) if y < 1.05 else 0.175 - 0.01 * (y - 1.05) / 0.63
        for sx in (-1, 1):
            xo = sx * 0.055
            zo = np.sqrt(max(r * r - xo * xo, 0.0)) + 0.002
            btn.append(lambda X, c=(xo, y, zo): sphere(X, c, 0.0125))
    C.append(Cluster(btn, M['brass']))
    # boots in a puddle
    for sx in (-1, 1):
        C.append(Cluster([lambda X, sx=sx: ellipsoid(X, (sx * 0.085, 0.05, 0.05), (0.055, 0.055, 0.125))],
                         M['leather']))
    # right arm (character's right = -x) straight down, rigid; huge wet cuff
    sR, eR, wR = np.array([-0.19, 1.66, 0.0]), np.array([-0.215, 1.26, -0.01]), np.array([-0.205, 0.90, 0.03])
    C.append(Cluster([_limb(sR, eR, 0.068, 0.060), _limb(eR, wR, 0.060, 0.072),
                      lambda X: capsule(X, wR + [0, 0.035, 0], wR + [0, 0.005, 0.0], 0.080)],
                     M['coat_keel'], k=0.02))
    hR = hand_frame(wR - [0, 0.01, 0], (0.0, -1, 0.08), (0.9, 0, 0.3))
    C.append(hand(hR, M['skin_keel'], size=1.25, curl=0.35, fat=0.85, length_k=1.35))
    # left arm crooked round the brass speaking trumpet tucked against the ribs
    sL, eL, wL = np.array([0.19, 1.66, 0.0]), np.array([0.235, 1.30, -0.04]), np.array([0.13, 1.16, 0.20])
    C.append(Cluster([_limb(sL, eL, 0.068, 0.060), _limb(eL, wL, 0.060, 0.070),
                      lambda X: capsule(X, wL - [0.01, 0, 0.03], wL + [0.0, 0.0, 0.0], 0.078)],
                     M['coat_keel'], k=0.02))
    hL = hand_frame(wL + [0, 0, 0.02], (-0.3, -0.25, 0.9), (-1, 0.1, 0.1))
    C.append(hand(hL, M['skin_keel'], size=1.25, curl=0.9, fat=0.85, length_k=1.35))
    tr_a, tr_b = np.array([0.24, 1.34, -0.24]), np.array([0.10, 1.10, 0.40])
    C.append(Cluster([lambda X: round_cone(X, tr_a, tr_b, 0.016, 0.03),
                      lambda X: round_cone(X, tr_b - (tr_b - tr_a) * 0.12, tr_b + (tr_b - tr_a) * 0.02, 0.03, 0.105),
                      lambda X: sphere(X, tr_a, 0.022)],
                     M['brass'], k=0.03,
                     carve=[lambda X: round_cone(X, tr_b - (tr_b - tr_a) * 0.08, tr_b + (tr_b - tr_a) * 0.04, 0.02, 0.095)]))
    # head: a tall grey egg, long jaw, tiny mouth, wet pale eyes, waterlogged skin
    hf = Frame((0.0, 2.02, 0.012), rot_y(-0.18) @ rot_x(0.06))

    def prune(X):
        # fingertip-in-the-bath wrinkles: ridged noise stretched vertically, strongest on cheeks
        Q = X * np.array([1.0, 0.28, 1.0])
        w = np.clip((X[:, 2] + 0.02) * 12, 0, 1)
        return -0.0007 * w * ridged(Q, 110, 2, 11)

    keel_head = HEADS['keel']
    C.extend(head(hf, keel_head, M['skin_keel'], M['iris_keel'], disp=prune))
    hfc = hf
    # grey sideburns
    side = [lambda X, sx=sx: ellipsoid(X, (sx * 0.072, -0.03, 0.022), (0.008, 0.045, 0.014)) for sx in (-1, 1)]
    C.append(Cluster(side, M['hair_grey'], k=0.01, frame=hfc,
                     disp=lambda X: -0.0012 * vnoise(X, 160, 4)))
    # peaked harbourmaster's cap that funnels water: tall crown, a downturned peak, white badge
    cap_f = hf.child((0, 0.128, -0.012), rot_x(-0.08))
    C.append(Cluster([lambda X: cone_y(X, (0, 0.040, 0), 0.096, 0.13, 0.05),
                      lambda X: ellipsoid(X, (0, 0.085, 0.01), (0.14, 0.022, 0.13)),
                      lambda X: torus_y(X, (0, 0.002, 0), 0.093, 0.012)],
                     M['cap_keel'], k=0.01, frame=cap_f))
    def peak(X):
        Q = np.stack([X[:, 0], X[:, 1] + 0.30 * np.clip(X[:, 2] - 0.06, 0, None), X[:, 2]], 1)
        return np.maximum(ellipsoid(Q, (0, 0.004, 0.075), (0.104, 0.009, 0.080)), 0.03 - X[:, 2])
    C.append(Cluster([peak], M['cap_keel'], frame=cap_f))
    C.append(Cluster([lambda X: ellipsoid(X, (0, 0.05, 0.118), (0.026, 0.02, 0.008))], M['pale'], frame=cap_f))
    # the drip: strings of water from both cuffs, the cap's back and the peak, and a puddle
    drips = []
    for (x0, y0, z0, n, seed) in [(-0.205, 0.80, 0.03, 9, 1), (0.08, 1.05, 0.30, 7, 2),
                                  (0.0, 2.03, -0.14, 6, 3), (0.0, 2.05, 0.21, 5, 4)]:
        rng = np.random.default_rng(seed)
        y = y0
        for i in range(n):
            ln = rng.uniform(0.03, 0.09)
            drips.append(lambda X, c=(x0, y, z0), ln=ln: capsule(X, c, (c[0], c[1] - ln, c[2]), 0.0035))
            y -= ln + rng.uniform(0.04, 0.16)
            if y < 0.05:
                break
    C.append(Cluster(drips, M['drip']))
    g = Group('keel', fr, C, fr.to_world((0, 1.15, 0.05)), 1.35, gid)
    g.puddle = (fr.to_world((0.0, 0, 0.12)), 0.62)
    return g


# ============================================================== LAMB

def lamb(gid, origin, yaw):
    fr = Frame(origin, rot_y(yaw))
    C = []
    lean = rot_x(0.12)  # the stoop: the whole upper body tips forward from the hips
    up = Frame((0, 0.98, 0.0), lean)  # torso frame (body-local)

    def T(p):
        return up.to_world(p)

    # legs in narrow trousers under a bell of coat, boots splayed
    for sx, kz in ((-1, 0.06), (1, -0.02)):
        hip = np.array([sx * 0.085, 0.95, 0.0])
        knee = np.array([sx * 0.10, 0.50, kz + 0.03])
        ank = np.array([sx * 0.115, 0.08, kz])
        C.append(Cluster([_limb(hip, knee, 0.068, 0.055), _limb(knee, ank, 0.055, 0.045)], M['trousers'], k=0.02))
        C.append(Cluster([lambda X, a=ank, sx=sx: ellipsoid(X, a + [sx * 0.01, -0.03, 0.05], (0.05, 0.05, 0.13)),
                          lambda X, a=ank: cyl_y(X, a + [0, 0.05, 0], 0.05, 0.06)], M['leather'], k=0.02))
    # greatcoat: bell skirt from mid-calf, sloping coat-hanger shoulders, split front
    hem_y = 0.40
    coat = [
        lambda X: round_cone(X, (0, hem_y + 0.02, 0.01), (0, 1.0, 0.0), 0.30, 0.17),
        lambda X: round_cone(X, T((0, 0.0, 0)), T((0, 0.56, -0.01)), 0.17, 0.15),
        lambda X: round_cone(X, T((-0.20, 0.48, -0.01)), T((0, 0.62, -0.01)), 0.065, 0.09),
        lambda X: round_cone(X, T((0.20, 0.48, -0.01)), T((0, 0.62, -0.01)), 0.065, 0.09),
    ]

    def hem_cut(X):
        return box(X, (0, hem_y - 0.25, 0), (0.6, 0.25, 0.6))

    def front_split(X):  # an open wedge up the front of the skirt to the waist
        q = X - np.array([0, hem_y, 0.3])
        w = 0.004 + np.clip((1.0 - X[:, 1]) * 0.16, 0, 0.12)
        return np.maximum(np.abs(q[:, 0]) - w, np.maximum(X[:, 1] - 1.0, -q[:, 2] - 0.12))

    C.append(Cluster(coat, M['coat_lamb'], k=0.06, carve=[hem_cut, front_split], carve_k=0.01,
                     disp=lambda X: 0.002 * (vnoise(X * [1, 0.15, 1], 22, 9) - 0.5)))
    # oxblood lining showing in the split and the turned-back lapels
    C.append(Cluster([lambda X: np.maximum(round_cone(X, (0, hem_y + 0.02, 0.0), (0, 1.0, -0.01), 0.288, 0.158),
                                           -front_split(X) - 0.0),
                      ], M['lining'], inter=[lambda X: -hem_cut(X)]))
    for sx in (-1, 1):
        lap = Frame(T((sx * 0.055, 0.40, 0.158)), up.R @ rot_z(sx * 0.22))
        C.append(Cluster([lambda X: box(X, (0, 0, 0), (0.018, 0.14, 0.007), 0.005)], M['lining'], frame=lap))
    # pale mass: shirt front and a high white collar
    C.append(Cluster([lambda X: np.maximum(box(X - T((0, 0.45, 0.14)), (0, 0, 0), (0.04, 0.10, 0.02), 0.01), np.abs(up.to_local(X)[:, 0]) - (up.to_local(X)[:, 1] - 0.33) * 0.42),
                      lambda X: cyl_y(X - T((0, 0.62, 0.005)), (0, 0, 0), 0.058, 0.03)], M['pale'], k=0.01))
    # diagonal strap, right shoulder to left hip; the claims case riding the left hip
    s0, s1 = T((-0.13, 0.55, 0.12)), np.array([0.21, 0.92, 0.10])
    C.append(Cluster([lambda X: capsule(X, s0, s1, 0.012), lambda X: capsule(X, T((-0.13, 0.55, -0.1)), s1 + [0, 0, -0.2], 0.012)],
                     M['leather']))
    case_f = Frame((0.29, 0.78, 0.0), rot_y(1.35) @ rot_z(0.08))
    C.append(Cluster([lambda X: box(X, (0, 0, 0), (0.19, 0.135, 0.045), 0.012)], M['leather'], frame=case_f,
                     disp=lambda X: 0.002 * (vnoise(X, 60, 2) - 0.5)))
    C.append(Cluster([lambda X, x=x: box(X, (x, 0.11, 0.047), (0.014, 0.022, 0.006), 0.003) for x in (-0.11, 0.11)],
                     M['brass'], frame=case_f))
    # arms: long (0.80), the left lifting the storm lantern, the right on the Vane's stick
    sL, eL, wL = T((0.20, 0.47, -0.01)), np.array([0.34, 0.92, 0.12]), np.array([0.36, 0.88, 0.45])
    C.append(Cluster([_limb(sL, eL, 0.06, 0.052), _limb(eL, wL, 0.052, 0.06)], M['coat_lamb'], k=0.02))
    hL = hand_frame(wL + [0, -0.01, 0.01], (0.0, -0.3, 1.0), (-1, 0, 0))
    C.append(hand(hL, M['skin_lamb'], size=1.15, curl=1.25, length_k=1.25, fat=0.8))
    lan = np.array([0.38, 0.68, 0.54])
    C.append(Cluster([lambda X: cyl_y(X, lan + [0, 0.11, 0], 0.05, 0.012),
                      lambda X: cyl_y(X, lan - [0, 0.07, 0], 0.055, 0.02),
                      lambda X: capsule(X, lan + [-0.05, 0.03, 0], lan + [-0.05, -0.05, 0], 0.006),
                      lambda X: capsule(X, lan + [0.05, 0.03, 0], lan + [0.05, -0.05, 0], 0.006)],
                     M['tin'], k=0.004))
    def bail(X):
        q = X - lan - [0, 0.10, 0]
        r = np.sqrt((np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2) - 0.06) ** 2 + q[:, 2] ** 2) - 0.004
        return np.maximum(r, -q[:, 1])
    C.append(Cluster([bail], M['tin']))  # the bail handle, a half hoop over the lantern
    C.append(Cluster([lambda X: ellipsoid(X, lan + [0, 0.02, 0], (0.042, 0.075, 0.042))], M['lantern']))
    sR, eR, wR = T((-0.20, 0.47, -0.01)), np.array([-0.30, 0.86, 0.02]), np.array([-0.30, 0.92, 0.30])
    C.append(Cluster([_limb(sR, eR, 0.06, 0.052), _limb(eR, wR, 0.052, 0.06)], M['coat_lamb'], k=0.02))
    st_a, st_b = np.array([-0.40, 0.0, 0.52]), np.array([-0.29, 1.18, 0.29])
    hR = hand_frame(wR + [0.0, -0.005, 0.03], (0.15, 0.1, 1.0), (1, 0.2, 0.0))
    C.append(hand(hR, M['skin_lamb'], size=1.15, curl=1.3, length_k=1.25, fat=0.8))
    C.append(Cluster([lambda X: capsule(X, st_a, st_b, 0.011)], M['stick']))
    ck = st_b + [0, 0.05, 0]
    C.append(Cluster([lambda X: ellipsoid(X, ck, (0.018, 0.03, 0.05)),
                      lambda X: ellipsoid(X, ck + [0, 0.045, -0.055], (0.006, 0.05, 0.035)),
                      lambda X: sphere(X, ck + [0, 0.035, 0.045], 0.016),
                      lambda X: ellipsoid(X, ck + [0, 0.055, 0.05], (0.003, 0.012, 0.012)),
                      lambda X: round_cone(X, ck + [0, 0.035, 0.06], ck + [0, 0.03, 0.08], 0.006, 0.002)],
                     M['tin'], k=0.006))
    # long neck and the beak: hooked nose, heavy lids, long chin; hat tipped back
    neck_base = T((0, 0.62, 0.01))
    hf = Frame(neck_base + np.array([0, 0.235, 0.085]), rot_y(-0.30) @ rot_x(0.10))

    def creases(X):
        fore = np.clip((X[:, 1] - 0.045) * 30, 0, 1) * np.clip(X[:, 2] * 20, 0, 1)
        lines = 0.0005 * fore * (0.5 + 0.5 * np.sin(X[:, 1] * 420 + 3.0 * vnoise(X, 30, 5)))
        sag = -0.0004 * fbm(X, 70, 2, 6)
        return lines + sag

    lamb_head = HEADS['lamb']
    C.extend(head(hf, lamb_head, M['skin_lamb'], M['iris_lamb'], disp=creases))
    # lank hair at the nape and over the ears
    C.append(Cluster([lambda X: ellipsoid(X, (0, -0.005, -0.055), (0.087, 0.08, 0.066))], M['hair_lamb'], frame=hf,
                     inter=[lambda X: X[:, 1] - 0.04, lambda X: X[:, 2] + 0.0],
                     disp=lambda X: -0.0018 * ridged(X * [1.5, 0.25, 1.5], 70, 2, 8)))
    # the hat: a wide soft brim tipped back, a dented crown
    hat_f = hf.child((0, 0.105, -0.025), rot_x(-0.32) @ rot_z(0.06))
    brim = lambda X: np.maximum(np.abs(X[:, 1] - 0.012 * (length(X[:, [0, 2]]) / 0.25) ** 2) - 0.0055,
                                length(X[:, [0, 2]] * [1.0, 0.92]) - 0.255)
    C.append(Cluster([brim,
                      lambda X: cone_y(X, (0, 0.065, 0), 0.105, 0.088, 0.065)],
                     M['hat_lamb'], k=0.012, frame=hat_f,
                     carve=[lambda X: ellipsoid(X, (0, 0.14, 0.0), (0.02, 0.03, 0.08))], carve_k=0.02,
                     disp=lambda X: 0.002 * (vnoise(X, 40, 12) - 0.5)))
    C.append(Cluster([lambda X: onion(cyl_y(X, (0, 0.022, 0), 0.105, 0.016), 0.0015)], M['leather'], frame=hat_f))
    g = Group('lamb', fr, C, fr.to_world((0, 1.0, 0.15)), 1.15, gid)
    g.lantern = fr.to_world(lan + [0, 0.02, 0])
    return g


# ============================================================== SABINE

def sabine(gid, origin, yaw):
    fr = Frame(origin, rot_y(yaw))
    C = []
    lean = rot_x(0.16)
    up = Frame((0, 0.80, 0.02), lean)

    def T(p):
        return up.to_world(p)

    # tiptoe boots peeping under a wide bell skirt
    for sx in (-1, 1):
        C.append(Cluster([lambda X, sx=sx: ellipsoid(X, (sx * 0.10, 0.06, 0.12), (0.055, 0.05, 0.10)),
                          lambda X, sx=sx: cyl_y(X, (sx * 0.10, 0.12, 0.06), 0.045, 0.06)], M['leather'], k=0.03))
    skirt = lambda X: round_cone(X, (0, 0.20, 0.04), (0, 0.82, 0.02), 0.345, 0.225)
    C.append(Cluster([skirt], M['skirt'],
                     carve=[lambda X: box(X, (0, 0.0, 0), (0.6, 0.11, 0.6))],
                     disp=lambda X: 0.012 * np.sin(np.arctan2(X[:, 0], X[:, 2]) * 11 + 2 * vnoise(X, 8, 2))
                     * np.clip(0.9 - X[:, 1], 0, 1)))
    # torso: a barrel with a shelf of bosom, short neck
    torso = [lambda X: round_cone(X, T((0, 0.0, 0)), T((0, 0.36, -0.01)), 0.225, 0.235),
             lambda X: ellipsoid(X, T((0, 0.26, 0.10)), (0.21, 0.12, 0.13)),
             lambda X: round_cone(X, T((-0.25, 0.39, -0.02)), T((0.25, 0.39, -0.02)), 0.085, 0.085)]
    C.append(Cluster(torso, M['blouse'], k=0.07))
    # striped apron: a shell over the front of skirt and bib
    def apron(X):
        d1 = onion(round_cone(X, (0, 0.20, 0.05), (0, 0.82, 0.03), 0.352, 0.232), 0.006)
        d2 = onion(torso[1](X), 0.006)
        d = np.minimum(np.maximum(d1, X[:, 1] - 0.86), np.maximum(d2, 0.0))
        front = np.maximum(np.abs(X[:, 0]) - 0.24, 0.06 - X[:, 2])
        return np.maximum(np.maximum(d, front), 0.16 - X[:, 1])
    C.append(Cluster([apron], M['apron'], disp=lambda X: 0.003 * (vnoise(X, 30, 21) - 0.5)))
    # shawl crossed over the chest and knotted behind
    def shawl(X):
        q = up.to_local(X)
        dt = smin(smin(torso[0](X), torso[1](X), 0.07), torso[2](X), 0.07)
        shell = np.abs(dt - 0.016) - 0.013
        a = 0.95
        u1 = q[:, 0] * np.cos(a) + (q[:, 1] - 0.24) * np.sin(a)
        u2 = -q[:, 0] * np.cos(a) + (q[:, 1] - 0.24) * np.sin(a)
        band = np.minimum(np.abs(u1), np.abs(u2)) - 0.055
        band = np.maximum(band, np.maximum(q[:, 1] - 0.47, 0.06 - q[:, 1]))
        return np.maximum(shell, band)
    knot = [lambda X: sphere(X, T((0, 0.20, -0.25)), 0.05),
            lambda X: round_cone(X, T((0.02, 0.17, -0.27)), T((0.07, -0.12, -0.26)), 0.032, 0.014),
            lambda X: round_cone(X, T((-0.02, 0.17, -0.27)), T((-0.05, -0.08, -0.27)), 0.03, 0.012)]
    C.append(Cluster([shawl] + knot, M['shawl'], k=0.015, disp=lambda X: -0.0015 * vnoise(X, 120, 31)))
    # arms: sleeves rolled to the elbow, bare forearms, hands like hams
    sR, eR, wR = T((0.26, 0.37, -0.02)), np.array([0.43, 0.98, -0.04]), np.array([0.27, 0.80, 0.07])
    C.append(Cluster([_limb(sR, eR, 0.075, 0.068), lambda X: capsule(X, eR + (sR - eR) * 0.12, eR + (sR - eR) * 0.20, 0.078)],
                     M['blouse'], k=0.02))
    C.append(Cluster([_limb(eR, wR, 0.06, 0.05)], M['skin_sab'], k=0.01))
    hR = hand_frame(wR, (-0.55, -0.7, 0.35), (-1, 0.4, -0.2))  # knuckles on the hip
    C.append(hand(hR, M['skin_sab'], size=1.3, curl=1.35, fat=1.3, length_k=0.95))
    sL, eL, wL = T((-0.26, 0.37, -0.02)), np.array([-0.42, 0.95, 0.20]), np.array([-0.40, 1.08, 0.48])
    C.append(Cluster([_limb(sL, eL, 0.075, 0.068), lambda X: capsule(X, eL + (sL - eL) * 0.12, eL + (sL - eL) * 0.20, 0.078)],
                     M['blouse'], k=0.02))
    C.append(Cluster([_limb(eL, wL, 0.058, 0.048)], M['skin_sab'], k=0.01))
    hL = hand_frame(wL, (-0.1, 0.55, 0.8), (0.3, 0.8, -0.4))  # palm up, offering
    C.append(hand(hL, M['skin_sab'], size=1.3, curl=0.55, thumb=0.2, fat=1.3, length_k=0.95, spread=0.12))
    egg = hL.to_world((0.0, -0.11, 0.06))
    C.append(Cluster([lambda X: ellipsoid(X, egg, (0.022, 0.029, 0.022))], M['egg']))
    # head: wide loaf, broad apple cheeks, tiny bright eyes, a grin to the ears, snub nose
    hf = Frame(T((0, 0.60, 0.075)), rot_y(0.30) @ rot_x(-0.10) @ rot_z(0.10))
    sab_head = HEADS['sabine']

    C.extend(head(hf, sab_head, M['skin_sab'], M['iris_sab']))
    C.append(Cluster([lambda X: box(np.stack([X[:, 0], X[:, 1] - 1.6 * (X[:, 0] / 0.058) ** 2 * 0.012, X[:, 2]], 1),
                                    (0, -0.0600, 0.083), (0.046, 0.0022, 0.006), 0.0015)], M['pale'], frame=hf))
    # dark hair cap and the bun, the pickling fork driven through it
    C.append(Cluster([lambda X: ellipsoid(X, (0, 0.045, -0.02), (0.118, 0.092, 0.105)),
                      lambda X: sphere(X, (0, 0.095, -0.085), 0.058)], M['hair_dark'], k=0.02, frame=hf,
                     inter=[lambda X: -(X[:, 1] - 0.02 + 0.6 * np.clip(X[:, 2], 0, 1)) ],
                     disp=lambda X: -0.0035 * ridged(np.stack([X[:, 0] * 4, X[:, 1], X[:, 2]], 1), 60, 2, 41)))
    fk_f = hf.child((0, 0.10, -0.085), rot_z(0.9) @ rot_x(0.3))
    C.append(Cluster([lambda X: capsule(X, (0, -0.09, 0), (0, 0.06, 0), 0.006),
                      lambda X: capsule(X, (-0.012, 0.06, 0), (-0.012, 0.13, 0), 0.0025),
                      lambda X: capsule(X, (0.012, 0.06, 0), (0.012, 0.13, 0), 0.0025),
                      lambda X: capsule(X, (-0.013, 0.06, 0), (0.013, 0.06, 0), 0.003)], M['tin'], k=0.004, frame=fk_f))
    C.append(Cluster([lambda X: capsule(X, (0, -0.14, 0), (0, -0.09, 0), 0.008)], M['stick'], frame=fk_f))
    g = Group('sabine', fr, C, fr.to_world((0, 0.85, 0.1)), 1.0, gid)
    return g
