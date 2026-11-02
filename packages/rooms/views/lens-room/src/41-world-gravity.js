// Deflection probe: measured direction after a long leg, compared with 4GM/(b c^2). The velocity needs a separate read, done in one pass per component.
function gravityRows() {
  if (S.field != "gravity") return [];
  const b = 4,
    L = 400,
    mu = S.mass;
  useProgram("W|gravity", () => worldFS({ body: FIELDS.gravity.body, St: S }));
  setCommon(1, 1, 1);
  sI("uFlip", 1);
  sI("uData", 1);
  sI("uNoHit", 1);
  sF("uK", 0.05);
  sF("uHH", 0.02);
  sF("uM", mu);
  sF("uLay", 0);
  sF("uA2", 1);
  sI("uSteps", 5000);
  sI("uRoom", 0);
  sF("uBg", 1);
  sF("uOplMax", 2 * L);
  sV("uFanP", [b, 0, -L]);
  gl.uniform4fv(U.uObj, new Float32Array(32));
  sI("uNObj", 0);
  const px = drawProbe(1, 1);
  const defl = Math.atan2(-px[0], px[2]);
  const pred = (4 * mu) / b;
  const finite = pred * (L / Math.hypot(L, b));
  last.world = { defl, pred, b, mu, n: px[3], err: (100 * (defl - pred)) / pred };
  return [
    ["Impact parameter b", String(b)],
    ["GM/c²", fmt(mu, 3)],
    ["Deflection, from rays", fmt(defl, 5) + " rad"],
    ["4GM/(b c²)", fmt(pred, 5) + " rad"],
    ["Difference", fmt((100 * (defl - pred)) / pred, 2) + "%"],
  ];
}
function fieldFlag() {
  if (S.field == "formula") {
    const fm = S.formula;
    if (!fm || fm.kind != "index") return "Type an n^2 formula in Lens mode first";
    let neg = 0,
      N = 0;
    for (let x = -3; x <= 3; x += 0.5)
      for (let y = -3; y <= 3; y += 0.5)
        for (let z = -3; z <= 3; z += 0.5) {
          const v = fEval(fm.ast, { x, y, z, r: Math.hypot(x, y, z) });
          N++;
          if (v < 0) neg++;
        }
    if (neg)
      return `Not physical as a plain dielectric: n² is negative at ${neg} of ${N} sample points. Rays are clamped there.`;
  }
  return null;
}
function drawWorldSide() {
  const f = FIELDS[S.field];
  const c = $("over"),
    rr = $("view").getBoundingClientRect();
  const w = (c.width = Math.min(1600, Math.round(rr.width))),
    h = (c.height = Math.min(1200, Math.round(rr.height)));
  const x = c.getContext("2d");
  x.fillStyle = "#05060a";
  x.fillRect(0, 0, w, h);
  const span =
      S.field == "fisheye" ? S.a2 * 3.2 : S.field == "gravity" ? 22 : S.field == "mirage" ? 50 : 13,
    N = 28,
    R = 90;
  const opl = f.opl ? 2.0 * Math.PI * S.a2 : f.steps * f.hh * 1.5;
  setWorld(N, R, 1, 0, true, opl, f.cam);
  const px = drawProbe(N, R);
  const sc = Math.min(w, h) / span,
    zc = S.field == "gravity" ? 4 : 0,
    X = (z) => w / 2 + (z - zc) * sc,
    Y = (q) => h / 2 - q * sc;
  const obj = worldObjs(f);
  x.fillStyle = "#3a3f4c";
  for (let i = 0; i < obj.length; i += 4) {
    if (obj[i + 3] <= 0) continue;
    x.beginPath();
    x.arc(X(obj[i + 2]), Y(obj[i]), obj[i + 3] * sc, 0, 7);
    x.fillStyle = i == 0 ? "#ffc27a" : "#3a3f4c";
    x.fill();
  }
  for (let k = 0; k < N; k++) {
    x.strokeStyle = k % 2 ? "rgba(143,211,255,.5)" : "rgba(255,214,120,.65)";
    x.beginPath();
    x.moveTo(X(f.cam[2]), Y(f.cam[0]));
    for (let r = 0; r < R; r++) {
      const o = (r * N + k) * 4;
      x.lineTo(X(px[o + 2]), Y(px[o]));
    }
    x.stroke();
  }
  x.fillStyle = "#9a9ca3";
  x.font = "12px 'JetBrains Mono',monospace";
  x.fillText(f.name + ": rays from your position, top view", 20, h - 14);
}
