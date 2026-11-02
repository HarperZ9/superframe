// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Instrument prescriptions
// Train surfaces: z and y vertex, R radius (0 flat), k conic, a4 a6 asphere, n index after, V Abbe after, ap semi aperture,
// hole inner radius, ty 0 refract 1 mirror 2 stop 3 image, tilt radians about x. Light starts along +z.
export const surf = (o) =>
  Object.assign(
    { z: 0, y: 0, R: 0, k: 0, a4: 0, a6: 0, n: 1, V: 0, ap: 1, hole: 0, ty: 0, tilt: 0, name: "" },
    o
  );
// Paraxial marginal ray from a parallel input, with signed index for mirrors. Places image surfaces; not used for any readout.
export function paraxImage(S, n0 = 1, objZ = null) {
  let n = n0,
    y = 0.001,
    u = 0,
    zp = S[0].z,
    sgnDir = 1;
  if (objZ !== null) {
    u = y / (S[0].z - objZ);
  }
  for (const s of S) {
    y += u * (s.z - zp);
    zp = s.z;
    const c = s.R ? 1 / s.R : 0;
    if (s.ty == 1) {
      const np = -n;
      u = (n * u - y * c * (np - n)) / np;
      n = np;
      sgnDir = -sgnDir;
    } else if (s.ty == 0) {
      const np = sgnDir * s.n;
      u = (n * u - y * c * (np - n)) / np;
      n = np;
    }
  }
  return zp - y / u;
}
// Thin achromat from the classic pair of equations, Kingslake, Lens Design Fundamentals, chapter on achromats:
// power split phi1=phi*V1/(V1-V2), phi2=-phi*V2/(V1-V2). Crown is equiconvex, flint shares the cemented radius.
export function achromat(
  z,
  f,
  D,
  n1 = 1.5168,
  V1 = 64.17,
  n2 = 1.62,
  V2 = 36.37,
  t1 = null,
  t2 = null
) {
  t1 = t1 ?? D * 0.14;
  t2 = t2 ?? D * 0.06;
  const p = 1 / f,
    p1 = (p * V1) / (V1 - V2),
    p2 = (-p * V2) / (V1 - V2),
    c = p1 / (n1 - 1),
    c1 = c / 2,
    c2 = -c / 2,
    c3 = c2 - p2 / (n2 - 1);
  return [
    surf({ z, R: 1 / c1, n: n1, V: V1, ap: D / 2, name: "crown" }),
    surf({ z: z + t1, R: 1 / c2, n: n2, V: V2, ap: D / 2, name: "flint" }),
    surf({ z: z + t1 + t2, R: 1 / c3, n: 1, ap: D / 2, name: "back" }),
  ];
}
// Unbuilt designs: PRESETS.json from the unbuilt-instruments work did not exist when this page was built. Paste its entries here as {key,name,note,surfaces:[surf fields]}; they appear under a group labelled as unbuilt.
export const UNBUILT = [];
export const PRESETS = {
  refractor: {
    group: "Refractors and lenses",
    name: "Achromatic refractor f/10",
    expect: 10,
    note: "Hand derived thin achromat in N-BK7 and F2, following Kingslake, Lens Design Fundamentals. Glass data: SCHOTT catalog.",
    make() {
      const s = achromat(0, 10, 1);
      const iz = paraxImage(s);
      s.push(surf({ z: iz, ty: 3, ap: 1 }));
      return { s, fieldDeg: 0.5, src: "star" };
    },
  },
  cooke: {
    group: "Refractors and lenses",
    name: "Cooke triplet 50 mm f/5",
    expect: 50,
    unit: 1,
    note: "Prescription: the Cooke 40 degree field sample distributed with Zemax, entered from memory and checked here by its measured focal length. Glass: SK16 and F2.",
    make() {
      const a = 5;
      let z = 0;
      const add = (R, t, n, V, ap, ty = 0, name = "") => {
        const o = surf({ z, R, n, V, ap, ty, name });
        z += t;
        return o;
      };
      const s = [
        add(22.01359, 3.25896, 1.6204, 60.33, 6.5),
        add(-435.76044, 6.00755, 1, 0, 6.5),
        add(-22.21328, 1.0, 1.62, 36.37, 4.5),
        add(20.29192, 4.75, 1, 0, 4.5),
        add(0, 0, 1, 0, 4.7, 2, "stop"),
        add(79.6836, 2.95, 1.6204, 60.33, 6.3),
        add(-18.39533, 42.2078, 1, 0, 6.3),
      ];
      s.push(surf({ z, ty: 3, ap: 40 }));
      return { s, fieldDeg: 10, pupil: 5, unitM: 1e-3, src: "chart" };
    },
  },
  microscope: {
    group: "Refractors and lenses",
    name: "Amici oil objective with tube lens",
    note: "Hand derived from the aplanatic points of a sphere (Born and Wolf, Principles of Optics, section 4.2.3): front hemisphere and a meniscus each add aplanatic power, then a thin achromat forms the image. Oil matched to the front glass. The tube lens is a thin hand-solved achromat, so spherical aberration grows quickly as the pupil opens: numerical aperture is held near 0.45 and read from the rays below.",
    make() {
      const n = 1.5168,
        R1 = 1,
        cen = R1 / n,
        z1 = cen + R1,
        v1 = cen - n * R1,
        R2f = 3,
        z2 = v1 + R2f,
        z3 = z2 + 1.5,
        Rr = (z3 - v1) / (1 + 1 / n),
        cr = z3 - Rr,
        v2 = cr - n * Rr;
      const s = [
        surf({ z: z1, R: -R1, n: 1, ap: 0.98, name: "front hemisphere" }),
        surf({ z: z2, R: -R2f, n, V: 64.17, ap: 1.6 }),
        surf({ z: z3, R: -Rr, n: 1, ap: 1.9 }),
        ...achromat(z3 + 3, 8, 5),
      ];
      const iz = paraxImage(s, n, 0);
      s.push(surf({ z: iz, ty: 3, ap: 30 }));
      return {
        s,
        obj: 0,
        n0: n,
        objField: 0.05,
        pupil: 0.5,
        spec: 6,
        unitM: 1e-3,
        src: "specimen",
      };
    },
  },
  newton: {
    group: "Mirror telescopes",
    name: "Newtonian 200 mm f/6",
    expect: 12,
    note: "Hand derived: a parabola of radius 2f has zero on-axis spherical aberration, conic minus one. Layout after Newton, 1672.",
    make() {
      const f = 12;
      return {
        s: [
          surf({ z: 0, R: -2 * f, k: -1, ty: 1, ap: 1, hole: 0.22, name: "primary parabola" }),
          surf({ z: -f * 0.85, tilt: Math.PI / 4, ty: 1, ap: 0.4, name: "fold flat" }),
          surf({ z: -f * 0.85, y: -f * 0.15, tilt: Math.PI / 2, ty: 3, ap: 1 }),
        ],
        fieldDeg: 0.5,
        src: "star",
      };
    },
  },
  cass: {
    group: "Mirror telescopes",
    name: "Classical Cassegrain, hand derived",
    expect: 12,
    note: "Hand derived, Rutten and van Venrooij, Telescope Optics: f1=3, secondary magnification m=4, so EFL is 12. Primary conic minus one, secondary conic minus ((m+1)/(m-1)) squared.",
    make() {
      const f1 = 3,
        m = 4,
        b = 0.5,
        d = (m * f1 - b) / (m + 1),
        p = f1 - d,
        q = m * p,
        R2 = (2 * p * q) / (q - p),
        k2 = -Math.pow((m + 1) / (m - 1), 2);
      return {
        s: [
          surf({ z: 0, R: -2 * f1, k: -1, ty: 1, ap: 0.5, hole: 0.13, name: "primary" }),
          surf({ z: -d, R: -R2, k: k2, ty: 1, ap: 0.13, name: "secondary" }),
          surf({ z: b, ty: 3, ap: 1 }),
        ],
        fieldDeg: 0.3,
        src: "star",
      };
    },
  },
  hst: {
    group: "Mirror telescopes",
    name: "Ritchey-Chretien: Hubble design",
    expect: 57.6,
    note: "Design values: R1 11.040 m with conic minus 1.0022985 (Burrows, SPIE 1494, 1991, and related), R2 1.358 m with conic minus 1.496, separation 4.906 m (COMSOL Hubble model). Published EFL 57.6 m. The as-built primary conic was minus 1.0139, which is the flaw.",
    make(flaw) {
      const s = [
        surf({ z: 0, R: -11.04, k: -1.0022985, ty: 1, ap: 1.2, hole: 0.34, name: "primary" }),
        surf({ z: -4.906071, R: -1.358, k: -1.496, ty: 1, ap: 0.16, name: "secondary" }),
      ];
      s.push(surf({ z: paraxImage(s), ty: 3, ap: 0.3 }));
      return { s, fieldDeg: 0.05, src: "star" };
    },
  },
  hstflaw: {
    group: "Mirror telescopes",
    name: "Hubble as launched (conic flaw)",
    note: "Same design with the measured primary conic of minus 1.0139 (Burrows et al. 1991): shows the spherical aberration that needed COSTAR.",
    make() {
      const s = [
        surf({ z: 0, R: -11.04, k: -1.0139, ty: 1, ap: 1.2, hole: 0.34, name: "primary" }),
        surf({ z: -4.906071, R: -1.358, k: -1.496, ty: 1, ap: 0.16, name: "secondary" }),
      ];
      s.push(surf({ z: paraxImage(s), ty: 3, ap: 0.3 }));
      return { s, fieldDeg: 0.05, src: "star" };
    },
  },
  paul: {
    group: "Mirror telescopes",
    name: "Three mirror anastigmat: Paul",
    expect: 4,
    note: "Hand derived from Paul, 1935: parabolic primary, spherical secondary and tertiary of equal radius, tertiary centred on the secondary. Three mirrors remove spherical aberration, coma and astigmatism.",
    make() {
      const f1 = 4,
        m = 4,
        R1 = -2 * f1,
        f2 = f1 / m,
        d = f1 - f2,
        R = 2 * f2;
      const s = [
        surf({ z: 0, R: R1, k: -1, ty: 1, ap: 0.5, hole: 0.22, name: "primary" }),
        surf({ z: -d, R: -R, k: 0, ty: 1, ap: 0.13, name: "secondary" }),
        surf({ z: -d + R, R: -R, ty: 1, ap: 0.18, name: "tertiary" }),
      ];
      s.push(surf({ z: paraxImage(s), ty: 3, ap: 0.4 }));
      return { s, fieldDeg: 0.3, src: "star" };
    },
  },
  gregorian: {
    group: "Mirror telescopes",
    name: "Gregorian: ellipsoid secondary",
    expect: 12,
    note: "Hand derived, Rutten and van Venrooij: f1 = 3, m = -4, concave ellipsoid secondary past the prime focus, with conic minus ((m+1)/(m-1)) squared.",
    make() {
      const f1 = 3,
        m = 4,
        b = 0.5,
        d = (m * f1 + b) / (m - 1),
        p = d - f1,
        q = m * p,
        R2 = (2 * p * q) / (q + p),
        k2 = -Math.pow((m - 1) / (m + 1), 2);
      return {
        s: [
          surf({ z: 0, R: -2 * f1, k: -1, ty: 1, ap: 0.5, hole: 0.17, name: "primary" }),
          surf({ z: -d, R: R2, k: k2, ty: 1, ap: 0.17, name: "ellipsoid" }),
          surf({ z: b, ty: 3, ap: 1 }),
        ],
        fieldDeg: 0.3,
        src: "star",
      };
    },
  },
  keck: {
    group: "Mirror telescopes",
    name: "Segmented primary: Keck",
    expect: 17.487,
    note: "Keck primary, 36 hexagonal segments 1.8 m across flats. Radius 34.974 m (Keck Technical Note 163), conic minus 1.0037963 (COMSOL Keck model). Prime focus only. Segment piston and tilt errors below use a fixed random pattern.",
    make() {
      const R = 34.974;
      return {
        s: [
          surf({ z: 0, R: -R, k: -1.0037963, ty: 1, ap: 5.5, name: "segmented primary" }),
          surf({ z: -R / 2, ty: 3, ap: 1 }),
        ],
        seg: { i: 0, pitch: 1.8 },
        fieldDeg: 0.02,
        src: "star",
      };
    },
  },
  wolter: {
    group: "Grazing",
    name: "Wolter type I X ray mirror",
    stretch: true,
    marginal: true,
    expect: 10.05,
    note: "Hand derived: paraboloid followed by a confocal hyperboloid, the design in Wolter, 1952. Join radius 1, focal distance 10, total deflection four times the grazing angle.",
    make() {
      const zF = 10,
        rj = 1,
        a4 = Math.atan(rj / zF),
        zP = rj / Math.tan(a4 / 2);
      const p = -zP + Math.sqrt(zP * zP + rj * rj),
        zv = zP + p / 2;
      const zc = (zF + zP) / 2,
        cc = (zP - zF) / 2,
        d1 = Math.hypot(rj, zF),
        d2 = Math.hypot(rj, zP),
        aH = (d2 - d1) / 2,
        b2 = cc * cc - aH * aH;
      return {
        s: [
          surf({ z: -3, ty: 2, ap: 1.05, hole: 1.0, name: "annular entrance" }),
          surf({ z: zv, R: -p, k: -1, ty: 1, ap: 1.2, name: "paraboloid" }),
          surf({
            z: zc - aH,
            R: -b2 / aH,
            k: -(cc * cc) / (aH * aH),
            ty: 1,
            ap: 1.1,
            name: "hyperboloid",
          }),
          surf({ z: zF, ty: 3, ap: 0.3 }),
        ],
        pupil: 1.05,
        fieldDeg: 0.05,
        src: "star",
      };
    },
  },
};
for (const u of UNBUILT)
  PRESETS[u.key] = {
    group: "Unbuilt: designs, not hardware",
    name: u.name,
    note: u.note,
    make() {
      const s = u.surfaces.map(surf);
      if (s[s.length - 1].ty != 3) s.push(surf({ z: paraxImage(s), ty: 3, ap: s[0].ap }));
      return { s, fieldDeg: u.fieldDeg || 0.1, src: "star" };
    },
  };
