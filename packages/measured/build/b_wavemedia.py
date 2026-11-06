# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Wave media for packages/wavelab: PREM, observed Earth free-oscillation frequencies, NIST fluid states,
the Perseverance sound speeds on Mars, the Hunga Lamb-wave speed and the 1976 standard atmosphere.

Sources fetched 2026-11-05 (UA research-fetch/1.0, no email). Quotes are re-found in the text layer where a
usable one exists; the Masters and Widmer table and the 1976 atmosphere are scans and were read by eye from
page renders (marked read_by_eye). Run with python -I and MEASURED_REFS set.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import PKG, prov, write  # noqa: E402,F401

prov.SOURCES.update({
    "masters-widmer-modes": ("Masters and Widmer 1995, Free oscillations: frequencies and attenuations, AGU Reference Shelf 1, Table 1",
                             "AGU copyright; author-hosted course copy; frequencies are facts; PDF kept internal"),
    "prem-mineos": ("Dziewonski and Anderson 1981, PEPI 25, 297 (PREM), no-ocean tabulation at 1 s from CIG Mineos DEMO/models, commit 26f842d",
                    "PREM values are published facts; Mineos is GPL-2.0; file kept internal"),
    "maurice2022-mars": ("Maurice et al. 2022, In situ recording of Mars soundscape, Nature 605, 653", "CC BY 4.0"),
    "tonga-lamb": ("Sci. Rep. 12 (2022) doi:10.1038/s41598-022-23984-2 (POLA, Ny-Alesund); Pure Appl. Geophys. (2024) doi:10.1007/s00024-024-03477-1",
                   "CC BY 4.0"),
    "nist-webbook-fluids": ("NIST Chemistry WebBook SRD 69, Thermophysical Properties of Fluid Systems (Lemmon, McLinden, Friend)",
                            "US Government work; cite"),
    "nssdc-factsheets": ("NASA NSSDC planetary fact sheets (Venus, Mars, Earth)", "US Government work; cite"),
    "us-standard-atmosphere-1976": ("U.S. Standard Atmosphere, 1976 (NOAA-S/T 76-1562), Tables 2 to 4", "US Government work"),
})

MODES_BY_EYE = [  # mode, f_obs uHz, error, f_PREM uHz (Table 1, page 108)
    ("0S2", 309.45, 0.15, 309.28), ("0T2", 377.30, 0.80, 379.17), ("0S3", 468.55, 0.15, 468.56),
    ("0T3", 587.60, 0.70, 586.16), ("0S4", 646.80, 0.20, 647.07), ("0S0", 814.39, 0.01, 814.31),
]
USSA = {"T0_K": 288.15, "P0_Pa": 101325.0, "g0": 9.80665, "r0_km": 6356.766, "gamma": 1.40,
        "R_star_1976": 8.31432e3, "sutherland_S_K": 110.0, "sutherland_beta": 1.458e-6,
        "Hb_km": [0, 11, 20, 32, 47, 51, 71, 84.852], "LMb_K_per_km": [-6.5, 0.0, 1.0, 2.8, 0.0, -2.8, -2.0],
        "air_M_kg_per_kmol": [28.0134, 31.9988, 39.948, 44.00995, 20.183, 4.0026, 83.80, 131.30, 16.04303, 2.01594],
        "air_F": [0.78084, 0.209476, 0.00934, 0.000314, 0.00001818, 0.00000524, 0.00000114, 0.000000087, 0.000002, 0.0000005]}
MARS_QUOTES = [  # id, value, unit, quote in the text layer
    ("mars.fR_Hz", 240.0, "Hz", "the relaxation frequency is about 240Hz on Mars"),
    ("mars.c_libs_lo", 246.0, "m/s", "sound speeds between 246ms-1 and 257ms-1"),
    ("mars.c_libs_hi", 257.0, "m/s", "sound speeds between 246ms-1 and 257ms-1"),
    ("mars.c_ingenuity", 237.7, "m/s", "speed of sound c=237.7"),
    ("mars.c_temp_lo", 238.8, "m/s", "speed of sound ranges from 238.8ms-1 to 242.9ms-1"),
    ("mars.c_temp_hi", 242.9, "m/s", "speed of sound ranges from 238.8ms-1 to 242.9ms-1"),
    ("mars.T_lo", 232.0, "K", "232K and 240K at a height of 1.45m"),
    ("mars.T_hi", 240.0, "K", "232K and 240K at a height of 1.45m"),
    ("mars.gamma0", 1.2857, "", "Using 0=1.2857"),
]
TONGA_QUOTES = [
    ("tonga.lamb_pola", 308.0, 0.6, "s41598-022-23984-2.pdf", "v = (308.0"),
    ("tonga.lamb_pageoph", 310.0, None, "s00024-024-03477-1.pdf", "the propagation speed of 310 m/s"),
]


def text(source, name):
    import subprocess
    out = subprocess.run(["pdftotext", str(prov.RAW / source / name), "-"], capture_output=True, check=True).stdout
    return " ".join(out.decode("utf-8", "replace").split())


