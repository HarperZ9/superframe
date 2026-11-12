"""Scene graph for the style frames: clusters of SDF parts, groups with bounds, a scene evaluator.

A Cluster is a smooth union of parts with one material, optional carves and displacement.
A Group is a set of clusters in one local frame (a character, a building) with a bounding sphere.
"""
import numpy as np
from sdf import length, smin, smax, Frame


class Cluster:
    def __init__(self, parts, mat, k=0.0, carve=(), carve_k=0.0, disp=None, frame=None,
                 bound=None, inter=()):
        self.parts = list(parts)
        self.mat = mat
        self.k = k
        self.carve = list(carve)
        self.carve_k = carve_k
        self.disp = disp
        self.frame = frame
        self.bound = bound
        self.inter = list(inter)

    def d(self, P):
        if self.frame is not None:
            P = self.frame.to_local(P)
        if self.bound is not None:
            c, r = self.bound
            db = length(P - c) - r
            out = db.copy()
            idx = np.nonzero(db < 0.15)[0]
            if len(idx) == 0:
                return out
            out[idx] = self._d(P[idx])
            return out
        return self._d(P)

    def _d(self, P):
        d = self.parts[0](P)
        for f in self.parts[1:]:
            d = smin(d, f(P), self.k)
        for f in self.inter:
            d = np.maximum(d, f(P))
        for f in self.carve:
            d = smax(d, -f(P), self.carve_k)
        if self.disp is not None:
            d = d + self.disp(P)
        return d


class Group:
    def __init__(self, name, frame, clusters, bound_c, bound_r, gid):
        self.name = name
        self.frame = frame
        self.clusters = clusters
        self.bc = np.asarray(bound_c, float)
        self.br = bound_r
        self.gid = gid

    def eval(self, Pw):
        P = self.frame.to_local(Pw)
        d = np.full(len(P), 1e9)
        m = np.full(len(P), -1, np.int32)
        for c in self.clusters:
            dc = c.d(P)
            sel = dc < d
            d[sel] = dc[sel]
            m[sel] = c.mat
        return d, m


class Scene:
    def __init__(self, groups, env_fn):
        self.groups = groups
        self.env_fn = env_fn  # (P) -> (d, mat)

    def eval(self, P, mats=True):
        d, m = self.env_fn(P)
        gid = np.full(len(P), -1, np.int32)
        for g in self.groups:
            db = length(P - g.bc) - g.br
            near = np.nonzero(db < 0.15)[0]
            far = db >= 0.15
            sel = far & (db < d)
            d[sel] = db[sel]
            m[sel] = -2  # bound proxy, never a hit material
            if len(near):
                dg, mg = g.eval(P[near])
                better = dg < d[near]
                ii = near[better]
                d[ii] = dg[better]
                m[ii] = mg[better]
                gid[ii] = g.gid
        return d, m, gid

    def dist(self, P):
        return self.eval(P)[0]
