# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""studyrun units for the room-shape meter (spec: ../studies/room/spec.json).

Analysis: 240 simulated rooms (3 speakers x 2 background levels x 40 rooms), each measured through the
full twin chain, plus the stage-7 round trip. Controls:
  C1 shuffled truth   each room's S3 estimate scored against another room's true volume (permutation)
  C2 sign flip        the paired laptop gap |err prior| - |err S3| under random sign flips
"""
import sys

import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, __file__.rsplit("\\", 1)[0].rsplit("/", 1)[0])

import modes  # noqa: E402
import roundtrip  # noqa: E402
import trial  # noqa: E402

METHODS = ("S1", "S2", "S3", "S4")


def _prior_volume(seed, n=20000):
    rng = np.random.default_rng(seed)
    return float(np.median([modes.geometry(modes.random_room(rng))["V"] for _ in range(n)]))


def _boot_ci(x, rng, n_boot):
    x = np.asarray(x, float)
    x = x[np.isfinite(x)]
    if len(x) < 5:
        return float("nan"), float("nan"), float("nan")
    bs = [np.mean(rng.choice(x, len(x))) for _ in range(n_boot)]
    return float(np.mean(x)), float(np.quantile(bs, 0.025)), float(np.quantile(bs, 0.975))


def analysis(ctx):
    p, rng = ctx["params"], ctx["rng"]
    data_rng = np.random.default_rng(p["data_seed"])
    v_prior = _prior_volume(p["data_seed"] + 1)
    rows = []
    for sp in p["speakers"]:
        for nz in p["noise_dba"]:
            for _ in range(p["rooms_per_cell"]):
                r = trial.run(data_rng, speaker=sp, noise_dba=nz, method="all")
                e = r["est"]
                row = {"speaker": sp, "noise": nz, "V": r["V"], "S": r["S"], "t60": r["t60"], "ok": bool(e.get("ok")),
                       "n_true": r["n_modes_true_in_band"], "n_pencil": len(e.get("pencil_modes", [])),
                       "n_peaks": len(e.get("peaks", [])), "f_lo": e.get("f_lo"),
                       "err_prior": abs(v_prior / r["V"] - 1), "errT60": r.get("errT60", np.nan),
                       "errAlpha": r.get("errAlpha", np.nan), "errS_S3": r.get("errS_S3", np.nan)}
                for m in METHODS:
                    row["err_" + m] = abs(r.get("errV_" + m, np.nan))
                    row["V_" + m] = (e.get(m) or {}).get("V", np.nan)
                rows.append(row)
    ctx["state"]["rows"] = rows
    out = {"n_rooms": len(rows), "v_prior": v_prior, "by_cell": {}, "rows": rows}
    for sp in p["speakers"]:
        sel = [r for r in rows if r["speaker"] == sp]
        cell = {"ok_share": float(np.mean([r["ok"] for r in sel]))}
        for m in METHODS + ("prior",):
            v = np.array([r["err_" + m] if r["ok"] else np.nan for r in sel])
            cell["med_err_" + m] = float(np.nanmedian(v)) if np.isfinite(v).any() else float("nan")
            cell["within25_" + m] = float(np.nanmean(v < 0.25)) if np.isfinite(v).any() else float("nan")
        out["by_cell"][sp] = cell
    lap = [r for r in rows if r["speaker"] == "laptop" and r["ok"]]
    out["S3_med_err_laptop"] = float(np.median([r["err_S3"] for r in lap]))
    out["S3_neg_med_err_laptop"] = -out["S3_med_err_laptop"]
    gap = [r["err_prior"] - r["err_S3"] for r in lap]
    out["gap_prior_laptop"], out["gap_prior_ci_lo"], out["gap_prior_ci_hi"] = _boot_ci(gap, rng, p["n_boot"])
    okr = [r for r in rows if r["ok"]]
    g23 = [r["err_S2"] - r["err_S3"] for r in okr]
    out["gap_S2_S3"], out["gap_S2_S3_ci_lo"], out["gap_S2_S3_ci_hi"] = _boot_ci(g23, rng, p["n_boot"])
    g34 = [r["err_S3"] - r["err_S4"] for r in okr]
    out["gap_S3_S4"], out["gap_S3_S4_ci_lo"], out["gap_S3_S4_ci_hi"] = _boot_ci(g34, rng, p["n_boot"])
    out["med_abs_errT60"] = float(np.nanmedian([abs(r["errT60"]) for r in okr]))
    out["med_abs_errAlpha"] = float(np.nanmedian([abs(r["errAlpha"]) for r in okr]))
    out["ok_share_all"] = float(np.mean([r["ok"] for r in rows]))
    rt = roundtrip.run_all(seed=p["data_seed"] + 2, n_full=p["roundtrip_full"])
    out["roundtrip"] = rt
    out["R0_error_db"] = rt["R0"]["error_db"]
    out["R1_max_abs_df"] = rt["R1"]["max_abs_df"]
    out["R2_worst_error_db"] = max(r["error_db"] for r in rt["R2"])
    ctx["state"]["gap"] = gap
    return out


def shuffled_truth(ctx, analysis):
    rng = ctx["rng"]
    lap = [r for r in ctx["state"]["rows"] if r["speaker"] == "laptop" and r["ok"]]
    est = np.array([r["V_S3"] for r in lap])
    tru = np.array([r["V"] for r in lap])
    null = []
    for _ in range(ctx["params"]["n"]):
        perm = rng.permutation(len(tru))
        while np.any(perm == np.arange(len(tru))):
            perm = rng.permutation(len(tru))
        null.append(-float(np.median(np.abs(est / tru[perm] - 1))))
    return null


def signflip(ctx, analysis):
    rng = ctx["rng"]
    g = np.array(ctx["state"]["gap"])
    return [float(np.mean(g * rng.choice([-1, 1], len(g)))) for _ in range(ctx["params"]["n"])]
