// ---------------- Known answers.
function insideChecks() {
  const base = {
    ...S,
    two: 0,
    mat: 0,
    inv: 0,
    tilt: 0,
    spin: 0,
    size: 1,
    oz: 0,
    disp: 0,
    disp2: 0,
    bire: false,
    absA: [0, 0, 0],
    morphOn: false,
    inner: null,
    persp: "look",
    view: "look",
    frame: 0,
    wscale: 0.1,
  };
  const rows = [],
    R = {};
  // Snell's window: flat plate, camera on its mid plane, angle fan toward the top face.
  R.snell = [];
  for (const [n, ex] of [
    [1.333, 48.6],
    [1.5, 41.8],
  ]) {
    const q = { ...base, shape: 40, curve: 1, n };
    const w = 4096,
      A = (Math.PI / 2) * 0.7,
      g = fan(q, w, { P: [0, 0, 0], D: [0, 0, 1], Up: [1, 0, 0], A, kind: 1 });
    let e = null;
    for (let k = 0; k < w; k++) {
      if (g(k, 2)[2] > 0.5) {
        e = ((k / w) * A * 180) / Math.PI;
        break;
      }
    }
    R.snell.push({ n, ex, m: e });
    rows.push([`Snell window, n ${n}`, fmt(e, 2) + "° against " + ex + "°"]);
  }
  // Repeat count: bounces between the two faces of a plate before the rim, by geometry.
  R.repeat = [];
  for (const [deg, c] of [
    [50, 0.2],
    [60, 0.2],
    [70, 0.2],
    [60, 0.05],
    [75, 0.05],
  ]) {
    const hT = 0.08 + (0.6 - 0.08) * c,
      T = 2 * hT,
      th = (deg * Math.PI) / 180,
      q = { ...base, shape: 40, curve: c, n: 1.5 };
    const g = fan(q, 1, {
      P: [0, 0, 0],
      D: [Math.sin(th), 0, Math.cos(th)],
      kind: 2,
      A: 1e-7,
      Up: [1, 0, 0],
      bounce: 60,
    });
    const m = g(0, 3)[0];
    const pred = 1 + Math.floor((1.2 - hT * Math.tan(th)) / (T * Math.tan(th)));
    R.repeat.push({ deg, T, m: m - 1, pred });
    rows.push([`Reflections at ${deg}°, T ${T.toFixed(2)}`, `${m - 1} against ${pred}`]);
  }
  // Globe: object at the centre looks n times larger, seen by parallel rays: edge at n a.
  {
    const n = 1.5,
      a = 0.3,
      q = { ...base, shape: 5, n, inner: "spheres", ioOverride: [0, 0, 0, a] };
    const w = 2048,
      g = fan(q, w, {
        P: [0, 0, -3],
        D: [0, 0, 1],
        Up: [1, 0, 0],
        A: 1,
        kind: 2,
        inner: 1,
        bounce: 2,
      });
    let e = 0;
    for (let k = 0; k < w; k++) if (g(k, 1)[3] > 0.5) e = (k + 1) / w;
    R.centre = { m: e, ex: n * a };
    rows.push(["Centre sphere edge, a 0.30", fmt(e, 4) + " against " + fmt(n * a, 4)]);
  }
  // Globe: apparent position of an axis point at radius r, from rays leaving it, against n/s + 1/s' = (n-1)/R with s = R-r.
  R.app = [];
  for (const r of [0, 0.3, 0.5, 0.8]) {
    const n = 1.5,
      q = { ...base, shape: 5, n };
    const g = fan(q, 64, { P: [0, 0, -r], D: [0, 0, -1], Up: [1, 0, 0], A: 0.02, kind: 1 });
    let sum = 0,
      N = 0;
    for (let k = 8; k < 64; k++) {
      const x = g(k, 0),
        d = g(k, 1);
      const ty = d[0] / d[2];
      if (Math.abs(ty) < 1e-5) continue;
      sum += x[2] - x[0] / ty;
      N++;
    }
    const m = -(sum / N);
    const s = 1 - r,
      sp = 1 / ((n - 1) / 1 - n / s),
      ex = 1 + sp;
    R.app.push({ r, m, ex });
    rows.push([`Apparent radius of r = ${r}`, fmt(m, 4) + " against " + fmt(ex, 4)]);
  }
  // Luneburg: rays from a rim point leave parallel to the diameter.
  {
    const q = { ...base, shape: 30, n: 1.5 };
    const g = fan(q, 64, { P: [0, 0, -0.999], D: [0, 0, 1], Up: [1, 0, 0], A: 1.2, kind: 1 });
    let s = 0,
      N = 0,
      mx = 0;
    for (let k = 0; k < 64; k++) {
      const x = g(k, 0),
        d = g(k, 1);
      if (x[3] < 0) continue;
      const an = Math.atan2(Math.hypot(d[0], d[1]), d[2]);
      s += an * an;
      mx = Math.max(mx, an);
      N++;
    }
    R.lune = { rms: (Math.sqrt(s / N) * 180) / Math.PI, max: (mx * 180) / Math.PI, N };
    rows.push(
      ["Luneburg exit, RMS off axis", fmt(R.lune.rms, 3) + "°"],
      ["Luneburg exit, worst", fmt(R.lune.max, 3) + "° of " + N + " rays"]
    );
  }
  reset();
  last.checks = R;
  return { R, rows };
}
