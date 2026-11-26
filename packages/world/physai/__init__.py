# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""First-principles SI-unit Physical AI, rigid-body contact, and universe simulation engine."""
from .articulated_env import (  # noqa: F401
    BipedBalanceContactEnv,
    OrbitalRendezvousEnv,
    PlanarArmReachEnv,
    balance_action,
    docking_action,
    plan_arm_torque,
)
from .env_receipts import (  # noqa: F401
    GRAVITY_PRESETS,
    DomainConfig,
    emit_episode_receipt,
    sample_domain,
    trajectory_sha256,
    verify_episode_receipt,
)
from .rigid_contact import (  # noqa: F401
    MATERIAL_PRESETS,
    ContactConstraint,
    ContactPlane,
    MaterialProps,
    RigidBody,
    mechanical_energy,
    solve_contacts_pgs,
    step_rigid_world,
    verify_contact_physics,
)
