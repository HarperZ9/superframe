function sectionInto(x, X, Y, W_, H_, g, exploded) {
  const n = TR.s.length;
  let z0 = 1e9,
    z1 = -1e9,
    ym = 0;
  const off = (i) =>
    exploded
      ? (i * (Math.max(...TR.s.map((s) => s.z)) - Math.min(...TR.s.map((s) => s.z)) || 1) * 0.35) /
        Math.max(n - 1, 1)
      : 0;
  TR.s.forEach((s, i) => {
    const z = s.z + off(i);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
    ym = Math.max(ym, Math.abs(s.y) + s.ap);
  });
  const lead = (z1 - z0) * 0.1 + 0.05;
  z0 -= lead;
  z1 += lead;
  const sz = (W_ - 16) / (z1 - z0),
    sy = TR.p.stretch ? (H_ - 40) / (2 * ym) : Math.min(sz, (H_ - 40) / (2 * ym));
  const PX = (z) => X + 8 + (z - z0) * sz,
    PY = (y) => Y + H_ / 2 - y * sy;
  x.save();
  x.beginPath();
  x.rect(X, Y, W_, H_);
  x.clip();
  if (!exploded) {
    // filled beam: polygon between the two marginal rays, surface by surface
    const hi = 24,
      lo = 0;
    for (let r = 0; r < n; r++) {
      const a = g(hi, r),
        b = g(hi, r + 1),
        c = g(lo, r + 1),
        d = g(lo, r);
      if (a[3] < 0.5 || b[3] < 0.5 || c[3] < 0.5 || d[3] < 0.5) continue;
      x.fillStyle = "rgba(255,214,120,.12)";
      x.beginPath();
      x.moveTo(PX(Math.max(a[2], z0)), PY(a[1]));
      x.lineTo(PX(b[2]), PY(b[1]));
      x.lineTo(PX(c[2]), PY(c[1]));
      x.lineTo(PX(Math.max(d[2], z0)), PY(d[1]));
      x.fill();
    }
    x.strokeStyle = "rgba(255,214,120,.55)";
    for (let k = 0; k < 25; k += 3) {
      x.beginPath();
      let st = false;
      for (let r = 0; r <= n; r++) {
        const q = g(k, r);
        if (q[3] < 0.5) break;
        const zz = Math.max(q[2], z0);
        st ? x.lineTo(PX(zz), PY(q[1])) : x.moveTo(PX(zz), PY(q[1]));
        st = true;
      }
      x.stroke();
    }
  }
  TR.s.forEach((s, i) => {
    const col = s.ty == 1 ? "#dfe6f0" : s.ty == 0 ? "#8fd3ff" : s.ty == 2 ? "#ff9d6e" : "#7fd6a4";
    x.strokeStyle = col;
    const seg = (a, b, back) => {
      x.beginPath();
      for (let k = 0; k <= 24; k++) {
        const r = a + ((b - a) * k) / 24,
          sg = sagAt(s, Math.abs(r));
        if (sg == null) continue;
        const cs = Math.cos(s.tilt),
          sn = Math.sin(s.tilt),
          wy = cs * r - sn * sg + s.y,
          wz = sn * r + cs * sg + s.z + off(i);
        k ? x.lineTo(PX(wz), PY(wy)) : x.moveTo(PX(wz), PY(wy));
      }
      x.lineWidth = s.ty == 1 ? 4 : 1.6;
      x.stroke();
      x.lineWidth = 1;
    };
    seg(s.hole, s.ap);
    seg(-s.ap, -s.hole);
    x.fillStyle = col;
    x.font = "10px 'JetBrains Mono',monospace";
    x.fillText(
      String(i + 1) + (s.name ? " " + s.name : ""),
      PX(s.z + off(i)) + 2,
      PY(s.y + s.ap) - 3 - (i % 2) * 10
    );
  });
  x.restore();
}
