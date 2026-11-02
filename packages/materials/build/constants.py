# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Hand-entered values, each with its source. Nothing here is estimated.

USDA Forest Products Laboratory, Wood Handbook: Wood as an Engineering Material,
FPL-GTR-282 (2021). A work of the US Government (17 U.S.C. 105). Read from the PDF
text: Table 5-3a (US species, 12% MC, specific gravity and MOE), the balsa
row of Table 5-5a, Table 5-2 (Poisson ratio mu_LR), Table 4-7 (thermal conductivity
across the grain at 12% MC), Eq. 4-18a (heat capacity of dry wood).
"""

WOOD_SRC = "usda-fpl-gtr-282"

# id: (specific gravity at 12% MC or green where noted, MOE_L MPa at 12%, mu_LR,
#      k W/m/K at 12% MC, table refs)
WOOD = {
    "wood_red_oak": (0.63, 12500, 0.350, 0.18, "Table 5-3a Oak, red, Northern red; Table 5-2 Oak, red; Table 4-7"),
    "wood_sugar_maple": (0.63, 12600, 0.424, 0.18, "Table 5-3a Maple, Sugar; Table 5-2 Maple, sugar; Table 4-7"),
    "wood_douglas_fir": (0.48, 13400, 0.292, 0.14, "Table 5-3a Douglas-fir, Coast; Table 5-2 Douglas-fir; Table 4-7 Coast"),
    "wood_white_pine": (0.35, 8500, None, 0.11, "Table 5-3a Pine, Eastern white; Table 4-7 Pine, Eastern white"),
    "wood_balsa": (0.16, 3400, 0.229, None, "Table 5-5a Balsa (SG green 0.16, MOE 12%); Table 5-2 Balsa"),
}


def wood_cp_dry(T_K=298.15):
    """Eq. 4-18a: cp0 = 0.1031 + 0.003867 T  (kJ/kg/K), dry wood."""
    return (0.1031 + 0.003867 * T_K) * 1000.0


# Drude inputs for nearly-free-electron metals: molar mass (kg/mol, IUPAC standard
# atomic weights) and conduction electrons per atom (textbook valence).
DRUDE = {
    "silver": (0.10787, 1), "gold": (0.19697, 1), "copper": (0.063546, 1),
    "aluminium": (0.026982, 3), "sodium": (0.022990, 1), "potassium": (0.039098, 1),
}

# Gas molar masses (kg/mol, IUPAC standard atomic weights; air: dry air, ISO 2533).
GAS_MOLAR_MASS = {"air": 0.028965, "nitrogen": 0.028014, "oxygen": 0.031998, "argon": 0.039948,
                  "helium": 0.0040026, "hydrogen": 0.002016, "neon": 0.020180, "krypton": 0.083798,
                  "xenon": 0.131293, "carbon_dioxide": 0.044010, "methane": 0.016043,
                  "ammonia": 0.017031, "sulfur_hexafluoride": 0.146055}

LAYER_OVERRIDE_M = {"kapton": 5e-5, "silk_fibroin": 5e-5}

PHASE = {"gas": "gas", "liquid": "liquid"}
PHASE_OVERRIDE = {"mercury": "liquid", "blood": "liquid", "blood_plasma": "liquid"}

# Body-term render knob: the thickness of a layer over a white ground, in metres.
# A render choice, not a material property; recorded beside each preview. Pigments
# use about one particle diameter (0.5 um), since powders return light after short
# paths. Film materials, whose n and k were measured on films, use 50 um.
LAYER_M = {"liquid": 0.01, "gas": 1.0, "dielectric": 0.01, "mineral": 0.005,
           "pigment": 5e-7, "biological": 0.001, "semiconductor": 1e-6, "metal": 0.0, "wood": 0.0}

LICENCES = {
    "refractiveindex.info": ("CC0-1.0", "https://refractiveindex.info/about"),
    "physicallybased.info": ("CC0-1.0", "https://github.com/AntonPalmqvist/physically-based-api"),
    "wikidata": ("CC0-1.0", "https://www.wikidata.org/wiki/Wikidata:Licensing"),
    WOOD_SRC: ("US-Government-work (17 USC 105)", "https://research.fs.usda.gov/treesearch/62200"),
    "cie": ("CC-BY-SA-4.0", "https://doi.org/10.25039/CIE.DS.xvudnb9b"),
    "doi": ("CC-BY-4.0", "https://api.crossref.org/works/<doi> (licence field) and the article page"),
    "pubchem-hsdb": ("US-Government-work (17 USC 105)", "https://www.nlm.nih.gov/web_policies.html"),
    "derived": ("derived in this library from cited inputs", None),
}
