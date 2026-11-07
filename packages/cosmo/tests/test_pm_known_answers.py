# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the particle-mesh solver: point-mass force, Zel'dovich pancake, momentum, linear growth."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import background, ewald, ic, linear, pm, power  # noqa: E402
from cosmolab.backend import get_backend  # noqa: E402

C = background.Cosmology()
OPS = get_backend("numpy")


def test_ewald_reference_itself():
    f = ewald.ewald_force([[0.5, 0, 0], [0.5, 0.5, 0.5], [1e-3, 0, 0]], 1.0)
    assert np.max(np.abs(f[:2])) < 1e-12                       # symmetry points feel no force
    assert f[2, 0] == pytest.approx(-1e6, rel=1e-5)            # Newton at short range
    r = np.array([[0.21, -0.13, 0.07]])
    assert np.allclose(ewald.ewald_force(r, 1.0), ewald.ewald_force(r, 1.0, alpha=3.5, nreal=4, nrecip=9), atol=1e-11)


def _point_mass_errors(ng, gradient="fd4", deconvolve=False, newton=False):
    box = 1.0
    solver = pm.PMSolver(C, box, ng, 1, OPS, gradient=gradient, deconvolve=deconvolve)
    src = np.array([[0.3, 0.3, 0.3]]) + 0.37 / ng
    delta = solver.deposit(src)
    rng = np.random.default_rng(1)
    dirs = rng.standard_normal((2000, 3))
    dirs /= np.linalg.norm(dirs, axis=1)[:, None]
    r = np.exp(rng.uniform(np.log(4.0 / ng), np.log(0.45), len(dirs)))
    test = np.mod(src + dirs * r[:, None], box)
    g = np.stack([solver.interpolate(m, test) for m in solver.force_meshes(delta)], axis=1)
    gm = 1.5 * C.omega_m * box ** 3 / (4 * np.pi)              # G m of a lone particle in these units
    d = dirs * r[:, None]
    ref = gm * (-d / r[:, None] ** 3 if newton else ewald.ewald_force(d, box))
    err = np.linalg.norm(g - ref, axis=1) / np.linalg.norm(ref, axis=1)
    cells = r * ng
    return {band: float(np.sqrt(np.mean(err[(cells >= lo) & (cells < hi)] ** 2)))
            for band, (lo, hi) in {"4-8": (4, 8), "8-16": (8, 16), "16+": (16, 1e9)}.items()}


def test_point_mass_force_matches_periodic_greens_function():
    e = _point_mass_errors(64)
    assert e["4-8"] < 0.02 and e["8-16"] < 0.005 and e["16+"] < 0.002
    # planted: open-space Newton is not the periodic answer at these separations
    assert _point_mass_errors(64, newton=True)["16+"] > 0.05


class _WeakGravity(pm.PMSolver):
    """Planted: Poisson's equation with a source 10 percent too weak."""

    def potential_k(self, delta):
        return 0.9 * super().potential_k(delta)


def test_pancake_before_shell_crossing():
    """Plane-wave collapse is exact in the Zel'dovich approximation until shell crossing at a = 1."""
    box, n, ng, ai, af = 64.0, 32, 64, 0.1, 0.9
    pos, mom, q = ic.pancake(C, box, n, 1.0, ai)
    pe, me, _ = ic.pancake(C, box, n, 1.0, af)
    amp = np.abs((pe - q + box / 2) % box - box / 2)[:, 0].max()   # largest analytic displacement
    grid = np.linspace(ai, af, 41)
    p, m = pm.PMSolver(C, box, ng, n ** 3, OPS).run(pos, mom, grid)
    dx = (p - pe + box / 2) % box - box / 2
    assert np.abs(dx[:, 0]).max() / amp < 0.015
    assert np.abs(dx[:, 1:]).max() < 1e-9                      # nothing moves across the wave
    assert np.abs(m[:, 0] - me[:, 0]).max() / np.abs(me[:, 0]).max() < 0.03
    pw, _ = _WeakGravity(C, box, ng, n ** 3, OPS).run(pos, mom, grid)
    assert np.abs(((pw - pe + box / 2) % box - box / 2)[:, 0]).max() / amp > 0.05


