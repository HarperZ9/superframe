// SPDX-License-Identifier: FSL-1.1-MIT
// Physical constants the rooms use, each with unit and source. Those marked verified were compared on 2026-10-31
// against the reference named in the row; every other row carries the flag "from memory, unverified" until a check
// is run and written here. A citation alone does not clear the flag.
import { constant as c } from "./provenance.js";

const CODATA = "CODATA 2022 table, NIST SRD 121 (packages/measured codata2022.json)";
const SCHOTT = "SCHOTT optical glass data sheets, 2025 overview";
const RII = "Interpolated at 587.6 nm in packages/materials (refractiveindex.info CC0 records)";
const checked = (against, result) => ({ against, result });

const PHYSICS = {
  standardGravity: c(9.80665, "m/s^2", {
    source: "CGPM 1901, defined value",
    verified: checked(CODATA, "equal, exact"),
  }),
  vacuumPermittivity: c(8.854e-12, "F/m", {
    source: "CODATA, rounded to 4 figures on the page",
    verified: checked(CODATA, "8.8541878188e-12 rounds to this; relative difference 2e-5"),
  }),
  illuminantAc2: c(1.435e7, "nm*K", {
    source: "CIE 15, illuminant A definition",
    verified: checked("CIE illuminant A 1 nm table (packages/measured cie_check.json)", "max relative error 4.77e-6, 380 to 780 nm"),
    note: "The CIE definition fixes this value. CODATA gives 1.438777e7 nm K, which must not be used for illuminant A.",
  }),
  illuminantAT: c(2848, "K", {
    source: "CIE 15, illuminant A definition",
    verified: checked("CIE illuminant A 1 nm table (packages/measured cie_check.json)", "as above"),
  }),
  cmfTable: c("core/data/cie.js CMF", "1", {
    source: "CIE 1931 2 degree observer, 10.25039/CIE.DS.xvudnb9b",
    verified: checked("CIE_xyz_1931_2deg.csv at 10 nm, 380 to 700 nm", "max absolute difference 1.6e-7"),
  }),
  d65Table: c("core/data/cie.js D65", "1", {
    source: "CIE D65, 10.25039/CIE.DS.hjfjmt59",
    verified: checked("CIE_std_illum_D65.csv at 10 nm, 340 to 700 nm", "max absolute difference 0.005, the table's rounding"),
  }),
  airyFactor: c(1.22, "1", {
    source: "First zero of J1 over pi, Airy 1835",
    verified: checked("FFT of a round stop, tests/wave.test.mjs", "first dark ring within 1.5 percent"),
  }),
  electrowettingAngle0: c(160, "deg", { source: "Assumed rest angle, Mugele and Baret 2005 for the form" }),
  electrowettingEpsR: c(3, "1", { source: "Assumed dielectric, Mugele and Baret 2005 for the form" }),
  electrowettingTension: c(0.04, "N/m", { source: "Assumed interfacial tension" }),
  electrowettingThickness: c(1e-6, "m", { source: "Assumed dielectric thickness" }),
  lineF: c(486.1, "nm", { source: "Fraunhofer F line" }),
  lineC: c(656.3, "nm", { source: "Fraunhofer C line" }),
  lined: c(587.6, "nm", { source: "Helium d line" }),
  renderRed: c(630, "nm", { source: "Page choice for the red channel" }),
  renderGreen: c(532, "nm", { source: "Page choice for the green channel" }),
  renderBlue: c(465, "nm", { source: "Page choice for the blue channel" }),
  beePeakGreen: c(544, "nm", { source: "Peitsch et al. 1992" }),
  beePeakBlue: c(436, "nm", { source: "Peitsch et al. 1992" }),
  beePeakUV: c(344, "nm", { source: "Peitsch et al. 1992" }),
  beeInterommatidial: c(1.9, "deg", { source: "Land 1997" }),
  labDelta: c(0.008856, "1", { source: "CIE 15, CIELAB threshold" }),
  machadoMatrices: c("core/spectra.js MACH", "1", { source: "Machado, Oliveira and Fernandes 2009, severity 1" }),
  srgbMatrices: c("core/spectra.js X2R, R2X", "1", { source: "IEC 61966-2-1, D65 white" }),
  woodcockOptical: c(0.71, "1", { source: "Extrapolation length for diffusion, Ishimaru" }),
  hstR1: c(11.04, "m", { source: "Burrows, SPIE 1494, 1991" }),
  hstK1: c(-1.0022985, "1", { source: "Burrows, SPIE 1494, 1991" }),
  hstKFlaw: c(-1.0139, "1", { source: "Burrows et al. 1991" }),
  keckR: c(34.974, "m", { source: "Keck Technical Note 163" }),
  keckK: c(-1.0037963, "1", { source: "COMSOL Keck model" }),
  f2Nd: c(1.62, "1", {
    source: SCHOTT,
    verified: checked("SCHOTT overview, F2", "1.62004 rounds to this"),
  }),
  f2Vd: c(36.37, "1", { source: SCHOTT, verified: checked("SCHOTT overview, F2", "equal") }),
  sk16Nd: c(1.6204, "1", {
    source: "SK16 as entered with the Cooke triplet",
    note: "SCHOTT lists N-SK16 at 1.62041, 60.32; SK16 itself is not in the 2025 table.",
  }),
  sk16Vd: c(60.33, "1", { source: "SK16 as entered with the Cooke triplet" }),
  bk7Nd: c(1.5168, "1", { source: SCHOTT, verified: checked("SCHOTT overview, N-BK7", "equal") }),
  bk7Vd: c(64.17, "1", { source: SCHOTT, verified: checked("SCHOTT overview, N-BK7", "equal") }),
};

