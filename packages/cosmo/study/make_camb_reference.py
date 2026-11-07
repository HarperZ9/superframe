# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Write data/camb_reference.json: CAMB's linear and halofit (Takahashi) P(k) for the default cosmology.

CAMB is used here only as a reference generator (pip install camb); nothing in cosmolab imports it.
Massless neutrinos, A_s tuned so CAMB's sigma8 equals the Cosmology default, k in h/Mpc, P in (Mpc/h)^3.
    python packages/cosmo/study/make_camb_reference.py
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
from cosmolab.background import Cosmology  # noqa: E402


def main():
    import camb
    c = Cosmology()
    pars = camb.CAMBparams()
    pars.set_cosmology(H0=100 * c.h, ombh2=c.omega_b * c.h ** 2, omch2=(c.omega_m - c.omega_b) * c.h ** 2,
                       mnu=0.0, num_massive_neutrinos=0, TCMB=c.t_cmb)
    pars.set_matter_power(redshifts=[1.0, 0.0], kmax=200)
    a_s = 2.1e-9
    for _ in range(3):  # set A_s so that CAMB's own sigma8 equals the target; the halofit input is then exact
        pars.InitPower.set_params(ns=c.n_s, As=a_s)
        a_s *= (c.sigma8 / camb.get_results(pars).get_sigma8_0()) ** 2
    pars.InitPower.set_params(ns=c.n_s, As=a_s)
    pars.NonLinearModel.set_params(halofit_version="takahashi")
    out = {"generator": f"CAMB {camb.__version__} (camb.info), halofit_version takahashi, massless neutrinos",
           "cosmology": c.__dict__, "z": None, "k": None, "linear": {}, "halofit": {}}
    for nl in (False, True):
        pars.NonLinear = camb.model.NonLinear_both if nl else camb.model.NonLinear_none
        res = camb.get_results(pars)
        kh, z, pk = res.get_matter_power_spectrum(minkh=1e-4, maxkh=100, npoints=240)
        out["sigma8_camb"] = float(res.get_sigma8_0())
        key = "halofit" if nl else "linear"
        for i, zz in enumerate(z):
            out[key][f"{zz:g}"] = [float(v) for v in pk[i]]
        out["z"], out["k"] = [float(v) for v in z], [float(v) for v in kh]
        if not nl:
            out["omega_m_z"] = {f"{zz:g}": float(res.get_Omega("cdm", z=zz) + res.get_Omega("baryon", z=zz)) for zz in z}
    dest = HERE.parents[1] / "data" / "camb_reference.json"
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(out, indent=1))
    print("wrote", dest.name, len(out["k"]), "k values")


if __name__ == "__main__":
    main()
