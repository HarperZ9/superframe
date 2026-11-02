function drawTrainSide() {
  const c = $("over"),
    rr = $("view").getBoundingClientRect();
  const w = (c.width = Math.min(1800, Math.round(rr.width))),
    h = (c.height = Math.min(1200, Math.round(rr.height)));
  const x = c.getContext("2d");
  x.fillStyle = "#05060a";
  x.fillRect(0, 0, w, h);
  const n = TR.s.length;
  const g0 = trainFan(0),
    gf = trainFan(
      TR.obj !== undefined ? TR.objField || 0.1 : ((TR.fieldDeg || 0.1) * Math.PI) / 180
    );
  let z0 = 1e9,
    z1 = -1e9,
    ym = 0;
  for (const s of TR.s) {
    z0 = Math.min(z0, s.z);
    z1 = Math.max(z1, s.z);
    ym = Math.max(ym, Math.abs(s.y) + s.ap);
  }
  const lead = (z1 - z0) * 0.12 + 0.1;
  z0 -= lead;
  z1 += lead * 0.5;
  const sz = (w - 40) / (z1 - z0);
  let sy = TR.p.stretch
    ? Math.min(sz * 12, (h - 90) / (2 * ym))
    : Math.min(sz, (h - 90) / (2 * ym));
  const X = (z) => 20 + (z - z0) * sz,
    Y = (y) => h / 2 + 30 - y * sy;
  const ray = (g, col) => {
    x.strokeStyle = col;
    x.lineWidth = 1;
    for (let k = 0; k < 25; k += 2) {
      x.beginPath();
      const p0 = g(k, 0);
      if (p0[2] < z0) {
        const d = [g(k, 1)[0] - p0[0], g(k, 1)[1] - p0[1], g(k, 1)[2] - p0[2]];
        x.moveTo(X(z0), Y(p0[1] + (d[1] * (z0 - p0[2])) / (d[2] || 1)));
      } else x.moveTo(X(p0[2]), Y(p0[1]));
      let any = false;
      for (let r = 1; r <= n; r++) {
        const q = g(k, r);
        if (q[3] < 0.5) break;
        x.lineTo(X(q[2]), Y(q[1]));
        any = true;
      }
      if (any) x.stroke();
    }
  };
  ray(gf, "rgba(255,160,120,.45)");
  ray(g0, "rgba(255,214,120,.8)");
  x.lineWidth = 1.8;
  TR.s.forEach((s) => {
    x.strokeStyle =
      s.ty == 1 ? "#dfe6f0" : s.ty == 0 ? "#8fd3ff" : s.ty == 2 ? "#ff9d6e" : "#7fd6a4";
    const seg = (a, b) => {
      x.beginPath();
      for (let i = 0; i <= 30; i++) {
        const r = a + ((b - a) * i) / 30,
          sg = sagAt(s, Math.abs(r));
        if (sg == null) continue;
        const lz = sg,
          ly = r,
          cs = Math.cos(s.tilt),
          sn = Math.sin(s.tilt);
        const wy = cs * ly - sn * lz + s.y,
          wz = sn * ly + cs * lz + s.z;
        i ? x.lineTo(X(wz), Y(wy)) : x.moveTo(X(wz), Y(wy));
      }
      x.stroke();
    };
    seg(s.hole, s.ap);
    seg(-s.ap, -s.hole);
  });
  x.fillStyle = "#9a9ca3";
  x.font = "12px 'JetBrains Mono',monospace";
  x.fillText(TR.p.name + (TR.p.stretch ? "  (height stretched)" : ""), 20, h - 14);
}