def nist(name, cols=("Temperature (K)", "Pressure (MPa)", "Density (kg/m3)", "Cv (J/g*K)", "Cp (J/g*K)",
                     "Sound Spd. (m/s)", "Viscosity (Pa*s)", "Phase")):
    lines = (prov.RAW / "nist-webbook-fluids" / name).read_text(encoding="utf-8").splitlines()
    head = lines[0].split("\t")
    idx = [head.index(c) for c in cols if c in head]
    rows = []
    for ln in lines[1:]:
        f = ln.split("\t")
        if any(f[i] == "undefined" for i in idx):
            continue  # the WebBook prints undefined where a correlation has no value (some saturation rows)
        rows.append([f[i] if head[i] == "Phase" else float(f[i]) for i in idx])
    return {"columns": [head[i] for i in idx], "rows": rows, "file": name, "sha256": prov.verify("nist-webbook-fluids", name)}


def prem():
    lines = (prov.RAW / "prem-mineos" / "prem_noocean.txt").read_text().splitlines()
    n = int(lines[2].split()[0])
    rows = [[float(x) for x in ln.split()] for ln in lines[3:3 + n]]
    assert len(rows) == n and rows[-1][0] == 6371000.0, (len(rows), rows[-1][0])
    return {"columns": ["r_m", "rho", "vpv", "vsv", "qkappa", "qmu", "vph", "vsh", "eta"], "rows": rows,
            "header": lines[0].strip(), "counts": [int(x) for x in lines[2].split()],
            "reference_period_s": 1.0, "status": "fitted", "file": "prem_noocean.txt",
            "sha256": prov.verify("prem-mineos", "prem_noocean.txt")}


def main():
    mars_t = text("maurice2022-mars", "s41586-022-04679-0.pdf")
    mars = []
    for fid, val, unit, q in MARS_QUOTES:
        assert q.replace(" ", "") in mars_t.replace(" ", ""), (fid, q)
        mars.append({"id": fid, "value": val, "unit": unit, "quote": q, "status": "measured"})
    tonga = []
    for fid, val, err, name, q in TONGA_QUOTES:
        assert q in text("tonga-lamb", name), (fid, q)
        tonga.append({"id": fid, "value": val, "err": err, "unit": "m/s", "file": name, "quote": q, "status": "measured",
                      "sha256": prov.verify("tonga-lamb", name)})
    modes = [{"id": m, "f_obs_uHz": f, "err_uHz": e, "f_prem_uHz": fp, "status": "measured", "read_by_eye": True}
             for m, f, e, fp in MODES_BY_EYE]
    table = {
        "provenance": {"method": "see build/b_wavemedia.py; quotes re-found in text layers, scans read by eye",
                       "files": {"prem_noocean.txt": prov.verify("prem-mineos", "prem_noocean.txt"),
                                 "mode_lect1.pdf": prov.verify("masters-widmer-modes", "mode_lect1.pdf"),
                                 "s41586-022-04679-0.pdf": prov.verify("maurice2022-mars", "s41586-022-04679-0.pdf"),
                                 "19770009539.pdf": prov.verify("us-standard-atmosphere-1976", "19770009539.pdf")},
                       "citations": {k: prov.SOURCES[k][0] for k in ("masters-widmer-modes", "prem-mineos", "maurice2022-mars",
                                                                     "tonga-lamb", "nist-webbook-fluids", "us-standard-atmosphere-1976")}},
        "prem": prem(), "modes": {"rows": modes, "source": "masters-widmer-modes"},
        "rows": mars + tonga,
        "ussa1976": {**USSA, "status": "defined", "read_by_eye": True, "pages": "Table 2 p. 2, Tables 3 and 4 p. 3"},
        "nist": {"co2_mars": nist("co2_mars_0.00061MPa.tsv"), "n2_titan": nist("n2_titan_0.1467MPa.tsv"),
                 "co2_venus": nist("co2_venus_9.2MPa.tsv"), "water_1atm": nist("water_0.101325MPa.tsv"),
                 "water_sat": nist("water_saturation_lowP.tsv", ("Temperature (K)", "Pressure (Pa)", "Surf. Tension (l, N/m)")),
                 "status": "derived", "note": "NIST reference equations of state; zero-frequency (relaxed) sound speed"},
        "planets": {"venus": {"p_bar": 92.0, "T_K": 737.0, "M": 43.45}, "mars": {"p_mbar": 6.36, "T_K": 214.0, "M": 43.49},
                    "earth": {"p_mbar": 1014.0, "T_K": 288.0, "M": 28.97},
                    "titan": {"p_bar": 1.467, "T_K": 93.65, "status": "from_memory",
                              "note": "Huygens HASI surface values (Fulchignoni et al. 2005); no open copy fetched"},
                    "source": "nssdc-factsheets", "status": "measured"},
    }
    write("wave_media", table)


if __name__ == "__main__":
    main()
