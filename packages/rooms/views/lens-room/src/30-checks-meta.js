function metaChecks() {
  const base = {
    ...S,
    kind: "lens",
    shape: "none",
    two: 0,
    mat: 0,
    inner: null,
    scene: "meta",
    meta: true,
    pt: false,
    frame: 30,
    zoom: 1.3,
    dist: 5,
    tilt: 0,
    spin: 0,
    size: 1,
    yaw: 0,
    pitch: 0,
    ap: 0,
    disp: 0,
    polA: 0,
    polP: 0,
    morphOn: false,
    scatOn: false,
    persp: "look",
    view: "look",
    absA: [0, 0, 0],
  };
  const w = 240,
    h = 120;
  const meas = (q, xa, xb) => {
    const px = renderMean(q, w, h, 64, null);
    const m = (x0, x1) => {
      const v = [0, 0, 0];
      let n = 0;
      for (let y = (h * 0.42) | 0; y < h * 0.58; y++)
        for (let x = x0 | 0; x < x1; x++) {
          const o = (y * w + x) * 4;
          v[0] += px[o];
          v[1] += px[o + 1];
          v[2] += px[o + 2];
          n++;
        }
      return v.map((a) => a / n);
    };
    return [m(w * xa[0], w * xa[1]), m(w * xb[0], w * xb[1])];
  };
  const white = (ill) => {
    const E = ILL[ill];
    let Y = 0,
      X = [0, 0, 0];
    BL.forEach((l, i) => {
      Y += cmfB[i][1] * E[i];
      cmfB[i].forEach((c, k) => (X[k] += c * E[i]));
    });
    return X.map((a) => a / Y);
  };
  const L = [0.33, 0.46],
    Rr = [0.54, 0.67],
    out = {};
  for (const ill of ["D65", "A", "LED"]) {
    const [p, q] = meas({ ...base, illum: ill }, L, Rr);
    const W = white(ill);
    out[ill] = dE(labOf(p, W), labOf(q, W));
    if (ill == "D65") out.xyz = [p, q];
  }
  for (const d of ["protan", "deutan", "tritan"])
    for (const ill of ["D65", "A"]) {
      const [p, q] = meas({ ...base, illum: ill }, L, Rr);
      const W = white(ill);
      const t = (v) => mv(R2X, mv(MACH[d], mv(X2R, v)));
      out[d + "_" + ill] = dE(labOf(t(p), labOf0(t(W))), labOf(t(q), labOf0(t(W))));
    }
  {
    const qL = { ...base, illum: "D65", shape: 0, curve: 0.9, size: 0.6, disp: 0.12, n: 1.6 };
    const [p, q] = meas(qL, [0.4, 0.48], [0.52, 0.6]);
    const W = white("D65");
    out.lens = dE(labOf(p, W), labOf(q, W));
  }
  for (const o of ["bee", "bird"]) {
    const [p, q] = meas({ ...base, illum: "D65", metaObs: o, frame: 31 }, L, Rr);
    out[o] = p.map((v, i) => (100 * Math.abs(v - q[i])) / Math.max(v, q[i]));
  }
  reset();
  return out;
}
