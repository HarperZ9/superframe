function drawField(x) {
  const d = S.d,
    net = +S.net || d.nets[0].id;
  const key = net + "|" + S.cutY.toFixed(3);
  if (!S.fs || S.fsKey !== key || S.fsD !== d) {
    setStatus("Solving the field");
    S.fs = fieldSection(d, net, S.cutY);
    S.fsKey = key;
    S.fsD = d;
    S.fsImg = null;
    setStatus("");
  }
  const f = S.fs,
    E2 = extent2D(),
    W = E2[0],
    H = E2[1],
    sc = Math.min((W - 20) / (f.x1 - f.x0), (H - 170) / (f.z1 - f.z0)),
    px0 = (W - (f.x1 - f.x0) * sc) / 2,
    pz0 = (H + 70) / 2 + ((f.z1 - f.z0) * sc) / 2,
    X = (v) => px0 + (v - f.x0) * sc,
    Z = (v) => pz0 - (v - f.z0) * sc;
  if (!S.fsImg) {
    let mx = 0;
    const E = new Float32Array(f.nx * f.nz),
      V = f.V;
    for (let k = 1; k < f.nz - 1; k++)
      for (let i = 1; i < f.nx - 1; i++) {
        const a = k * f.nx + i,
          e = Math.hypot(
            (V[a + 1] - V[a - 1]) / (f.xs[i + 1] - f.xs[i - 1]),
            (V[a + f.nx] - V[a - f.nx]) / (f.zs[k + 1] - f.zs[k - 1])
          );
        E[a] = e;
        if (e > mx) mx = e;
      }
    const c = document.createElement("canvas");
    c.width = f.nx;
    c.height = f.nz;
    const g = c.getContext("2d"),
      im = g.createImageData(f.nx, f.nz);
    for (let k = 0; k < f.nz; k++)
      for (let i = 0; i < f.nx; i++) {
        const a = k * f.nx + i,
          b = (f.nz - 1 - k) * f.nx + i,
          q = Math.round(Math.pow(E[a] / mx, 0.5) * 255) * 3;
        im.data[b * 4] = CMAP[q];
        im.data[b * 4 + 1] = CMAP[q + 1];
        im.data[b * 4 + 2] = CMAP[q + 2];
        im.data[b * 4 + 3] = 255;
      }
    g.putImageData(im, 0, 0);
    S.fsImg = c;
    S.fsMax = mx;
  }
  x.imageSmoothingEnabled = true;
  x.drawImage(S.fsImg, X(f.x0), Z(f.z1), (f.x1 - f.x0) * sc, (f.z1 - f.z0) * sc);
  x.strokeStyle = "rgba(255,255,255,.28)";
  x.lineWidth = 1;
  for (const lv of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    x.beginPath();
    for (let k = 0; k < f.nz - 1; k += 1)
      for (let i = 0; i < f.nx - 1; i += 1) {
        const a = k * f.nx + i,
          v0 = f.V[a],
          v1 = f.V[a + 1],
          v2 = f.V[a + f.nx];
        if ((v0 - lv) * (v1 - lv) < 0) {
          const u = (lv - v0) / (v1 - v0),
            sx = X(f.xs[i] + u * (f.xs[i + 1] - f.xs[i])),
            sz = Z(f.zs[k]);
          x.moveTo(sx - 0.6, sz);
          x.lineTo(sx + 0.6, sz);
        }
        if ((v0 - lv) * (v2 - lv) < 0) {
          const u = (lv - v0) / (v2 - v0),
            sx = X(f.xs[i]),
            sz = Z(f.zs[k] + u * (f.zs[k + 1] - f.zs[k]));
          x.moveTo(sx, sz - 0.6);
          x.lineTo(sx, sz + 0.6);
        }
      }
    x.stroke();
  }
  x.strokeStyle = "rgba(255,255,255,.45)";
  x.lineWidth = 1;
  x.strokeRect(X(f.x0), Z(f.T), (f.x1 - f.x0) * sc, 2 * f.T * sc);
  const lm = f.lm;
  for (let l = 0; l < d.layers; l++) {
    const q = lm[l],
      th = Math.max(2, (q.top - q.bot) * sc);
    const pl = (d.planes || []).find((p) => p.l === l);
    if (pl) {
      const m = planeRaster(d, pl, 0.1);
      x.fillStyle = "#d9a06e";
      for (let s = X(f.x0); s < X(f.x1); s += 1) {
        const xx = f.x0 + (s - X(f.x0)) / sc;
        if (m.mask[m.at(xx, S.cutY)]) x.fillRect(s, Z(q.top), 1.2, th);
      }
    }
    for (const v of f.ivals)
      if (v.l === l) {
        const a = Math.max(v.a, f.x0),
          b = Math.min(v.b, f.x1);
        if (b <= a) continue;
        x.fillStyle = v.net === net ? "#ffe9b0" : "#d9a06e";
        x.fillRect(X(a), Z(q.top), (b - a) * sc, th);
      }
  }
  const T = (s, a, b, sz, al, c) => {
    x.font = sz + 'px "JetBrains Mono",monospace';
    x.textAlign = al || "left";
    x.fillStyle = c || "#e8e6df";
    x.fillText(s, a, b);
  };
  const nm = (d.nets.find((q) => q.id === net) || {}).name;
  T(
    "Net " +
      nm +
      " at 1 V, cut at y = " +
      S.cutY.toFixed(2) +
      " mm" +
      (f.found ? "" : ". This net does not cross this cut, try another net or move the cut."),
    X(f.x0),
    Z(f.z1) - 24,
    13,
    "left",
    f.found ? "#e8e6df" : "#ffc27a"
  );
  T(
    "peak " + fmt(S.fsMax * 1e3, "V/m") + ". Lines: 0.1, 0.25, 0.5, 0.75, 0.9 V",
    X(f.x0),
    Z(f.z1) - 8,
    11,
    "left",
    "#9a9ca3"
  );
  const bar = 1;
  x.fillStyle = "#e8e6df";
  x.fillRect(X(f.x1) - bar * sc, Z(f.z0) + 10, bar * sc, 2);
  T("1 mm", X(f.x1), Z(f.z0) + 26, 12, "right");
}
