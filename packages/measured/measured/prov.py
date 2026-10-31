# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Provenance helpers: read a source's SHA256SUMS and SOURCE.txt, verify a file, stamp a table."""
import datetime
import hashlib
import os
from pathlib import Path


class _Refs:
    """Raw-source root from the MEASURED_REFS environment variable, resolved when first used."""

    def __truediv__(self, other):
        env = os.environ.get("MEASURED_REFS")
        if not env:
            raise RuntimeError("set MEASURED_REFS to the folder holding the raw sources "
                               "(one subfolder per source, each with SOURCE.txt and SHA256SUMS)")
        return Path(env) / other


RAW = _Refs()

# One line per source: citation and licence as recorded at intake (2026-10-30/31).
SOURCES = {
    "kuhn2002": ("Kuhn, M. G. 2002, Optical time-domain eavesdropping risks of CRT displays, IEEE S&P, eqs. 8-10, Fig. 3",
                 "IEEE copyright; author copy; numbers are facts, PDF kept internal"),
    "desai1984": ("Desai, James, Ho 1984, Electrical resistivity of selected elements, J. Phys. Chem. Ref. Data 13, 1069, Table 5",
                  "NIST SRD reprint, AIP/NIST copyright; values are facts, PDF kept internal"),
    "bodhaine1999": ("Bodhaine, Wood, Dutton, Slusser 1999, On Rayleigh optical depth calculations, J. Atmos. Oceanic Technol. 16, 1854, Table 3 and eqs. 5-23",
                     "AMS copyright (course mirror); table values are facts"),
    "kodak-5219": ("Eastman Kodak, KODAK VISION3 500T 5219/7219 technical data H-1-5219t (2015)",
                   "Kodak copyright public data sheet; digitised values are facts; PDF not redistributed"),
    "kodak-2383": ("Eastman Kodak, KODAK VISION Color Print Film 2383/3383 data sheet H-1-2383 (2022)",
                   "Kodak copyright public data sheet; PDF not redistributed"),
    "lekner-dorf1988": ("Lekner and Dorf 1988, Why some things are darker when wet, Appl. Opt. 27, 1278, eqs. 1-11",
                        "OSA copyright; author scan; formulas are facts"),
    "marshall-palmer1948": ("Marshall and Palmer 1948, The distribution of raindrops with size, J. Meteor. 5, 165",
                            "AMS copyright; mirror scan; fitted constants are facts"),
    "codata2022": ("CODATA 2022 adjustment, NIST SRD 121, physics.nist.gov/cuu/Constants/Table/allascii.txt",
                   "US Government work (NIST)"),
    "schott-optical-glass": ("SCHOTT optical glass overview (xlsx, 2025) and datasheet collection",
                             "no terms stated on the download page; manufacturer data kept internal; values cited"),
    "slum-kotthaus": ("Kotthaus et al. 2014, ISPRS J. 94, 194; SLUM v1.0, Zenodo 10.5281/zenodo.4263842",
                      "MPL-2.0"),
    "gid-disdrometer": ("Adirosi et al. 2023, Database of the Italian disdrometer network, ESSD 15, 2417; Zenodo 17432012 (V04)",
                        "CC BY 4.0"),
    "merl-brdf": ("Matusik, Pfister, Brand, McMillan 2003, A data-driven reflectance model; MERL BRDF database, Zenodo 10.5281/zenodo.8101681",
                  "CC BY-SA 4.0 (share-alike reaches derived tables)"),
    "rii-database": ("refractiveindex.info database release v2026-05-24 (Polyanskiy 2024, Sci. Data 11, 94); per-record primary papers",
                     "CC0 1.0"),
    "cie-datasets": ("CIE data tables: std illuminant A 1 nm (10.25039/CIE.DS.8jsxjrsn), D65 (10.25039/CIE.DS.hjfjmt59), 1931 2 deg CMF (10.25039/CIE.DS.xvudnb9b), V(lambda) (10.25039/CIE.DS.dktna2s3)",
                     "CC BY-SA 4.0 (per each dataset's metadata JSON, checked 2026-10-30)"),
    "usgs-splib07": ("Kokaly et al. 2017, USGS Spectral Library Version 7, DOI 10.5066/F7RR1WDJ (splib07a ASCII)",
                     "US Government work; no licence stated (inferred public domain)"),
    "steck-cesium": ("Steck, D. A., Cesium D Line Data (current revision, steck.us/alkalidata)",
                     "author-hosted free document; cite"),
    "ti-opa1642": ("Texas Instruments OPA1641/OPA1642/OPA1644 data sheet", "TI copyright; free data sheet; internal"),
    "itu-r-bt": ("ITU-R BT.1700-0 (02/2005), BT.470-7 (02/2005), BT.1886-0 (03/2011)", "ITU free download terms"),
    "rca-tpm1508a": ("RCA TPM-1508A, Phosphors for cathode-ray tubes (Oct 1961), persistence table p. 6",
                     "1961 publication on a public archive; copyright unclear; internal"),
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def recorded(source, name):
    """The sha256 recorded at download time for one file of one source."""
    for line in (RAW / source / "SHA256SUMS").read_text().splitlines():
        h, f = line.split("  ", 1)
        if f == name:
            return h
    raise KeyError((source, name))


def verify(source, name):
    """Recompute and compare; return the hash. A mismatch stops the build."""
    p = RAW / source / name
    got = sha256(p)
    want = recorded(source, name)
    if got != want:
        raise RuntimeError(f"sha256 mismatch for {p}: {got} != {want}")
    return got


def stamp(source, files, status="measured", method="", **extra):
    """Table-level provenance block. Rows inherit it unless they override status."""
    cite, lic = SOURCES[source]
    return {"source": source, "citation": cite, "licence": lic,
            "files": {f: verify(source, f) for f in files},
            "status": status, "method": method,
            "built": datetime.date.today().isoformat(), **extra}