// ======================================================================= Lens readouts and side view
export function para(g, flip, h0) {
  const x = g(0, 1),
    d = g(0, 2),
    e = g(0, 0);
  if (e[3] <= 0 || x[3] < 0) return null;
  const ty = d[1] / d[2];
  if (!isFinite(ty) || Math.abs(ty) < 1e-7) return { afocal: true, h1: x[1], h0 };
  const zF = x[2] - x[1] / ty;
  const f = flip ? h0 / ty : -h0 / ty;
  return flip ? { f, zF, H: zF + f, h1: x[1], h0 } : { f, zF, H: zF - f, h1: x[1], h0 };
}
export function spotStats(px, N) {
  let n = 0,
    mx = 0,
    my = 0;
  const pts = [];
  let inP = 0;
  for (let i = 0; i < N * N; i++) {
    const o = i * 4;
    const x = (((i % N) + 0.5) / N) * 2 - 1,
      y = ((((i / N) | 0) + 0.5) / N) * 2 - 1;
    if (x * x + y * y > 1) continue;
    inP++;
    if (px[o + 3] > 0.5) {
      n++;
      mx += px[o];
      my += px[o + 1];
      pts.push([px[o], px[o + 1]]);
    }
  }
  if (!n) return { n: 0, inP };
  mx /= n;
  my /= n;
  let s = 0,
    mr = 0;
  for (const p of pts) {
    const d = (p[0] - mx) ** 2 + (p[1] - my) ** 2;
    s += d;
    mr = Math.max(mr, d);
  }
  return { n, inP, rms: Math.sqrt(s / n), max: Math.sqrt(mr), mx, my, pts };
}
export function sagAt(s, r) {
  const c = s.R ? 1 / s.R : 0;
  const de = 1 - (1 + s.k) * c * c * r * r;
  if (de < 0) return null;
  return (c * r * r) / (1 + Math.sqrt(de)) + s.a4 * r ** 4 + s.a6 * r ** 6;
}
