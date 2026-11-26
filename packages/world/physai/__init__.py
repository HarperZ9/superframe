# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""First-principles SI-unit Physical AI, rigid-body contact, and universe simulation engine."""
from .aerospace_6dof import (  # noqa: F401
    PLANET_PRESETS,
    PoweredDescent6DOFEnv,
    QuadrotorDroneEnv,
    descent_6dof_action,
    quadrotor_action,
    quadrotor_alloc_matrix,
)
from .articulated_env import (  # noqa: F401
    BipedBalanceContactEnv,
    OrbitalRendezvousEnv,
    PlanarArmReachEnv,
    balance_action,
    docking_action,
    plan_arm_torque,
)
from .instrument_pipeline import (  # noqa: F401
    EstimatorState,
    InstrumentSuite,
    NavStateEstimator,
    SensorFaults,
    SensorReading,
)
from .quat_math import (  # noqa: F401
    clamp_gimbal_angles,
    exp_atmosphere_density,
    quat_angle_rad,
    quat_integrate,
    quat_normalize,
    quat_to_rotmat,
)
from .cross_api_parity import (  # noqa: F401
    CPP_STILL_LIFE_PIN,
    MAX_ABS_LIN_BOUND,
    MAX_P99_OKLAB_DELTA_E_BOUND,
    MIN_PSNR_DB_BOUND,
    SCHEMA_ID as CROSS_API_PARITY_SCHEMA_ID,
    DualTargetBuild,
    RadiometricParity,
    advance_probe_state_100hz,
    compile_dual_target_shaders,
    compute_radiometric_parity,
    emit_cross_api_parity_certificate,
    fnv1a_f32_hex,
    quantize_scene_state_hash,
    render_scene_parity_probe_64x64,
    verify_cross_api_parity_certificate,
)
from .env_receipts import (  # noqa: F401
    GRAVITY_PRESETS,
    DomainConfig,
    emit_episode_receipt,
    sample_domain,
    trajectory_sha256,
    verify_episode_receipt,
)
from .latency_sim import (  # noqa: F401
    SIM_DT,
    SIM_HZ,
    LatencyRolloutMetrics,
    LatencyVehicleEnv,
    benchmark_fast_vs_overthinking,
    run_latency_quadrotor_rollout,
    run_latency_vehicle_rollout,
    vehicle_pd_action,
    verify_latency_faithful_clock,
)
from .noh3_world_bridge import (  # noqa: F401
    BuckinghamPiScaleNormalizer,
    CODITFaultGuard,
    CODITQuarantineEvent,
    CausticSparseScheduler,
    LivingWorldTickBridge,
    WorldActor,
    spawn_mixed_world_actors,
)
from .tree_biomechanics import (  # noqa: F401
    SPECIES_PRESETS,
    SpeciesBiomech,
    TreeStructure,
    TreeWindBiomechanics,
    compute_tree_structure,
    verify_tree_energy_bound,
    verify_white_furnace_bound,
    vogel_drag_force,
    wet_leaf_pbr_response,
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
