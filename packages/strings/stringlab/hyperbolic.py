# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A drawn genus-2 surface: the regular hyperbolic octagon with opposite sides identified, and graphs drawn on it.

The octagon lives in the Poincare disk with interior angles pi/4, so eight copies meet at each corner and the
surface is smooth there. Opposite sides are glued by hyperbolic translations g_j (j = 0..3) along the axis through
the midpoints of sides j and j + 4; the g_j and their inverses generate the deck group. Edges are geodesic segments
from a vertex to a chosen image (a short word in the generators) of the other end. In the Klein model geodesics are
straight, so crossings are segment intersections. Two edges cross on the surface when one meets any group image of
the other.

Known answers: the corners form one vertex class, so V - E + F = 1 - 4 + 1 = -2 and the genus is 2; K8 has genus 2
(Ringel and Youngs), so it can be drawn without crossings; a crossing-free drawing of K8 is cellular, and tracing the
faces of the rotation system read off the drawing must give F = 18, Euler genus 4.
"""
import itertools
import math

import numpy as np

COSH_R = (1 / math.tan(math.pi / 8)) ** 2           # corner distance: cosh R = cot(pi/n) cot(alpha/2), n 8, alpha pi/4
R_DISK = math.tanh(math.acosh(COSH_R) / 2)           # Euclidean radius of the corners in the Poincare disk
D_MID = math.acosh(1 / math.tan(math.pi / 8))        # centre to side midpoint: cosh d = cos(alpha/2) / sin(pi/n)


def corners():
    return R_DISK * np.exp(1j * np.pi / 4 * np.arange(8))


def _rot(theta):
    return np.array([[np.exp(1j * theta / 2), 0], [0, np.exp(-1j * theta / 2)]])


def _trans(dist):
    t = math.tanh(dist / 2)
    return np.array([[1, t], [t, 1]], dtype=complex) / math.sqrt(1 - t * t)


def generators():
    """g_j, j = 0..3: translation by 2 d toward the midpoint of side j (maps side j + 4 onto side j); then inverses."""
    gs = []
    for j in range(4):
        th = (j + 0.5) * math.pi / 4
        gs.append(_rot(th) @ _trans(2 * D_MID) @ _rot(-th))
    return gs + [np.linalg.inv(g) for g in gs]


def act(m, z):
    return (m[0, 0] * z + m[0, 1]) / (m[1, 0] * z + m[1, 1])


def words(length):
    """Group elements as words of length <= length (reduced: no g g^-1), identity first."""
    gs = generators()
    out = [np.eye(2, dtype=complex)]
    names = [()]
    frontier = [((), np.eye(2, dtype=complex))]
    for _ in range(length):
        nxt = []
        for w, m in frontier:
            for i, g in enumerate(gs):
                if w and (w[-1] - i) % 8 == 4:
                    continue
                nm = m @ g
                nxt.append((w + (i,), nm))
        frontier = nxt
        for w, m in nxt:
            out.append(m)
            names.append(w)
    # distinct group elements only (the surface relation makes some words equal): compare where they send 0 and 1/2
    keep, seen = [], set()
    for i, m in enumerate(out):
        z0, z1 = act(m, 0.0), act(m, 0.5)
        key = tuple(round(float(v), 7) for v in (z0.real, z0.imag, z1.real, z1.imag))
        if key in seen:
            continue
        seen.add(key)
        keep.append(i)
    return [names[i] for i in keep], [out[i] for i in keep]


def vertex_classes():
    """Corners identified by the side pairings (union-find on images of corners that land on corners)."""
    c = corners()
    parent = list(range(8))

    def find(a):
        while parent[a] != a:
            a = parent[a]
        return a
    for g in generators():
        for k in range(8):
            z = act(g, c[k])
            hit = np.where(np.abs(c - z) < 1e-9)[0]
            for h in hit:
                parent[find(k)] = find(int(h))
    return len({find(k) for k in range(8)})


def side_pairing_ok():
    """Each g_j maps the two corners of side j + 4 onto the two corners of side j."""
    c = corners()
    gs = generators()
    for j in range(4):
        a, b = c[(j + 4) % 8], c[(j + 5) % 8]
        img = {round(float(np.real(act(gs[j], a))), 9) + 1j * round(float(np.imag(act(gs[j], a))), 9),
               round(float(np.real(act(gs[j], b))), 9) + 1j * round(float(np.imag(act(gs[j], b))), 9)}
        want = {round(float(np.real(c[j])), 9) + 1j * round(float(np.imag(c[j])), 9),
                round(float(np.real(c[(j + 1) % 8])), 9) + 1j * round(float(np.imag(c[(j + 1) % 8])), 9)}
        if img != want:
            return False
    return True


def klein(z):
    return 2 * z / (1 + np.abs(z) ** 2)


def inside(z):
    """Inside the octagon (Klein model: a Euclidean octagon)."""
    k = klein(np.asarray(z))
    ck = klein(corners())
    ok = np.ones(np.shape(k), dtype=bool)
    for i in range(8):
        a, b = ck[i], ck[(i + 1) % 8]
        cross = (b.real - a.real) * (k.imag - a.imag) - (b.imag - a.imag) * (k.real - a.real)
        ok &= cross > 0
    return ok


class Drawing:
    """A graph drawn on the octagon surface: vertex positions in the octagon and, per edge, an index into a word list."""

    def __init__(self, graph, lift_len=1, image_len=4):
        self.n, self.edges = graph
        self.lift_names, self.lifts = words(lift_len)
        self.img_names, self.imgs = words(image_len)
        self.I = np.array(self.imgs)          # (H, 2, 2)

    def endpoints(self, pos, lift):
        a = np.array([pos[u] for u, _ in self.edges])
        b = np.array([act(self.lifts[lift[k]], pos[v]) for k, (_, v) in enumerate(self.edges)])
        return a, b

    def crossings(self, pos, lift):
        a, b = self.endpoints(pos, lift)
        I = self.I
        # images of every segment under every group element, in the Klein model
        ia = (I[:, 0, 0, None] * a[None] + I[:, 0, 1, None]) / (I[:, 1, 0, None] * a[None] + I[:, 1, 1, None])
        ib = (I[:, 0, 0, None] * b[None] + I[:, 0, 1, None]) / (I[:, 1, 0, None] * b[None] + I[:, 1, 1, None])
        P, Q = klein(a), klein(b)
        C, D = klein(ia), klein(ib)                          # (H, E)
        E = len(self.edges)
        count = 0
        for i in range(E):
            p, q = P[i], Q[i]
            c, d = C[:, i:], D[:, i:]                        # column 0 is the edge itself: its own images can cross it
            o1 = _orient(p, q, c)
            o2 = _orient(p, q, d)
            o3 = _orient(c, d, p)
            o4 = _orient(c, d, q)
            hit = (o1 * o2 < -1e-12) & (o3 * o4 < -1e-12)
            hit[0, 0] = False                                # the identity image of the edge itself
            count += int(np.any(hit, axis=0).sum())
        return count

    def nondegenerate(self, pos, lift, sep=0.08):
        """Vertices (all images) apart in the Klein model, and no edge of zero length."""
        pts = np.array(pos)
        I = self.I
        im = (I[:, 0, 0, None] * pts[None] + I[:, 0, 1, None]) / (I[:, 1, 0, None] * pts[None] + I[:, 1, 1, None])
        K = klein(im)
        k0 = klein(pts)
        for i in range(self.n):
            d = np.abs(K - k0[i])
            d[0, i] = 9.0
            if d.min() < sep:
                return False
        a, b = self.endpoints(pos, lift)
        return bool(np.all(np.abs(klein(a) - klein(b)) > sep))

    def rotation(self, pos, lift):
        """Cyclic order of edges at each vertex, read from the drawing (tangent directions at the vertex)."""
        dirs = [[] for _ in range(self.n)]
        for k, (u, v) in enumerate(self.edges):
            m = self.lifts[lift[k]]
            tv = act(m, pos[v])
            tu = act(np.linalg.inv(m), pos[u])
            dirs[u].append((_tangent(pos[u], tv), v))
            dirs[v].append((_tangent(pos[v], tu), u))
        return [[w for _, w in sorted(d)] for d in dirs]


def _orient(p, q, r):
    return (q.real - p.real) * (r.imag - p.imag) - (q.imag - p.imag) * (r.real - p.real)


def _tangent(p, z):
    """Direction at p of the geodesic toward z: move p to the origin, where geodesics are diameters."""
    w = (z - p) / (1 - np.conj(p) * z)
    return float(np.angle(w))


def random_position(rng):
    while True:
        z = complex(*rng.uniform(-R_DISK, R_DISK, 2))
        if abs(z) < R_DISK and inside(z):
            return z


def anneal(drawing, rng, steps=4000, T0=1.0):
    """Lowest crossing count found; returns (count, positions, lifts)."""
    n, E = drawing.n, len(drawing.edges)
    nl = len(drawing.lifts)
    pos = [random_position(rng) for _ in range(n)]
    lift = [int(rng.integers(nl)) for _ in range(E)]
    for _ in range(500):
        if drawing.nondegenerate(pos, lift):
            break
        pos = [random_position(rng) for _ in range(n)]
    cur = drawing.crossings(pos, lift)
    best = (cur, list(pos), list(lift))
    for t in range(steps):
        T = T0 * (1 - t / steps) + 1e-3
        p2, l2 = list(pos), list(lift)
        if rng.random() < 0.4:
            i = int(rng.integers(n))
            z = p2[i] + complex(*rng.normal(0, 0.06, 2))
            if not inside(z):
                continue
            p2[i] = z
        else:
            l2[int(rng.integers(E))] = int(rng.integers(nl))
        if not drawing.nondegenerate(p2, l2):
            continue
        c = drawing.crossings(p2, l2)
        if c <= cur or rng.random() < math.exp(-(c - cur) / T):
            pos, lift, cur = p2, l2, c
            if c < best[0]:
                best = (c, list(pos), list(lift))
                if c == 0:
                    break
    return best


def complete(n):
    return n, list(itertools.combinations(range(n), 2))


# ---- a drawing built from a rotation system: voltages and a hyperbolic Tutte (harmonic) embedding ----

def face_darts(n, edges, rot):
    """Faces of an orientable rotation system as lists of darts (u, v)."""
    pos = [{w: i for i, w in enumerate(r)} for r in rot]
    seen, faces = set(), []
    for u in range(n):
        for v in rot[u]:
            if (u, v) in seen:
                continue
            f, cur = [], (u, v)
            while cur not in seen:
                seen.add(cur)
                f.append(cur)
                a, b = cur
                w = rot[b][(pos[b][a] + 1) % len(rot[b])]
                cur = (b, w)
            faces.append(f)
    return faces


def _winv(w):
    return [(g, -e) for g, e in reversed(w)]


def voltage_words(n, edges, rot):
    """Tree-cotree voltages. Returns (words per edge as free-group words in the leftover generators, number of
    generators, the root-face relation word). Tree edges get the empty word; leftover (non-tree, non-dual-tree)
    edges get their own generator; dual-tree edges are solved from the face relations, leaves first."""
    eid = {}
    for k, (u, v) in enumerate(edges):
        eid[(u, v)] = (k, 1)
        eid[(v, u)] = (k, -1)
    # spanning tree by BFS
    adj = [[] for _ in range(n)]
    for k, (u, v) in enumerate(edges):
        adj[u].append((v, k))
        adj[v].append((u, k))
    tree, seen, stack = set(), {0}, [0]
    while stack:
        u = stack.pop(0)
        for v, k in adj[u]:
            if v not in seen:
                seen.add(v)
                tree.add(k)
                stack.append(v)
    faces = face_darts(n, edges, rot)
    face_of = {}
    for fi, f in enumerate(faces):
        for d in f:
            face_of[d] = fi
    # dual spanning tree over non-tree edges
    dual_adj = [[] for _ in faces]
    for k, (u, v) in enumerate(edges):
        if k in tree:
            continue
        a, b = face_of[(u, v)], face_of[(v, u)]
        dual_adj[a].append((b, k))
        dual_adj[b].append((a, k))
    root = 0
    parent = {root: None}
    order, stack = [root], [root]
    dtree = set()
    while stack:
        a = stack.pop(0)
        for b, k in dual_adj[a]:
            if b not in parent:
                parent[b] = (a, k)
                dtree.add(k)
                order.append(b)
                stack.append(b)
    leftover = [k for k in range(len(edges)) if k not in tree and k not in dtree]
    words = {k: [] for k in tree}
    for i, k in enumerate(leftover):
        words[k] = [(i, 1)]
    # solve dual-tree edges from the leaves up: each face's dart product must be trivial

    def dart_word(d):
        k, s = eid[d]
        w = words[k]
        return w if s == 1 else _winv(w)
    for fi in reversed(order[1:]):
        pa, k = parent[fi]
        f = faces[fi]
        # rotate the face so the unknown dart comes last: product before it, then unknown
        idx = [j for j, d in enumerate(f) if eid[d][0] == k][0]
        f2 = f[idx + 1:] + f[:idx]
        pre = []
        for d in f2:
            pre += dart_word(d)
        # pre * x = 1 with x the unknown dart's word  =>  x = pre^-1
        x = _winv(pre)
        d = f[idx]
        words[k] = x if eid[d][1] == 1 else _winv(x)
    rel = []
    for d in faces[root]:
        rel += dart_word(d)
    return [words[k] for k in range(len(edges))], len(leftover), rel


def eval_word(w, mats):
    m = np.eye(2, dtype=complex)
    for g, e in w:
        m = m @ (mats[g] if e == 1 else np.linalg.inv(mats[g]))
    return m


def _to_hyperboloid(z):
    r2 = abs(z) ** 2
    return np.array([(1 + r2), 2 * z.real, 2 * z.imag]) / (1 - r2)


def _from_hyperboloid(x):
    return complex(x[1], x[2]) / (1 + x[0])


def tutte(n, edges, volt, iters=3000, rng=None):
    """Hyperbolic Tutte embedding: each vertex moves to the hyperboloid centroid of its neighbours' lifts."""
    rng = np.random.default_rng(0) if rng is None else rng
    p = [complex(*rng.uniform(-0.1, 0.1, 2)) for _ in range(n)]
    nb = [[] for _ in range(n)]
    for k, (u, v) in enumerate(edges):
        nb[u].append((v, volt[k]))
        nb[v].append((u, np.linalg.inv(volt[k])))
    for _ in range(iters):
        new = []
        for u in range(n):
            s = sum(_to_hyperboloid(act(g, p[v])) for v, g in nb[u])
            s = s / math.sqrt(s[0] ** 2 - s[1] ** 2 - s[2] ** 2)
            new.append(_from_hyperboloid(s))
        p = new
    return p