const m = (value, unit, source, verified) => c(value, unit, { source, ...(verified ? { verified } : {}) });
const ALPHA_UNIT = "1"; // per scene unit, with one unit read as 10 cm unless noted

/** Rows in page order. Numbers are constants; text and switches stay plain. */
export const MATERIAL_RECORDS = {
  custom: { name: "Custom", source: "Set by the viewer" },
  glass: {
    name: "Crown glass N-BK7",
    nd: PHYSICS.bk7Nd,
    V: PHYSICS.bk7Vd,
    alpha: m([0.0012, 0.0009, 0.0011], ALPHA_UNIT, "SCHOTT N-BK7 datasheet"),
    source: "SCHOTT N-BK7 datasheet",
  },
  water: {
    name: "Water",
    nd: m(1.333, "1", "Daimon and Masumura 2007", checked(RII, "Hale and Querry 1973 record 1.3325; within the page rounding")),
    V: m(55.8, "1", "Daimon and Masumura 2007"),
    alpha: m([0.045, 0.0065, 0.0019], ALPHA_UNIT, "Pope and Fry 1997"),
    source: "Daimon and Masumura 2007 for the index; Pope and Fry 1997 for absorption",
  },
  diamond: {
    name: "Diamond",
    nd: m(2.4173, "1", "Phillip and Taft 1964", checked(RII, "record 2.41683, difference 4.7e-4")),
    V: m(55.3, "1", "Phillip and Taft 1964"),
    alpha: m([0, 0, 0], ALPHA_UNIT, "Treated as clear"),
    source: "Phillip and Taft 1964",
  },
  ice: {
    name: "Ice",
    nd: m(1.3098, "1", "Warren and Brandt 2008", checked(RII, "record 1.30975")),
    V: m(71, "1", "Read from the Warren and Brandt 2008 index table"),
    alpha: m([0.05, 0.008, 0.0015], ALPHA_UNIT, "Warren and Brandt 2008"),
    source: "Warren and Brandt 2008, index and absorption; V read from their index table",
  },
  amber: {
    name: "Amber",
    nd: m(1.54, "1", "GIA gem reference"),
    V: m(50, "1", "Assumed: no published dispersion found"),
    alpha: m([0.05, 0.28, 1.1], ALPHA_UNIT, "Assumed: chosen to match a clear honey amber"),
    source:
      "Index: GIA gem reference. No published dispersion or absorption found, so V and alpha here are assumed values chosen to match a clear honey amber",
  },
  soap: {
    name: "Soap film",
    film: true,
    source:
      "Airy reflectance of a thin film with n 1.33, Born and Wolf section 7.6. Reflectance is scaled 2.5 times so the colours read at normal view",
  },
  quartz: {
    name: "Quartz, crystal",
    nd: m(1.5443, "1", "Ghosh 1999", checked(RII, "record 1.5443")),
    dne: m(0.0091, "1", "Ghosh 1999"),
    V: m(69.9, "1", "Ghosh 1999"),
    bire: true,
    alpha: m([0, 0, 0], ALPHA_UNIT, "Treated as clear"),
    source: "Ghosh 1999, no 1.5443, ne 1.5534 at 589 nm",
  },
  calcite: {
    name: "Calcite, crystal",
    nd: m(1.6584, "1", "Ghosh 1999", checked(RII, "record 1.65844")),
    dne: m(-0.172, "1", "Ghosh 1999"),
    V: m(48.8, "1", "Ghosh 1999"),
    bire: true,
    alpha: m([0, 0, 0], ALPHA_UNIT, "Treated as clear"),
    source: "Ghosh 1999, no 1.6584, ne 1.4864 at 589 nm",
  },
  sapphire: {
    name: "Sapphire, crystal",
    nd: m(1.7682, "1", "Malitson and Dodge 1972", checked(RII, "record 1.76814")),
    dne: m(-0.0078, "1", "Malitson and Dodge 1972"),
    V: m(72.2, "1", "Malitson and Dodge 1972"),
    bire: true,
    alpha: m([0, 0, 0], ALPHA_UNIT, "Treated as clear"),
    source: "Malitson and Dodge 1972, no 1.7682, ne 1.7604",
  },
  fluorite: {
    name: "Fluorite, crystal (cubic)",
    nd: m(1.4338, "1", "Malitson 1963", checked(RII, "Li 1980 record 1.43385")),
    V: m(95.2, "1", "Malitson 1963"),
    alpha: m([0, 0, 0], ALPHA_UNIT, "Treated as clear"),
    source: "Malitson 1963. Cubic, so it has no birefringence",
  },
};

