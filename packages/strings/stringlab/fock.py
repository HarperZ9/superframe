# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A sparse Fock-space engine and the Virasoro central charges of free fields, in exact rational arithmetic.

A state is a dict {basis: coefficient}; a basis is a sorted tuple of creation modes (field, mode) acting on
the SL(2)-invariant vacuum. Fields and their brackets:
  'a'  boson alpha_n          [alpha_m, alpha_n] = m delta_{m+n}        annihilates for n > 0
  'p'  Majorana psi_r (NS)    {psi_r, psi_s} = delta_{r+s}              annihilates for r > 0
  'b','c'  ghosts weight (lam, 1-lam)  {b_m, c_n} = delta_{m+n}        b_n kills for n >= 1-lam, c_n for n >= lam
  'B','G'  superghosts beta, gamma     [gamma_r, beta_s] = delta_{r+s} beta kills for r >= 1-lam, gamma for r >= lam
Each L_m is the textbook normal-ordered bilinear. Nothing is fitted: the central charge is read from
<0| L_m L_{-m} |0> = c/12 (m^3 - m), and the whole algebra [L_m, L_n] = (m-n) L_{m+n} + c/12 (m^3 - m) delta
is checked on many states, so a wrong generator fails the closure test instead of giving a wrong c.
"""
from fractions import Fraction as F

FERMI = {"p", "b", "c"}


class System:
    """One free-field system: its fields, vacuum conditions, brackets and Virasoro generator."""

    def __init__(self, name, fields, lam=None, half=False):
        self.name, self.fields, self.lam, self.half = name, fields, (F(lam) if lam is not None else None), half

    def modes(self, lo, hi):
        """Mode labels from lo to hi: integers, or half-integers for NS fields."""
        lo, hi = int(lo) - 2, int(hi) + 2
        if self.half:
            return [F(2 * k + 1, 2) for k in range(lo, hi)]
        return [F(k) for k in range(lo, hi + 1)]

    def kills(self, field, n):
        if field in ("a", "p"):
            return n > 0
        if field in ("b", "B"):
            return n >= 1 - self.lam
        return n >= self.lam  # c, G

    def bracket(self, x, y):
        """Graded bracket [x, y} of two modes; a scalar."""
        (f, m), (g, n) = x, y
        if m + n != 0:
            return F(0)
        pair = f + g
        if pair == "aa":
            return F(m)
        if pair == "pp":
            return F(1)
        if pair in ("bc", "cb"):
            return F(1)
        if pair == "GB":
            return F(1)
        if pair == "BG":
            return F(-1)
        return F(0)

    def generator(self, m, window):
        """L_m as a list of (coefficient, (mode1, mode2)), normal ordered, restricted to |n| <= window."""
        m = F(m)
        terms = []
        if self.fields == ("a",):
            for n in self.modes(-window, window):
                if n != 0 and m - n != 0:
                    terms.append((F(1, 2), (("a", m - n), ("a", n))))
        elif self.fields == ("p",):
            for s in self.modes(-window, window):
                terms.append((F(1, 2) * (s - m / 2), (("p", m - s), ("p", s))))
        elif self.fields == ("b", "c"):
            for n in self.modes(-window, window):
                terms.append((m * self.lam - n, (("b", n), ("c", m - n))))
        elif self.fields == ("B", "G"):
            for r in self.modes(-window, window):
                terms.append((m * self.lam - r, (("B", r), ("G", m - r))))
        return terms


def _sign(x, y):
    return -1 if (x[0] in FERMI and y[0] in FERMI) else 1


def _key(x):
    return (x[0], x[1])


def create(sys_, x, basis):
    """x (a creation mode) applied to the basis state; returns (sign, new_basis) or None if Pauli-blocked."""
    lst, sign, i = list(basis), 1, 0
    while i < len(lst) and _key(lst[i]) < _key(x):
        sign *= _sign(x, lst[i])
        i += 1
    if i < len(lst) and lst[i] == x and x[0] in FERMI:
        return None
    lst.insert(i, x)
    return sign, tuple(lst)


def apply_mode(sys_, x, state):
    """Apply a single mode operator to a state dict."""
    out = {}
    creates = not sys_.kills(*x)
    for basis, coef in state.items():
        if creates:
            r = create(sys_, x, basis)
            if r is not None:
                s, nb = r
                out[nb] = out.get(nb, 0) + s * coef
            continue
        sign = 1
        for i, y in enumerate(basis):
            br = sys_.bracket(x, y)
            if br:
                nb = basis[:i] + basis[i + 1:]
                out[nb] = out.get(nb, 0) + sign * br * coef
            sign *= _sign(x, y)
    return {k: v for k, v in out.items() if v != 0}


def apply_L(sys_, m, state):
    """L_m on a state. The mode window covers every mode that can act nontrivially."""
    depth = max((max((abs(x[1]) for x in b), default=0) for b in state), default=0)
    window = abs(F(m)) + depth + 4
    out = {}
    for coef, (x, y) in sys_.generator(m, window):
        if coef == 0:
            continue
        if sys_.kills(*x) and not sys_.kills(*y):
            part = apply_mode(sys_, y, apply_mode(sys_, x, state))   # :x y: = sign * y x
            coef = coef * _sign(x, y)
        else:
            part = apply_mode(sys_, x, apply_mode(sys_, y, state))
        for k, v in part.items():
            out[k] = out.get(k, 0) + coef * v
    return {k: v for k, v in out.items() if v != 0}


VACUUM = {(): F(1)}


def central_charge(sys_, m):
    """c from <0| L_m L_{-m} |0> = c/12 (m^3 - m), with L_0 |0> = 0 checked."""
    if apply_L(sys_, 0, VACUUM):
        raise ValueError(f"{sys_.name}: L_0 does not annihilate the vacuum")
    st = apply_L(sys_, m, apply_L(sys_, -m, VACUUM))
    v = st.get((), F(0))
    return F(12) * v / (m ** 3 - m)


def closure_defect(sys_, c, m, n, state):
    """Largest |coefficient| of ([L_m, L_n] - (m-n) L_{m+n} - c/12 (m^3-m) delta_{m+n,0}) on a state."""
    a = apply_L(sys_, m, apply_L(sys_, n, state))
    b = apply_L(sys_, n, apply_L(sys_, m, state))
    d = apply_L(sys_, m + n, state)
    out = dict(a)
    for k, v in b.items():
        out[k] = out.get(k, 0) - v
    for k, v in d.items():
        out[k] = out.get(k, 0) - (m - n) * v
    if m + n == 0:
        for k, v in state.items():
            out[k] = out.get(k, 0) - c * F(m ** 3 - m, 12) * v
    return max((abs(v) for v in out.values()), default=F(0))


def excited_states(sys_, levels=(1, 2, 3)):
    """A small set of basis states: L_{-k} and single creation modes on the vacuum."""
    states = []
    for k in levels:
        s = apply_L(sys_, -k, VACUUM)
        if s:
            states.append(s)
    for f in sys_.fields:
        for n in sys_.modes(-3, 2):
            if not sys_.kills(f, n):
                states.append({((f, n),): F(1)})
    return states


SYSTEMS = {
    "boson": System("boson", ("a",)),
    "majorana_ns": System("majorana_ns", ("p",), half=True),
    "bc_lambda2": System("bc_lambda2", ("b", "c"), lam=2),
    "bc_lambda1": System("bc_lambda1", ("b", "c"), lam=1),
    "bc_lambda_half": System("bc_lambda_half", ("b", "c"), lam=F(1, 2), half=True),
    "betagamma_32": System("betagamma_32", ("B", "G"), lam=F(3, 2), half=True),
}


def critical_from_charges(cb, cf, cbc, cbg):
    """D from total c = 0: bosonic D*cb + cbc = 0; super D*(cb + cf) + cbc + cbg = 0."""
    return {"D_bosonic": -cbc / cb, "D_super": -(cbc + cbg) / (cb + cf)}
