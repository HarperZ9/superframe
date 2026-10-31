// Scattering known answers.
function scatChecks() {
  const base = {
    ...S,
    kind: "lens",
    two: 0,
    mat: 0,
    inv: 0,
    tilt: 0,
    spin: 0,
    size: 1,
    oz: 0,
    disp: 0,
    absA: [0, 0, 0],
    morphOn: false,
    inner: null,
    persp: "look",
    view: "look",
    frame: 0,
    wscale: 0.1,
    scene: "chart",
    meta: false,
    scatOn: true,
    fRho: "1",
    fAbs: "1",
    fTr: "1",
    hg: 0,
    alb: 1,
    n: 1,
    shape: 40,
  };
  const R = {};
  const shoot = (q, hT, rays, draws, bounce) => {
    let thru = 0,
      uns = 0,
      tot = 0;
    for (let d = 0; d < draws; d++) {
      frame = d * 7 + 1;
      const g = fan(q, rays, { P: [0, 0, -1.7], D: [0, 0, 1], kind: 2, A: 1e-7, bounce });
      for (let k = 0; k < rays; k++) {
        tot++;
        const x = g(k, 0),
          dr = g(k, 1),
          sc = g(k, 3);
        if (x[3] < 0) continue;
        if (x[2] > hT - 0.02 && dr[2] > 0) {
          thru++;
          if (sc[2] == 0) uns++;
        }
      }
    }
    frame = 0;
    return { T: thru / tot, U: uns / tot };
  };
  R.beer = [];
  for (const [sig, c] of [
    [1, 0.2],
    [2, 0.2],
    [2, 0.6],
    [4, 0.6],
  ]) {
    const hT = 0.08 + 0.52 * c,
      L = 2 * hT;
    const r = shoot({ ...base, sig, curve: c }, hT, 4096, 1, 300);
    R.beer.push({ sig, L, m: r.U, ex: Math.exp(-sig * L) });
  }
  const Ls = [];
  for (const c of [0, 0.1, 0.2, 0.3, 0.45]) {
    const hT = 0.08 + 0.52 * c,
      L = 2 * hT;
    const r = shoot({ ...base, sig: 40, curve: c }, hT, 1024, 6, 2500);
    Ls.push({ L, T: r.T });
  }
  const z = 0.71 / 40;
  const xs = Ls.map((a) => Math.log(a.L + 2 * z)),
    ys = Ls.map((a) => Math.log(Math.max(a.T, 1e-5)));
  const mx = xs.reduce((a, b) => a + b) / xs.length,
    my = ys.reduce((a, b) => a + b) / ys.length;
  let nu = 0,
    de = 0;
  xs.forEach((x, i) => {
    nu += (x - mx) * (ys[i] - my);
    de += (x - mx) ** 2;
  });
  R.diff = { Ls, slope: nu / de };
  {
    const q0 = { ...base, shape: 30, n: 1.5, scatOn: false },
      q1 = { ...base, shape: 30, n: 1.5, scatOn: true, sig: 0 };
    const o = { P: [0, 0, -0.999], D: [0, 0, 1], Up: [1, 0, 0], A: 1.2, kind: 1 };
    const a = fan(q0, 64, o),
      A = [];
    for (let k = 0; k < 64; k++) A.push(a(k, 1));
    const b = fan(q1, 64, o);
    let mxd = 0;
    for (let k = 0; k < 64; k++) {
      const v = b(k, 1);
      mxd = Math.max(mxd, Math.hypot(v[0] - A[k][0], v[1] - A[k][1], v[2] - A[k][2]));
    }
    R.clear = { maxDirDiff: mxd };
  }
  // Apodised aperture: transmission at ray height against the typed exp(-2 r^2).
  {
    const q = {
      ...base,
      scatOn: false,
      trOn: true,
      fTr: "exp(-2*r^2)",
      shape: 40,
      curve: 0.2,
      n: 1.5,
    };
    const g = lensProbe(q);
    const rows = [];
    for (const k of [1, 5, 9]) {
      const hh = ((k + 0.5) / 12) * 1.1,
        e = g(k, 0);
      rows.push({ h: hh, m: g(k, 3)[0], ex: Math.exp(-2 * (hh * hh + e[2] * e[2])) });
    }
    R.apod = rows;
  }
  reset();
  return R;
}
window.__more = { metaChecks, moireCheck, scatChecks, MP };
