"""Cameras for the style frames. Hero: the quay moment. Play: the game's view (near-orthographic,
35.26 degrees down, figures about 150 px tall at 1080p, per cleanroom CHARACTER-PRESENTATION 7.4).
Portraits: each face in the light of that moment."""
import numpy as np
import scene as scn
from sdf import rot_y

HERO = dict(pos=[-1.4, 2.1, 6.2], target=[0.75, 1.2, -0.2], fov=34)


def play():
    tgt = np.array([0.45, 0.8, 0.6])
    pitch = np.radians(35.26)
    yaw = np.radians(-30)
    d = 60.0
    off = np.array([np.sin(yaw) * np.cos(pitch), np.sin(pitch), np.cos(yaw) * np.cos(pitch)]) * d
    return dict(pos=list(tgt + off), target=list(tgt), fov=10.5)


def portrait(who):
    o, yaw = scn.POS[who]
    o = np.array(o, float)
    face = dict(keel=(0.0, 2.06, 0.10), lamb=(0.09, 1.82, 0.21), sabine=(0.0, 1.40, 0.17))[who]
    R = rot_y(yaw)
    f = o + R @ np.array(face)
    fwd = R @ np.array([0, 0, 1.0])
    side = dict(keel=-0.45, lamb=0.35, sabine=0.45)[who]
    dirv = fwd * np.cos(side) + np.cross([0, 1, 0], fwd) * np.sin(side)
    dist = dict(keel=1.25, lamb=1.15, sabine=1.0)[who]
    pos = f + dirv * dist + np.array([0, 0.02, 0])
    return dict(pos=list(pos), target=list(f + np.array([0, -0.08, 0])), fov=30)