def _evolve(readback, deconvolve=False):
    plin = linear.LinearPower(C)
    pos, mom, _ = ic.zeldovich(C, plin, 100.0, 32, 0.05, seed=3)
    solver = pm.PMSolver(C, 100.0, 64, 32 ** 3, OPS, readback=readback, deconvolve=deconvolve)
    return mom, solver.run(pos, mom, np.linspace(0.05, 1.0, 31))[1]


@pytest.mark.parametrize("deconvolve", [False, True])
def test_momentum_conserved_to_rounding(deconvolve):
    mom0, mom1 = _evolve("cic", deconvolve)
    scale = np.abs(mom1).sum(axis=0).max()
    assert np.abs(mom1.sum(axis=0)).max() / scale < 1e-12


def test_planted_ngp_readback_breaks_momentum():
    _, mom1 = _evolve("ngp")
    assert np.abs(mom1.sum(axis=0)).max() / np.abs(mom1).sum(axis=0).max() > 1e-4


def test_linear_growth_of_measured_power():
    """Large-scale P(k) grows as D(a)^2 from the growth ODE on the two longest shells (k <= 2 k_f, an eighth
    of the particle Nyquist). Shorter modes grow faster on a 32^3 lattice under a 64^3 mesh (lattice
    discreteness; it falls with particle number, see README), so they are not held to the ODE here."""
    box, n, ai = 1500.0, 32, 0.02
    plin = linear.LinearPower(C)
    pos, mom, _ = ic.zeldovich(C, plin, box, n, ai, seed=7)
    k0, p0, _ = power.power_spectrum(pos, box, 64, OPS, n ** 3, subtract_shot=False)
    snaps = {}
    grid = np.geomspace(ai, 1.0, 41)
    grid = np.unique(np.concatenate([grid, [0.5]]))
    solver = pm.PMSolver(C, box, 64, n ** 3, OPS)
    solver.run(pos, mom, grid, callback=lambda a, p, m: snaps.__setitem__(round(a, 9), p.copy()))
    k_low = k0 < 2.5 * 2 * np.pi / box
    assert k_low.sum() == 2
    for a in (0.5, 1.0):
        _, p1, _ = power.power_spectrum(snaps[a], box, 64, OPS, n ** 3, subtract_shot=False)
        d = C.growth_ode([ai, a])
        ratio = p1[k_low] / p0[k_low] / (d[1] / d[0]) ** 2
        assert np.max(np.abs(ratio - 1)) < 0.03
        if a == 1.0:
            # planted: Einstein-de Sitter growth (D = a) is rejected
            eds = p1[k_low] / p0[k_low] / (a / ai) ** 2
            assert np.min(np.abs(eds - 1)) > 0.2


def test_power_estimator_on_poisson_particles():
    """Shot-noise-free estimator on uncorrelated particles gives zero power; with the noise kept it gives V/N."""
    box, n_part, ng = 100.0, 50_000, 32
    pos = np.random.default_rng(5).uniform(0, box, (n_part, 3))
    k, p, nm = power.power_spectrum(pos, box, ng, OPS, n_part)
    s = k < 0.5 * np.pi * ng / box
    shot = box ** 3 / n_part
    assert abs(np.average(p[s], weights=nm[s])) / shot < 4 / np.sqrt(nm[s].sum())   # 4 sigma
    k, p_raw, nm = power.power_spectrum(pos, box, ng, OPS, n_part, subtract_shot=False)
    # with the noise kept, the deconvolved power is V/N times a window ratio within 5 percent of 1 below half Nyquist
    assert np.average(p_raw[s], weights=nm[s]) / shot == pytest.approx(1.0, abs=0.05 + 4 / np.sqrt(nm[s].sum()))


def test_torch_backend_matches_numpy():
    try:
        gpu = get_backend("torch")
    except RuntimeError:
        pytest.skip("torch with CUDA is not available here")
    plin = linear.LinearPower(C)
    pos, _, _ = ic.zeldovich(C, plin, 200.0, 32, 0.1, seed=1)
    a_cpu = pm.PMSolver(C, 200.0, 64, 32 ** 3, OPS).accel(pos)
    a_gpu = gpu.to_numpy(pm.PMSolver(C, 200.0, 64, 32 ** 3, gpu).accel(gpu.asarray(pos)))
    assert np.abs(a_cpu - a_gpu).max() / np.abs(a_cpu).max() < 1e-4
