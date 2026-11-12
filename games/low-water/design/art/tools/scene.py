"""Scene assembly: the quay moment (Lamb, Keel, Sabine under sodium) and test scenes."""
import numpy as np
import env as E
import cast
from model import Scene

REFLECT = [E.E['stone'], E.E['water'], E.E['coping']]

SODIUM = (1.0, 0.36, 0.03)      # low-pressure sodium, 589 nm, as linear RGB
PARAFFIN = (1.0, 0.56, 0.24)    # about 1900 K flame
MOON = (0.62, 0.68, 0.85)
MOON_DIR = tuple(np.array([0.30, -0.50, 0.81]) / np.linalg.norm([0.30, -0.50, 0.81]))

POS = dict(keel=((-1.0, 0, 1.45), 0.70), lamb=((0.5, 0, 0.45), -0.62), sabine=((1.85, 0, -0.45), -0.85))


def lights_for(lamb_g):
    return [
        dict(name='sodium_l', type='point', pos=E.POST_L[2], col=SODIUM, I=34.0, shadow=True, k=16, cone=(0.62, 0.30)),
        dict(name='sodium_r', type='point', pos=E.POST_R[2], col=SODIUM, I=30.0, shadow=True, k=16, cone=(0.62, 0.30)),
        dict(name='moon', type='dir', dir=MOON_DIR,
             col=MOON, I=0.9, shadow=True, k=10),
        dict(name='lantern', type='point', pos=tuple(lamb_g.lantern), col=PARAFFIN, I=1.8, shadow=False),
        dict(name='door', type='point', pos=(4.05, 1.1, -4.75), col=PARAFFIN, I=5.0, shadow=True, k=8),
    ]


def build(kind):
    if kind in ('keel', 'lamb', 'sabine'):
        g = getattr(cast, kind)(0, (0, 0, 0), 0.0)
        S = Scene([g], E.ground_only)
        lam = g if kind == 'lamb' else cast.lamb(9, (50, 0, 50), 0)
        return S, lights_for(lam)
    k = cast.keel(0, *POS['keel'])
    l = cast.lamb(1, *POS['lamb'])
    s = cast.sabine(2, *POS['sabine'])
    S = Scene([k, l, s], E.env)
    S.keel_puddle = k.puddle
    return S, lights_for(l)