const materialRows = {};
for (const [id, r] of Object.entries(MATERIAL_RECORDS))
  for (const k of ["nd", "V", "dne", "alpha"]) if (r[k]) materialRows[`mat.${id}.${k}`] = r[k];

export const CONSTANTS = { ...PHYSICS, ...materialRows };

const DERIVED = checked("Double-precision ray trace, tests/train.test.mjs", "focal length within tolerance of the derived value");
const preset = (source, verified = false, note = "") => c(0, "1", { source, verified, note: note || undefined });
/** One row per instrument prescription. Designs hand derived and re-traced are verified; entered numbers are not. */
export const PRESET_PROVENANCE = {
  refractor: preset("Hand derived thin achromat, Kingslake, Lens Design Fundamentals", DERIVED),
  cooke: preset("Cooke 40 degree sample distributed with Zemax, entered from memory", false, "Focal length from rays matches 50, which checks the sum of the numbers, not each one."),
  microscope: preset("Hand derived from aplanatic points, Born and Wolf section 4.2.3"),
  newton: preset("Hand derived: parabola of radius 2f; layout after Newton, 1672", DERIVED),
  cass: preset("Hand derived, Rutten and van Venrooij, Telescope Optics", DERIVED),
  hst: preset("Design values cited in the preset note: Burrows 1991, COMSOL Hubble model"),
  hstflaw: preset("Measured conic cited from Burrows et al. 1991"),
  paul: preset("Hand derived from Paul, 1935", DERIVED),
  gregorian: preset("Hand derived, Rutten and van Venrooij", DERIVED),
  keck: preset("Keck Technical Note 163; COMSOL Keck model"),
  wolter: preset("Hand derived from Wolter, 1952", DERIVED),
};
