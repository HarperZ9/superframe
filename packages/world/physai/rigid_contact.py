# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""SI-unit rigid-body dynamics, Projected Gauss-Seidel (PGS) contact & Coulomb friction solver.

All quantities use exact SI units (m, kg, s, N, N*m, rad).
Integrators: symplectic semi-implicit Euler and Velocity-Verlet.
Contact solver: multi-contact PGS with restitution e in [0, 1], Baumgarte
stabilization, and exact Coulomb friction cone (||f_t|| <= mu * f_n).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Sequence

import numpy as np


@dataclass(frozen=True)
class MaterialProps:
    """SI physical material properties aligned with packages/materials."""
    name: str
    density_kg_m3: float
    friction: float
    restitution: float


MATERIAL_PRESETS: dict[str, MaterialProps] = {
    "steel": MaterialProps("steel", 7850.0, 0.42, 0.65),
    "rubber": MaterialProps("rubber", 1150.0, 0.85, 0.78),
    "ice": MaterialProps("ice", 917.0, 0.05, 0.35),
    "granite": MaterialProps("granite", 2700.0, 0.60, 0.45),
    "wood": MaterialProps("wood", 680.0, 0.48, 0.50),
}


@dataclass
class RigidBody:
    """Rigid sphere/particle body in SI units (m, kg, m/s)."""
    pos: np.ndarray
    vel: np.ndarray
    mass: float
    radius: float = 0.1
    restitution: float = 0.5
    friction: float = 0.5
    material: str = "steel"

    @property
    def inv_mass(self) -> float:
        return 0.0 if self.mass <= 0.0 or math.isinf(self.mass) else 1.0 / self.mass

    @classmethod
    def from_material(
        cls,
        material: str,
        pos: Sequence[float],
        vel: Sequence[float] = (0.0, 0.0, 0.0),
        radius: float = 0.1,
        mass: float | None = None,
    ) -> RigidBody:
        props = MATERIAL_PRESETS[material]
        vol = (4.0 / 3.0) * math.pi * (radius ** 3)
        m = props.density_kg_m3 * vol if mass is None else float(mass)
        return cls(
            pos=np.array(pos, dtype=np.float64),
            vel=np.array(vel, dtype=np.float64),
            mass=m,
            radius=float(radius),
            restitution=props.restitution,
            friction=props.friction,
            material=material,
        )


@dataclass(frozen=True)
class ContactPlane:
    """Half-space plane {x : dot(normal, x) >= offset}."""
    normal: np.ndarray
    offset: float = 0.0
    friction: float = 0.5
    restitution: float = 0.5

    @classmethod
    def horizontal(cls, z: float = 0.0, friction: float = 0.5, restitution: float = 0.5) -> ContactPlane:
        return cls(np.array([0.0, 0.0, 1.0], dtype=np.float64), float(z), float(friction), float(restitution))

    @classmethod
    def incline(cls, angle_rad: float, friction: float = 0.5, restitution: float = 0.0) -> ContactPlane:
        n = np.array([math.sin(angle_rad), 0.0, math.cos(angle_rad)], dtype=np.float64)
        return cls(n, 0.0, float(friction), float(restitution))


@dataclass
class ContactConstraint:
    """Active contact record carrying PGS normal/tangential impulses (N*s)."""
    body_a: int
    body_b: int          # -1 denotes static plane
    normal: np.ndarray
    penetration: float
    restitution: float
    friction: float
    impulse_n: float = 0.0
    impulse_t: np.ndarray = field(default_factory=lambda: np.zeros(3, dtype=np.float64))


def mechanical_energy(bodies: Sequence[RigidBody], gravity: float = 9.80665, z_ref: float = 0.0) -> float:
    """Total mechanical energy E = sum(0.5*m*v^2 + m*g*(z - radius - z_ref)) in Joules."""
    total = 0.0
    for b in bodies:
        if b.inv_mass > 0.0:
            ke = 0.5 * b.mass * float(np.dot(b.vel, b.vel))
            pe = b.mass * gravity * float(b.pos[2] - b.radius - z_ref)
            total += ke + pe
    return total


def detect_contacts(bodies: Sequence[RigidBody], planes: Sequence[ContactPlane]) -> list[ContactConstraint]:
    """Detect body-plane and body-body sphere contacts with positive overlap."""
    contacts: list[ContactConstraint] = []
    for i, b in enumerate(bodies):
        for pl in planes:
            dist = float(np.dot(pl.normal, b.pos)) - pl.offset - b.radius
            if dist <= 1e-9:
                e = min(b.restitution, pl.restitution)
                mu = math.sqrt(max(0.0, b.friction * pl.friction))
                contacts.append(ContactConstraint(i, -1, pl.normal.copy(), max(0.0, -dist), e, mu))
    for i in range(len(bodies)):
        for j in range(i + 1, len(bodies)):
            delta = bodies[i].pos - bodies[j].pos
            d = float(np.linalg.norm(delta))
            rsum = bodies[i].radius + bodies[j].radius
            if d < rsum:
                n = delta / max(d, 1e-12) if d > 1e-12 else np.array([0.0, 0.0, 1.0])
                e = min(bodies[i].restitution, bodies[j].restitution)
                mu = math.sqrt(max(0.0, bodies[i].friction * bodies[j].friction))
                contacts.append(ContactConstraint(i, j, n, rsum - d, e, mu))
    return contacts


