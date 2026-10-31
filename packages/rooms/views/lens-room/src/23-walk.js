// ---------------- Fan probes through the same trace.
function fan(St, w, o, h = 4) {
  const q = Object.assign({}, St, {
    pt: false,
    polA: 0,
    polP: 0,
    pol: 0,
    bounce: o.bounce || 1,
    innerProbe: o.inner ? 1 : 0,
    persp: "look",
  });
  setLens(q, w, h, 5, 3, 0);
  sI("uFan", o.kind || 0);
  sV("uFanP", o.P);
  sV("uFanD", o.D || [0, 0, 1]);
  sV("uFanU", o.Up || [1, 0, 0]);
  sF("uFanA", o.A || 1);
  sI("uSteps", 2000);
  const px = drawProbe(w, h);
  return (k, r) => {
    const i = (r * w + k) * 4;
    return [px[i], px[i + 1], px[i + 2], px[i + 3]];
  };
}
function fAt(St, p) {
  const q = Object.assign({}, St, {
    inner: null,
    pol: 0,
    polA: 0,
    polP: 0,
    pt: false,
    two: 0,
    mat: 0,
    persp: "look",
  });
  setLens(q, 1, 1, 7, 1);
  sV("uFanP", stackToWorld(St, p));
  return drawProbe(1, 1)[0];
}
const UNITS = (v) =>
  v < 0.01
    ? (v * 1000).toFixed(1) + " mm"
    : v < 1
      ? (v * 100).toFixed(1) + " cm"
      : v.toFixed(2) + " m";
function walkRows() {
  if (!S.wk) return [];
  const g = fan(S, 512, { P: stackToWorld(S, S.wk), kind: 0 });
  let dmin = 1e9,
    F = 0,
    N = 0,
    tir = 0;
  for (let k = 0; k < 512; k++) {
    const a = g(k, 2);
    if (a[0] < 0) continue;
    dmin = Math.min(dmin, a[0]);
    F += a[1];
    tir += a[2];
    N++;
  }
  const n = g(0, 2)[3];
  const crit = n > 1 ? (Math.asin(1 / n) * 180) / Math.PI : null;
  const u = S.wscale;
  last.walkR = { n, dmin, crit, leave: N ? 1 - F / N : 0, tir: N ? tir / N : 0 };
  return [
    ["Lens radius here", UNITS(u)],
    ["Local index", fmt(n, 3)],
    ["Nearest surface", N ? UNITS(dmin * u) : "none"],
    ["Critical angle", crit ? fmt(crit, 1) + "°" : "none"],
    ["Rays leaving", N ? fmt(100 * (1 - F / N), 0) + "%" : "none"],
    ["Rays reflected", N ? fmt((100 * F) / N, 0) + "%" : "none"],
    ["Past critical angle", N ? fmt((100 * tir) / N, 0) + "%" : "none"],
  ];
}
function enterWalk() {
  if (S.shape === "none") {
    $("err").hidden = false;
    $("err").textContent = "Choose a shape first: there is no medium to stand in.";
    return;
  }
  S.mat = 0;
  $("glass").setAttribute("aria-pressed", "true");
  $("mirror").setAttribute("aria-pressed", "false");
  VOX = null;
  const v = voxels(S);
  if (!v.deep) {
    $("err").hidden = false;
    $("err").textContent = "This shape has no solid interior to stand in.";
    return;
  }
  S.wk = [v.deep[1], v.deep[2], v.deep[3]];
  // Starts facing the longest clear run through the medium, measured by a fan of rays, so the view runs along the shape and its walls.
  const N = 512,
    g = fan(S, N, { P: stackToWorld(S, S.wk), kind: 0 });
  let best = -1,
    bk = 0;
  for (let k = 0; k < N; k++) {
    const a = g(k, 2);
    if (a[0] > best) {
      best = a[0];
      bk = k;
    }
  }
  const kf = bk + 0.5,
    z = 1 - (2 * kf) / N,
    an = kf * 2.39996,
    rr = Math.sqrt(Math.max(1 - z * z, 0)),
    dir = [rr * Math.cos(an), rr * Math.sin(an), z];
  S.yaw = Math.atan2(dir[0], dir[2]);
  S.pitch = -Math.asin(dir[1]);
  reset();
}
// Moves with sliding: if the full step would leave the medium, try each axis alone. f is read at the new point, so the camera stays in the shape.
function walkStep(dx, dy, dz) {
  const mg = -Math.min(0.01, (VOX && VOX.deep ? VOX.deep[0] : 0.02) * 0.4);
  const ok = (p) => fAt(S, p) < mg;
  const w = S.wk,
    t = [w[0] + dx, w[1] + dy, w[2] + dz];
  if (ok(t)) {
    S.wk = t;
  } else {
    for (const [i, v] of [
      [0, dx],
      [1, dy],
      [2, dz],
    ]) {
      if (!v) continue;
      const c = S.wk.slice();
      c[i] += v;
      if (ok(c)) S.wk = c;
    }
  }
  reset();
}
const held = {};
