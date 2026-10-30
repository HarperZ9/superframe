# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Hand-entered values from open literature and US Government data, each with its source.

Water contact angle: static sessile-drop angles in degrees from open-access papers whose
licence (checked on the article page or in its Crossref record, 2026-10-29/30) is CC BY 4.0.
Facts are not copyrightable, and the CC BY attribution is kept per value anyway. A value
marked "advancing" is an advancing angle, which runs higher than the static one.
Metal angles depend on airborne hydrocarbons: a clean metal is wetted almost completely,
and the same copper reads 13 deg after vacuum desorption and 103 deg after two weeks in
air (doi:10.1021/acsami.1c09733). So every metal value is low confidence.

Surface tension, viscosity, static permittivity: NLM Hazardous Substances Data Bank (HSDB),
read through the PubChem PUG-View API. HSDB is a US Government work (17 U.S.C. 105);
NLM asks for the credit "Source: National Library of Medicine". Only HSDB annotations are
used; other PubChem depositors carry their own terms and are skipped.
"""

CC_BY = "CC-BY-4.0"

# doi: (short citation, where in the paper)
PAPERS = {
    "10.3390/met12081274": ("Somlyai-Sipos and Baumli, Metals 12, 1274 (2022)", "Tables 1 and 2; polished just before "
                            "measuring, 5 uL distilled water in air, mean of 10 drops, +/-5 deg"),
    "10.3390/polym13030403": ("Park et al., Polymers 13, 403 (2021)", "Fig. 3a text, uncoated substrates"),
    "10.3390/polym17101394": ("Hatescu et al., Polymers 17, 1394 (2025)", "Table 3, untreated Goodfellow polyimide film"),
    "10.1038/s41467-022-33081-7": ("Yao et al., Nat. Commun. 13, 5339 (2022)", "Fig. 4b text, pristine PVC"),
    "10.1038/s41598-019-43625-5": ("Gokaltun et al., Sci. Rep. 9, 7377 (2019)", "Sylgard 184 10:1, 6 uL, native PDMS above 101 deg"),
    "10.3390/ma15062313": ("Tsuzuki et al., Materials 15, 2313 (2022)", "Sylgard 184 untreated, 2 uL: 120 deg"),
    "10.3390/nano10061187": ("Kunz et al., Nanomaterials 10, 1187 (2020)", "non-irradiated fused silica, acetone and IPA clean"),
    "10.3390/nano11010129": ("Soldera et al., Nanomaterials 11, 129 (2021)", "flat soda-lime reference, 2 uL; cleaning not stated"),
    "10.3390/nano13131952": ("Lozano et al., Nanomaterials 13, 1952 (2023)", "pristine c-plane sapphire, advancing angle, Fig. 1"),
    "10.3390/molecules29051062": ("Xing et al., Molecules 29, 1062 (2024)", "raw polished calcite, Table 2 A1"),
    "10.3390/ijms24076269": ("Zhou et al., Int. J. Mol. Sci. 24, 6269 (2023)", "cast silk fibroin film A-0, Fig. 3c"),
    "10.3390/polym15081901": ("Kwon et al., Polymers 15, 1901 (2023)", "pristine regenerated cellulose film, 10 uL"),
    "10.1021/acsami.2c10121": ("Zalieckas et al., ACS Appl. Mater. Interfaces 14, 44933 (2022)", "H-terminated nanocrystalline diamond"),
    "10.1103/PhysRevFluids.10.054002": ("Demmenie et al., Phys. Rev. Fluids 10, 054002 (2025)",
                                        "water on ice near 0 C: advancing 12 deg, receding about 7 deg"),
}

# id: (angle deg, +/- or None, doi, confidence, note)
CONTACT_ANGLE = {
    "silver": (64, 5, "10.3390/met12081274", "low", "polished, air-exposed"),
    "gold": (62, 5, "10.3390/met12081274", "low", "polished, air-exposed; a clean gold surface is wetted"),
    "copper": (72, 5, "10.3390/met12081274", "low", "polished, air-exposed; 13-103 deg with exposure "
               "(doi:10.1021/acsami.1c09733)"),
    "iron": (72, 5, "10.3390/met12081274", "low", "polished, air-exposed"),
    "nickel": (73, 5, "10.3390/met12081274", "low", "polished, air-exposed"),
    "titanium": (62, 5, "10.3390/met12081274", "low", "polished, air-exposed"),
    "tungsten": (63, 5, "10.3390/met12081274", "low", "polished, air-exposed"),
    "aluminium": (71, 5, "10.3390/met12081274", "low", "polished, air-exposed (Table 2, measured)"),
    "molybdenum": (76, 5, "10.3390/met12081274", "low", "polished, air-exposed (Table 2, measured)"),
    "mercury": (58, 5, "10.3390/met12081274", "low", "water drop on liquid mercury (Table 2, measured)"),
    "silicon": (76, 5, "10.3390/met12081274", "low", "polished elemental Si, not an oxidised wafer"),
    "pet": (67.1, 0.6, "10.3390/polym13030403", "moderate", "bare substrate"),
    "polycarbonate": (77.2, 1.3, "10.3390/polym13030403", "moderate", "bare substrate"),
    "polystyrene": (79.7, 0.01, "10.3390/polym13030403", "moderate", "bare substrate; 78.3 deg in "
                    "doi:10.3390/polym12122770"),
    "pmma": (63.9, 2.0, "10.3390/polym13030403", "moderate", "bare substrate"),
    "kapton": (78.7, 1.1, "10.3390/polym17101394", "low", "polyimide film of unnamed grade, not confirmed as Kapton"),
    "pvc": (97.3, 2.5, "10.1038/s41467-022-33081-7", "low", "medical PVC, likely plasticised"),
    "pdms": (102, None, "10.1038/s41598-019-43625-5", "low", "Sylgard 184; another CC BY study reads 120 deg "
             "(doi:10.3390/ma15062313), so the spread is about 20 deg"),
    "fused_silica": (39.5, 4.0, "10.3390/nano10061187", "moderate", "solvent-cleaned; glass angles fall with cleaning"),
    "soda_lime_glass": (52, None, "10.3390/nano11010129", "low", "cleaning not stated"),
    "sapphire": (66, None, "10.3390/nano13131952", "low", "advancing angle, not static"),
    "calcite": (37.14, None, "10.3390/molecules29051062", "moderate", "polished to 5000 mesh, acid rinse"),
    "silk_fibroin": (68.27, 2.22, "10.3390/ijms24076269", "moderate", "cast film, no alcohol anneal"),
    "cellulose": (58.9, 0.86, "10.3390/polym15081901", "moderate", "regenerated cellulose film"),
    "diamond": (70.4, 3.0, "10.1021/acsami.2c10121", "low", "H-terminated; O-terminated reads 9.9 deg in the "
                "same paper, so the surface termination decides"),
    "ice": (12, None, "10.1103/PhysRevFluids.10.054002", "low", "advancing angle near the melting point"),
}

HSDB = "pubchem-hsdb"
# id: {field: (SI value, temperature K, PubChem CID, HSDB text as read, confidence, note or None)}
HSDB_VALUES = {
    "water": {"surface_tension": (0.07197, 298.15, 962, "71.97 dyne/cm at 25 C", "high", None),
              "viscosity": (8.949e-4, 298.15, 962, "Dynamic viscosity: 0.8949 cP at 25 C", "high", None)},
    "ethanol": {"surface_tension": (0.02197, 298.15, 702, "21.97 mN/m at 25 C", "moderate", None),
                "viscosity": (1.074e-3, 298.15, 702, "1.074 mPa.s at 25 C", "moderate", None)},
    "methanol": {"surface_tension": (0.02207, 298.15, 887, "22.07 mN/m at 25 C", "moderate", None),
                 "viscosity": (5.44e-4, 298.15, 887, "0.544 mPa.s at 25 C", "moderate", None)},
    "acetone": {"surface_tension": (0.0237, 293.15, 180, "20 C: 23.7 mN/m", "moderate", None),
                "viscosity": (3.2e-4, 293.15, 180, "0.32 cP at 20 C", "moderate", None)},
    "benzene": {"surface_tension": (0.02822, 298.15, 241, "28.22 mN/m at 25 C", "moderate", None),
                "viscosity": (6.04e-4, 298.15, 241, "0.604 mPa.s at 25 C", "moderate", None)},
    "toluene": {"surface_tension": (0.02773, 298.15, 1140, "27.73 mN/m at 25 C", "moderate", None),
                "viscosity": (5.60e-4, 298.15, 1140, "0.560 mPa-s at 25 C", "moderate", None)},
    "hexane": {"surface_tension": (0.01789, 298.15, 8058, "17.89 mN/m at 25 C", "moderate", None),
               "viscosity": (3.26e-4, 293.15, 8058, "3.26X10-4 Pa-s at 20 C", "moderate", None)},
    "ethylene_glycol": {"surface_tension": (0.04799, 298.15, 174, "47.99 mN/m at 25 C", "moderate", None),
                        "viscosity": (1.61e-2, 298.15, 174, "16.1 mPa-sec at 25 C", "moderate", None)},
    "glycerol": {"viscosity": (0.954, 298.15, 753, "954 CENTIPOISES AT 25 C", "moderate", None)},
    "oleic_acid": {"surface_tension": (0.0328, 293.15, 445639, "32.8 dyne/cm at 20 C", "moderate", None),
                   "viscosity": (2.56e-2, 303.15, 445639, "25.6 cP at 30 C", "moderate", None)},
    "carbon_disulfide": {"surface_tension": (0.03225, 293.15, 6348, "32.25 dynes/cm at 20 C", "moderate", None),
                         "viscosity": (3.63e-4, 293.15, 6348, "Coefficient of viscosity = 0.363 at 20 C", "low",
                                       "HSDB gives no unit; read as cP, the only physically plausible unit"),
                         "relative_permittivity": (2.641, None, 6348, "dielectric constant 2.641 at low frequencies",
                                                   "moderate", None)},
    "mercury": {"surface_tension": (0.470, 293.15, 23931, "470 dynes/cm @ 20 C", "moderate", None),
                "viscosity": (1.55e-3, 293.15, 23931, "1.55 mPa.sec (15.5 millipoise) at 20 C", "moderate", None)},
    "nitrogen": {"viscosity": (1.79e-5, 300.0, 947, "17.9 at 300 K (uPa.s)", "moderate", None)},
    "oxygen": {"viscosity": (2.075e-5, 298.15, 977, "Gas: 101.325 kPa at 25 C (0.020 75 cP)", "moderate", None)},
    "helium": {"viscosity": (1.953e-5, 293.15, 23987, "1.953 at 20 C, 0.1 MPa", "low",
                             "HSDB gives no unit; read as 1e-5 Pa s, the only physically plausible unit")},
    "carbon_dioxide": {"viscosity": (2.129e-5, 300.0, 280, "21.29 uPa-sec at 300 K", "moderate", None)},
    "methane": {"viscosity": (1.087e-5, 293.15, 297, "108.7 uP at 20 C", "moderate", None)},
    "sulfur_hexafluoride": {"viscosity": (1.5029e-5, 298.15, 17358, "Gas: 150.29 micropoise at 25 C", "moderate",
                                          None)},
}
# Seen and not used: CCl4 surface tension "3.23X10-2 N/m at 25.33 K" (temperature garbled upstream),
# CCl4 viscosity at 250 K (at the melting point), ammonia and O2/N2/CH4 liquid-phase values on gas records.

# Nonpolar gases: static permittivity from the Maxwell relation eps = n^2, with n at 780 nm from the
# record's own refractiveindex.info data. Dispersion from 780 nm to DC changes eps - 1 by a few
# percent, which is a part in 1e5 of eps. Polar or IR-active gases (NH3, CO2, SF6) are excluded.
MAXWELL_GASES = ["air", "nitrogen", "oxygen", "argon", "helium", "hydrogen", "neon", "krypton", "xenon", "methane"]