def _solve_one_contact(c: ContactConstraint, bodies: Sequence[RigidBody], v_bias: float) -> None:
    ba = bodies[c.body_a]
    bb = bodies[c.body_b] if c.body_b >= 0 else None
    inv_m = ba.inv_mass + (bb.inv_mass if bb is not None else 0.0)
    if inv_m <= 0.0:
        return
    vb = bb.vel if bb is not None else np.zeros(3, dtype=np.float64)
    v_rel = ba.vel - vb
    vn = float(np.dot(v_rel, c.normal))
    d_jn = -(vn - v_bias) / inv_m
    old_jn = c.impulse_n
    c.impulse_n = max(0.0, old_jn + d_jn)
    applied_n = (c.impulse_n - old_jn) * c.normal
    ba.vel = ba.vel + ba.inv_mass * applied_n
    if bb is not None:
        bb.vel = bb.vel - bb.inv_mass * applied_n

    v_rel2 = ba.vel - (bb.vel if bb is not None else np.zeros(3, dtype=np.float64))
    vt = v_rel2 - float(np.dot(v_rel2, c.normal)) * c.normal
    d_jt = -vt / inv_m
    new_jt = c.impulse_t + d_jt
    max_jt = c.friction * c.impulse_n
    mag_jt = float(np.linalg.norm(new_jt))
    if mag_jt > max_jt and mag_jt > 1e-15:
        new_jt = new_jt * (max_jt / mag_jt)
    applied_t = new_jt - c.impulse_t
    c.impulse_t = new_jt
    ba.vel = ba.vel + ba.inv_mass * applied_t
    if bb is not None:
        bb.vel = bb.vel - bb.inv_mass * applied_t


def solve_contacts_pgs(
    bodies: Sequence[RigidBody],
    contacts: Sequence[ContactConstraint],
    dt: float,
    iterations: int = 16,
    baumgarte: float = 0.15,
    slop: float = 1e-4,
) -> None:
    """Solve multi-contact normal + Coulomb friction impulses via Projected Gauss-Seidel."""
    if not contacts:
        return
    biases: list[float] = []
    for c in contacts:
        vb = bodies[c.body_b].vel if c.body_b >= 0 else np.zeros(3, dtype=np.float64)
        vn0 = float(np.dot(bodies[c.body_a].vel - vb, c.normal))
        e_clamped = min(max(c.restitution, 0.0), 1.0)
        if vn0 < -0.05:
            biases.append(-e_clamped * vn0)
        else:
            biases.append((baumgarte / max(dt, 1e-9)) * max(0.0, c.penetration - slop))
    for _ in range(max(1, iterations)):
        for c, bias in zip(contacts, biases):
            _solve_one_contact(c, bodies, bias)
    for c in contacts:
        if c.penetration > 0.0:
            ba = bodies[c.body_a]
            bb = bodies[c.body_b] if c.body_b >= 0 else None
            inv_m = ba.inv_mass + (bb.inv_mass if bb is not None else 0.0)
            if inv_m > 0.0:
                corr = (c.penetration / inv_m) * c.normal
                ba.pos = ba.pos + ba.inv_mass * corr
                if bb is not None:
                    bb.pos = bb.pos - bb.inv_mass * corr
                c.penetration = 0.0


def step_rigid_world(
    bodies: Sequence[RigidBody],
    planes: Sequence[ContactPlane],
    dt: float,
    gravity: float = 9.80665,
    integrator: str = "symplectic_euler",
    pgs_iters: int = 16,
) -> list[ContactConstraint]:
    """Advance rigid bodies by dt (s) under gravity with PGS contact resolution."""
    g_vec = np.array([0.0, 0.0, -gravity], dtype=np.float64)
    for b in bodies:
        if b.inv_mass > 0.0:
            b.vel = b.vel + g_vec * dt
    contacts = detect_contacts(bodies, planes)
    if contacts:
        solve_contacts_pgs(bodies, contacts, dt, iterations=pgs_iters)
    for b in bodies:
        if b.inv_mass > 0.0:
            if integrator == "velocity_verlet" and not contacts:
                b.pos = b.pos + (b.vel - 0.5 * g_vec * dt) * dt
            else:
                b.pos = b.pos + b.vel * dt
    if not contacts:
        post_contacts = detect_contacts(bodies, planes)
        if post_contacts:
            solve_contacts_pgs(bodies, post_contacts, dt, iterations=pgs_iters)
            return post_contacts
    return contacts


def verify_contact_physics(
    contacts: Sequence[ContactConstraint],
    *,
    e_pre: float | None = None,
    e_post: float | None = None,
    tol: float = 1e-4,
) -> tuple[bool, list[str]]:
    """Verify restitution bounds, zero interpenetration, Coulomb cone, and passive energy."""
    errors: list[str] = []
    for idx, c in enumerate(contacts):
        if c.restitution < 0.0 or c.restitution > 1.0:
            errors.append(f"contact {idx}: super-elastic or negative restitution {c.restitution}")
        if c.penetration > 1e-3 + tol:
            errors.append(f"contact {idx}: residual interpenetration {c.penetration:.6f} m")
        if c.impulse_n < -tol:
            errors.append(f"contact {idx}: attractive normal impulse {c.impulse_n:.6f}")
        jt = float(np.linalg.norm(c.impulse_t))
        limit = c.friction * max(0.0, c.impulse_n) + tol
        if jt > limit:
            errors.append(f"contact {idx}: Coulomb cone violation |ft|={jt:.6f} > mu*fn={limit:.6f}")
    if e_pre is not None and e_post is not None and e_post > e_pre + 1e-3:
        errors.append(f"passive energy increased: e_pre={e_pre:.6f} -> e_post={e_post:.6f}")
    return len(errors) == 0, errors