def reduce_to_domain(z, max_steps=50):
    """A group element h with h(z) in the octagon (Dirichlet domain at 0): apply the generator that pulls z closest."""
    gs = generators()
    h = np.eye(2, dtype=complex)
    for _ in range(max_steps):
        if inside(act(h, z)):
            return h
        best = min(gs, key=lambda g: abs(act(g @ h, z)))
        h = best @ h
    return h


def _key(m):
    m = m / np.sqrt(np.linalg.det(m))
    if m[0, 0].real < 0 or (abs(m[0, 0].real) < 1e-9 and m[0, 0].imag < 0):
        m = -m
    return tuple(np.round(np.concatenate([m.real.ravel(), m.imag.ravel()]), 6))


def assignments(rel, word_len=2):
    """Images of the 4 leftover generators (words up to word_len) that satisfy the root-face relation and use all
    four octagon generators: a meet-in-the-middle search on rel = (x_a x_b ...)(...). Yields index tuples into words()."""
    names, mats = words(word_len)
    mats = [np.array(m) for m in mats]
    inv = [np.linalg.inv(m) for m in mats]
    W = len(mats)
    half = len(rel) // 2
    left, right = rel[:half], rel[half:]
    import itertools
    lv = {g for g, _ in left}
    rv_ = {g for g, _ in right}
    shared = sorted(lv & rv_)
    lonly = sorted(lv - rv_)
    ronly = sorted(rv_ - lv)

    def prod(word, X):
        m = np.eye(2, dtype=complex)
        for g, e in word:
            m = m @ (mats[X[g]] if e == 1 else inv[X[g]])
        return m
    for sh in itertools.product(range(1, W), repeat=len(shared)):
        base = dict(zip(shared, sh))
        table = {}
        for lo in itertools.product(range(1, W), repeat=len(lonly)):
            X = dict(base)
            X.update(zip(lonly, lo))
            table.setdefault(_key(prod(left, X)), []).append(X)
        for ro in itertools.product(range(1, W), repeat=len(ronly)):
            Y0 = dict(base)
            Y0.update(zip(ronly, ro))
            for X in table.get(_key(np.linalg.inv(prod(right, Y0))), []):
                Y = dict(X)
                Y.update(Y0)
                sol = tuple(Y[i] for i in range(4))
                if len({a % 4 for i in sol for a in names[i]}) == 4:
                    yield sol


