# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The evolution engine: a Wright-Fisher genetic algorithm with signal-chain knobs.

Knob            parameter                                                     field
temperature 1   mutation rate per site (digital flip probability)             mu
temperature 2   selection temperature T_sel of the Boltzmann rule; T = 1/gain beta
gain            selection strength beta: w_i ~ exp(beta z_i), z = standardised fitness
loss            drift through population size N, plus extinction events: with  N, cull
                probability `cull` per generation 90% of the population dies at random
attack          ramp-in time A: a new mutant's fitness counts at weight          attack
                min(1, (age + 1) / A) of its change from its parent
reverb          elite archive with decay time tau: a share `echo` of offspring   tau, echo
                is drawn from past elites with weight exp(-age / tau)
weight          fitness, from a Landscape
geometry        the Landscape (NK ruggedness K, smooth, deceptive trap) and the Drift
analog/digital  genome kind; analog mutation adds N(0, sigma) to every site      genome, sigma
forecasting     a Surrogate pre-screens k*N offspring, only N are really scored  surrogate
Entropy (diversity) and signal (bits about the optimum) are measured by info.py, never set.

Selection 'prop' is fitness-proportional (w_i ~ f_i), the rule the Eigen and Kimura results assume.
"""
from dataclasses import dataclass, field

import numpy as np

from . import info
from .surrogate import Surrogate


@dataclass
class Config:
    N: int = 50
    G: int = 150
    mu: float = 1 / 16
    beta: float = 2.0
    sel: str = "z"
    cull: float = 0.0
    attack: float = 1.0
    tau: float = 0.0
    echo: float = 0.2
    genome: str = "digital"
    sigma: float = 0.1
    surrogate: dict = field(default_factory=dict)
    shuffle: bool = False
    target: float = np.inf
    b_bits: tuple = (1, 2, 3, 4)


def weights(f, beta, sel):
    if sel == "prop":
        return np.asarray(f, float).clip(min=0)
    sd = f.std()
    z = (f - f.mean()) / sd if sd > 0 else np.zeros_like(f)
    return np.exp(beta * (z - z.max()))


class _Archive:
    def __init__(self, tau):
        self.tau, self.g, self.t = tau, [], []

    def on(self):
        return self.tau > 0

    def add(self, genome, t):
        self.g.append(genome.copy())
        self.t.append(t)

    def draw(self, n, t, rng):
        age = t - np.array(self.t, float)
        w = np.ones_like(age) if np.isinf(self.tau) else np.exp(-age / self.tau)
        return np.array(self.g)[rng.choice(len(w), size=n, p=w / w.sum())]


def _evaluate(land, pop, mask, cfg):
    if cfg.genome == "analog":
        x = pop if mask is None else np.abs(pop - mask)
        return land.f_cont(x)
    return land.lookup(pop, mask)


def _mutate(kids, cfg, rng):
    if cfg.genome == "analog":
        return np.clip(kids + rng.normal(0, cfg.sigma, kids.shape), 0.0, 1.0)
    flips = (rng.random(kids.shape) < cfg.mu).astype(np.int8)
    return np.bitwise_xor(kids, flips)


def _offspring(pop, w, cfg, rng, arch, t):
    n = len(pop)
    par = rng.choice(n, size=n, p=w / w.sum())
    kids = pop[par].copy()
    if arch.on() and arch.g:
        e = rng.random(n) < cfg.echo
        if e.any():
            kids[e] = arch.draw(int(e.sum()), t, rng)
            par = np.where(e, -1, par)
    return kids, par


def _screened(pop, w, cfg, rng, arch, t, sur, phase):
    """Forecasting: breed k*N candidates, keep the N the surrogate ranks highest."""
    k = int(cfg.surrogate.get("k", 4))
    cands, pars = zip(*[_offspring(pop, w, cfg, rng, arch, t) for _ in range(k)])
    cand, par = np.concatenate(cands), np.concatenate(pars)
    cand_m = _mutate(cand, cfg, rng)
    pred = sur.fit_predict(cand_m, phase)
    keep = rng.permutation(len(cand))[: len(pop)] if pred is None else np.argsort(-pred)[: len(pop)]
    return cand[keep], cand_m[keep], par[keep]


def _init(land, cfg, rng):
    shape = (cfg.N, land.L)
    if cfg.genome == "analog":
        return rng.random(shape)
    return rng.integers(0, 2, shape).astype(np.int8)


def _attack(f, state, cfg):
    if cfg.attack <= 1:
        return f
    ramp = np.minimum(1.0, (state["age"] + 1) / cfg.attack)
    return state["fref"] + ramp * (f - state["fref"])


def _inherit(state, feff, par, kids, mutated):
    """Attack bookkeeping. A mutated child starts its ramp at its parent's effective fitness; an
    unmutated child keeps its parent's ramp; an archive echo arrives at full weight."""
    p = np.maximum(par, 0)
    changed = np.any(mutated != kids, axis=1)
    from_pop = par >= 0
    fref = np.where(from_pop, np.where(changed, feff[p], state["fref"][p]), feff.max())
    age = np.where(from_pop, state["age"][p] + 1, 10 ** 6)
    state["fref"] = fref
    state["age"] = np.where(changed, 0, age)


