# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Family 3: a 1-D lake column with a seasonal air temperature, ice, and a switchable equation of state.

Enthalpy per cell (J m^-3, one reference density 1000 kg m^-3 for heat capacity): E < 0 is ice below
0 C, 0 <= E <= rho L is slush at 0 C, E > rho L is water. Heat moves by conduction (ice) or eddy
diffusion (water, wind-driven eddy diffusivity only while the top is open); surface exchange is h (T_air - T_top). After each step the column is reordered by
density: two liquid cells in the wrong order mix; an ice cell and a water cell in the wrong order swap.
Knobs:
  anomaly  strength of the 4 C density maximum: rho = 1000 (1 - b (T - T_m)^2) with T_m = 4 anomaly,
           b = 6.8e-6; anomaly 0 puts the maximum at 0 C, so liquid density falls monotonically with T.
  ice_rho  ice density in kg m^-3 (917 real). Above the liquid density, ice sinks.
Not modelled: snow, solar penetration, salinity, wind, lake bottom heat flux, ice drift.
"""
import numpy as np

RHO, C_W, C_I, LAT = 1000.0, 4186.0, 2100.0, 3.34e5
K_ICE, K_WATER = 2.2, 0.6


def temperature(E):
    T = np.where(E < 0, E / (RHO * C_I), 0.0)
    return np.where(E > RHO * LAT, (E - RHO * LAT) / (RHO * C_W), T)


def ice_fraction(E):
    return np.clip(1.0 - E / (RHO * LAT), 0.0, 1.0)


def liquid_density(T, anomaly=1.0, b=6.8e-6):
    return 1000.0 * (1.0 - b * (T - 4.0 * anomaly) ** 2)


def density(E, anomaly, ice_rho):
    f = ice_fraction(E)
    return np.where(f > 0.5, ice_rho, liquid_density(temperature(E), anomaly))


def reorder(E, anomaly, ice_rho):
    """Bubble passes until the column is stably ordered (density not decreasing with depth)."""
    n = len(E)
    for _ in range(4 * n):
        rho = density(E, anomaly, ice_rho)
        bad = np.where(rho[:-1] > rho[1:] + 1e-9)[0]
        if len(bad) == 0:
            break
        i = bad[0]
        iced = ice_fraction(E[i:i + 2]) > 0.5
        if iced.any():
            E[i], E[i + 1] = E[i + 1], E[i]
        else:
            j = i + 1
            while j + 1 < n and density(E[i:j + 1], anomaly, ice_rho).mean() > density(E[j + 1:j + 2], anomaly, ice_rho)[0] \
                    and ice_fraction(E[j + 1]) <= 0.5:
                j += 1
            E[i:j + 1] = E[i:j + 1].mean()
    return E


def air_temperature(t, t_mean, t_amp, coldest_day=111.0):
    """Sinusoidal air temperature; t in seconds from 1 October, coldest on day 111 (about 20 January)."""
    return t_mean - t_amp * np.cos(2 * np.pi * (t / 86400.0 - coldest_day) / 365.0)


def simulate(depth=4.0, dz=0.2, years=10, dt=3600.0, anomaly=1.0, ice_rho=917.0, t_mean=4.0, t_amp=14.0,
             h_s=20.0, kappa_eddy=2e-6, leak=0.0, t0=None, record_every=24):
    """Run from 1 October with the column at t0 (default t_mean + 6). Returns a dict with depth-time
    temperature and ice records (daily), the solid-freeze day if any, and the energy ledger error."""
    n = int(round(depth / dz))
    E = np.full(n, RHO * LAT + RHO * C_W * (t0 if t0 is not None else t_mean + 6.0))
    k_w = K_WATER + RHO * C_W * kappa_eddy
    steps = int(years * 365 * 86400 / dt)
    rec_T, rec_f, solid_day, ledger_in = [], [], None, 0.0
    E_start = E.sum() * dz
    for s in range(steps):
        t = s * dt
        t_air = air_temperature(t, t_mean, t_amp)
        T = temperature(E)
        iced = ice_fraction(E) > 0.5
        k = np.where(iced, K_ICE, k_w if not iced[0] else K_WATER)  # an ice lid stops wind mixing
        kf = 2 * k[:-1] * k[1:] / (k[:-1] + k[1:])
        flux = kf * (T[:-1] - T[1:]) / dz  # downward flux between cells
        q_top = h_s * (t_air - T[0])
        dE = np.zeros(n)
        dE[0] += q_top
        dE[:-1] -= flux
        dE[1:] += flux
        E = E + dt * dE / dz
        ledger_in += dt * q_top
        if leak:
            E = E + leak * dt * RHO * C_W / 86400.0  # a spurious source: leak kelvin per day
        E = reorder(E, anomaly, ice_rho)
        if solid_day is None and (ice_fraction(E) > 0.5).all():
            solid_day = t / 86400.0
        if s % record_every == 0:
            rec_T.append(temperature(E).astype(np.float32))
            rec_f.append(ice_fraction(E).astype(np.float32))
    err = (E.sum() * dz - E_start - ledger_in) / max(abs(ledger_in), 1.0)
    rT, rf = np.array(rec_T), np.array(rec_f)
    return {"T": rT, "ice": rf, "solid_day": solid_day, "ledger_rel_error": float(err),
            "min_liquid_layers": int(((rf < 0.5).sum(axis=1)).min()), "dz": dz,
            "winter_bottom_T": _winter_bottom(rT, rf)}


def _winter_bottom(rT, rf):
    """Mean bottom temperature on days with an ice lid at the top, liquid bottom (last year)."""
    last = slice(-365, None)
    lid = (rf[last, 0] > 0.5) & (rf[last, -1] < 0.5)
    return float(rT[last][lid, -1].mean()) if lid.any() else float("nan")


def stefan_thickness(fdd, k=K_ICE, rho_i=917.0, lat=LAT):
    """Stefan's law: ice thickness (m) after fdd freezing degree-days with the top at air temperature."""
    return np.sqrt(2 * k * fdd * 86400.0 / (rho_i * lat))


def summary(kwargs):
    """A picklable run for process pools: simulate(**kwargs) without the depth-time records."""
    r = simulate(**kwargs)
    ice_m = r["ice"].sum(axis=1) * r["dz"]
    return {"solid_day": r["solid_day"], "min_liquid_layers": r["min_liquid_layers"],
            "winter_bottom_T": r["winter_bottom_T"], "max_ice_m": float(ice_m.max()),
            "ledger_rel_error": r["ledger_rel_error"], "kwargs": kwargs}