def draw_from_rotation(graph, rot, word_len=2, iters=400, tries=60, image_len=4):
    """A geodesic drawing on the octagon surface in the homotopy class fixed by the rotation system: tree-cotree
    voltages, a generator assignment satisfying the surface relation, a hyperbolic Tutte embedding, then each vertex
    moved into the octagon. Returns (crossings, positions, edge voltages, assignment) for the first crossing-free try,
    or the best one."""
    n, edges = graph
    wds, ng, rel = voltage_words(n, edges, rot)
    if ng != 4:
        raise ValueError("needs a genus-2 rotation system")
    names, mats = words(word_len)
    dr = Drawing(graph, 1, image_len)
    best = None
    for t, sol in enumerate(assignments(rel, word_len)):
        if t >= tries:
            break
        X = [np.array(mats[i]) for i in sol]
        volt = [eval_word(w, X) for w in wds]
        p = tutte(n, edges, volt, iters=iters)
        hs = [reduce_to_domain(z) for z in p]
        p2 = [act(h, z) for h, z in zip(hs, p)]
        v2 = [hs[u] @ volt[k] @ np.linalg.inv(hs[v]) for k, (u, v) in enumerate(edges)]
        dr.lifts = v2
        c = dr.crossings(p2, list(range(len(edges))))
        if best is None or c < best[0]:
            best = (c, p2, v2, [names[i] for i in sol])
        if c == 0:
            break
    return best