def run(land, cfg, rng, drift=None):
    """One run. Returns a dict of measured outcomes (see _summary)."""
    pop = _init(land, cfg, rng)
    arch = _Archive(cfg.tau)
    sur = Surrogate(land.L, **{k: v for k, v in cfg.surrogate.items() if k != "k"}) if cfg.surrogate else None
    state = {"fref": np.zeros(cfg.N), "age": np.full(cfg.N, 10 ** 6)}
    rec = {"T": cfg.G, "best": -np.inf, "best_g": None, "phi_cur": [], "sig_eff": [], "evals": 0}
    mask = None
    for t in range(cfg.G):
        mask = drift.step(t) if drift is not None else None
        phase = drift.phase(t) if drift is not None else 0
        f = _evaluate(land, pop, mask, cfg)
        rec["evals"] += len(f)
        if sur is not None:
            sur.add(np.rint(pop) if cfg.genome == "analog" else pop, f, phase)
        _record(rec, land, pop, f, t, cfg, mask)
        feff = _attack(f, state, cfg)
        sel_f = rng.permutation(feff) if cfg.shuffle else feff
        w = weights(sel_f, cfg.beta, cfg.sel)
        rec["sig_eff"].append(float(w.max() / w.mean()) if w.mean() > 0 else 1.0)
        if cfg.cull > 0 and rng.random() < cfg.cull:
            w = w * (rng.random(len(w)) < 0.1)
            if w.sum() == 0:
                w[rng.integers(len(w))] = 1.0
        arch.add(pop[int(np.argmax(f))], t)
        nxt_phase = drift.phase(t + 1) if drift is not None else 0
        if sur is not None:
            kids, new, par = _screened(pop, w, cfg, rng, arch, t, sur, nxt_phase)
        else:
            kids, par = _offspring(pop, w, cfg, rng, arch, t)
            new = _mutate(kids, cfg, rng)
        _inherit(state, feff, par, kids, new)
        pop = new
    return _summary(rec, land, pop, cfg, mask)


def _record(rec, land, pop, f, t, cfg, mask):
    i = int(np.argmax(f))
    rec["phi_cur"].append(float(land.phi(f[i])))
    if f[i] > rec["best"]:
        rec["best"], rec["best_g"] = float(f[i]), (np.rint(pop[i]) if cfg.genome == "analog" else pop[i]).astype(np.int8)
        if mask is not None:
            rec["best_g"] = np.bitwise_xor(rec["best_g"], mask)
    if rec["T"] == cfg.G and f[i] >= cfg.target:
        rec["T"], rec["E"] = t, rec["evals"]


def _summary(rec, land, pop, cfg, mask):
    opt = land.opt if mask is None else np.bitwise_xor(land.opt, mask)
    hit = rec["T"] < cfg.G
    g = rec["best_g"]
    out = {"T": rec["T"], "hit": hit, "E": rec.get("E", rec["evals"]), "evals": rec["evals"],
           "offline": float(np.mean(rec["phi_cur"])), "best_phi": float(land.phi(rec["best"])),
           "sig_eff": float(np.mean(rec["sig_eff"][: max(1, min(rec["T"], cfg.G))])),
           "entropy": info.diversity(pop), "match": info.match_rate(pop, opt),
           "global": land.is_global(g), "local": land.is_local_opt(g)}
    if cfg.genome == "analog":
        out["signal"] = {b: info.signal(pop, opt, b) for b in cfg.b_bits}
    else:
        out["signal"] = {1: info.signal(pop, opt)}
    return out
