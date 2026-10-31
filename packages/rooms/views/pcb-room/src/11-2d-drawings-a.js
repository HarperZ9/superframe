// ======================================================================= 2D drawings
const O2 = () => {
  const c = $("over"),
    r = c.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2),
    w = Math.round(r.width * dpr),
    h = Math.round(r.height * dpr);
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return { c, x: c.getContext("2d"), w, h, dpr };
};
function fit2D() {
  const { w, h, dpr } = O2(),
    e = extent2D();
  if (S.view === "field") {
    S.view2 = { s: dpr, x: 0, y: 0 };
    return;
  }
  const top = S.view === "field" ? 0 : Math.min(90, h * 0.1) * Math.min(devicePixelRatio || 1, 2),
    s = Math.min(w / e[0], (h - top) / e[1]) * 0.96;
  S.view2 = { s, x: (w - e[0] * s) / 2, y: top + (h - top - e[1] * s) / 2 };
}
function extent2D() {
  const d = S.d;
  if (S.view === "schem") {
    const q = schem();
    return [q.W, q.H];
  }
  if (S.view === "field") {
    const { w, h, dpr } = O2();
    return [w / dpr, h / dpr];
  }
  if (S.view === "blue") {
    const { w, h } = O2();
    S.blueTall = h > w * 0.9;
    return S.blueTall ? [d.W + 10, d.H + 36] : [d.W + 36, d.H + 18];
  }
  return [1, 1];
}
function schem() {
  if (!S.d._sch) S.d._sch = schematic(S.d);
  return S.d._sch;
}
function draw2D() {
  const { x, w, h } = O2();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = S.view === "field" ? "#05060a" : "#07101c";
  x.fillRect(0, 0, w, h);
  if (!S.d) return;
  const v = S.view2;
  x.setTransform(v.s, 0, 0, v.s, v.x, v.y);
  if (S.view === "schem") drawSchem(x);
  else if (S.view === "blue") drawBlue(x);
  else if (S.view === "field") drawField(x);
}
function drawSchem(x) {
  const q = schem(),
    I = "#cfe3f7",
    D = "#6d8bab";
  x.lineCap = "round";
  x.lineJoin = "round";
  x.strokeStyle = "#142338";
  x.lineWidth = 0.04;
  for (let i = 0; i <= q.W; i += 5) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, q.H);
    x.stroke();
  }
  for (let j = 0; j <= q.H; j += 5) {
    x.beginPath();
    x.moveTo(0, j);
    x.lineTo(q.W, j);
    x.stroke();
  }
  x.strokeStyle = "#39597c";
  x.lineWidth = 0.15;
  x.strokeRect(0.5, 0.5, q.W - 1, q.H - 1);
  x.strokeStyle = "#8fd3ff";
  x.lineWidth = 0.16;
  for (const w of q.wires) {
    x.beginPath();
    w.pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.stroke();
  }
  x.fillStyle = "#8fd3ff";
  for (const p of q.dots) {
    x.beginPath();
    x.arc(p[0], p[1], 0.38, 0, 6.3);
    x.fill();
  }
  const T = (s, a, b, sz, al, col) => {
    x.font = sz + 'px "JetBrains Mono",monospace';
    x.textAlign = al || "center";
    x.fillStyle = col || I;
    x.fillText(s, a, b);
  };
  for (const s of q.syms) {
    const a = s.x,
      b = s.y;
    x.strokeStyle = I;
    x.lineWidth = 0.17;
    for (const p of s.pins) {
      x.beginPath();
      x.moveTo(p.x, p.y);
      const ed =
        s.kind === "amp"
          ? p.side === "l"
            ? [a - 3, p.y]
            : p.side === "r"
              ? [a + 3.2, p.y]
              : p.side === "t"
                ? [p.x, b - 2]
                : [p.x, b + 2]
          : s.kind === "conn"
            ? [s.box[p.side === "l" ? 0 : 2], p.y]
            : [p.side === "l" ? a - 2.2 : a + 2.2, p.y];
      x.lineTo(ed[0], ed[1]);
      x.stroke();
    }
    x.beginPath();
    if (s.kind === "res") {
      x.rect(a - 2.2, b - 0.8, 4.4, 1.6);
      x.stroke();
    } else if (s.kind === "cap") {
      x.moveTo(a - 2.2, b);
      x.lineTo(a - 0.4, b);
      x.moveTo(a + 0.4, b);
      x.lineTo(a + 2.2, b);
      x.moveTo(a - 0.4, b - 1.5);
      x.lineTo(a - 0.4, b + 1.5);
      x.moveTo(a + 0.4, b - 1.5);
      x.lineTo(a + 0.4, b + 1.5);
      x.stroke();
    } else if (s.kind === "diode") {
      x.moveTo(a - 2.2, b);
      x.lineTo(a - 1, b);
      x.moveTo(a + 1, b);
      x.lineTo(a + 2.2, b);
      x.moveTo(a + 1, b - 1.2);
      x.lineTo(a - 1, b);
      x.lineTo(a + 1, b + 1.2);
      x.closePath();
      x.moveTo(a - 1, b - 1.2);
      x.lineTo(a - 1, b + 1.2);
      x.moveTo(0.0 + a - 2.8, b - 3.2);
      x.lineTo(a - 1.3, b - 1.7);
      x.moveTo(a - 1.5, b - 3.4);
      x.lineTo(a, b - 1.9);
      x.stroke();
    } else if (s.kind === "amp") {
      x.moveTo(a - 3, b - 3.8);
      x.lineTo(a + 3.4, b);
      x.lineTo(a - 3, b + 3.8);
      x.closePath();
      x.stroke();
      T("+", a - 2, b + 2.4, 1.4);
      T("-", a - 2, b - 1.6, 1.4);
    } else {
      x.rect(s.box[0], s.box[1], s.box[2] - s.box[0], s.box[3] - s.box[1]);
      x.stroke();
      for (const p of s.pins) T(p.pin, (s.box[0] + s.box[2]) / 2, p.y + 0.4, 1, "center", D);
    }
    T(
      s.ref,
      s.kind === "amp" ? a + 4.6 : a,
      s.kind === "amp" ? b - 3 : s.kind === "conn" ? s.box[1] - 0.9 : b + 3.4,
      1.25
    );
    if (s.value)
      T(
        s.value,
        a,
        s.kind === "amp" ? b + 6.6 : s.kind === "conn" ? s.box[3] + 1.5 : b + 4.9,
        1.0,
        "center",
        D
      );
  }
  for (const l of q.labels) {
    x.strokeStyle = I;
    x.lineWidth = 0.17;
    const a = l.x,
      b = l.y;
    if (l.kind === "gnd") {
      x.beginPath();
      x.moveTo(a - 1, b);
      x.lineTo(a + 1, b);
      x.moveTo(a - 0.65, b + 0.4);
      x.lineTo(a + 0.65, b + 0.4);
      x.moveTo(a - 0.3, b + 0.8);
      x.lineTo(a + 0.3, b + 0.8);
      x.stroke();
    } else if (l.kind === "rail") {
      x.beginPath();
      x.moveTo(a - 1, b);
      x.lineTo(a + 1, b);
      x.stroke();
      T(l.text, a, l.side === "b" ? b + 1.4 : b - 0.5, 1, "center", "#ffc27a");
    } else
      T(
        l.text,
        l.side === "l" ? a - 0.3 : a + 0.3,
        b + 0.3,
        0.9,
        l.side === "l" ? "right" : "left",
        "#8fd3ff"
      );
  }
  const d = S.d;
  T(d.title + "   schematic   generated, unbuilt", q.W - 1.5, q.H - 1.3, 1.1, "right", D);
}
function drawBlue(x) {
  const d = S.d,
    tall = S.blueTall,
    ox = tall ? 6 : 7,
    oy = 7,
    X = (v) => ox + v,
    Y = (v) => oy + d.H - v,
    lz = layerZ(d.layers),
    L = S.blueL || (S.blueL = [true, true, true, true]);
  const col = ["#ff6b5e", "#67d67f", "#c79bff", "#6aa8ff"];
  x.lineCap = "round";
  x.lineJoin = "round";
  x.fillStyle = "#0b1727";
  x.fillRect(X(0), Y(d.H), d.W, d.H);
  x.globalAlpha = 0.42;
  for (let l = d.layers - 1; l >= 0; l--) {
    const pl = (d.planes || []).find((p) => p.l === l);
    if (!pl || !L[l]) continue;
    x.fillStyle = col[l];
    x.globalAlpha = 0.1;
    x.fillRect(
      X(DES.planeInset),
      Y(d.H - DES.planeInset),
      d.W - 2 * DES.planeInset,
      d.H - 2 * DES.planeInset
    );
    x.globalAlpha = 0.42;
  }
  x.globalAlpha = 0.9;
  for (let l = d.layers - 1; l >= 0; l--) {
    if (!L[l] || (d.layers === 4 && (l === 1 || l === 2))) continue;
    x.strokeStyle = x.fillStyle = col[l];
    for (const t of d.tracks)
      if (t.l === l) {
        x.lineWidth = t.w;
        x.beginPath();
        x.moveTo(X(t.x1), Y(t.y1));
        x.lineTo(X(t.x2), Y(t.y2));
        x.stroke();
      }
    if (l === 0)
      for (const p of d.parts)
        for (const q of p.pads) if (!q.th) x.fillRect(X(q.x - q.w / 2), Y(q.y + q.h / 2), q.w, q.h);
  }
  x.fillStyle = "#e8c97a";
  for (const p of d.parts)
    for (const q of p.pads)
      if (q.th) {
        x.beginPath();
        x.arc(X(q.x), Y(q.y), q.w / 2, 0, 6.3);
        x.fill();
      }
  for (const v of d.vias) {
    x.beginPath();
    x.arc(X(v.x), Y(v.y), v.pad / 2, 0, 6.3);
    x.fill();
  }
  x.fillStyle = "#07101c";
  for (const v of d.vias) {
    x.beginPath();
    x.arc(X(v.x), Y(v.y), v.d / 2, 0, 6.3);
    x.fill();
  }
  for (const p of d.parts)
    for (const q of p.pads)
      if (q.th) {
        x.beginPath();
        x.arc(X(q.x), Y(q.y), q.drill / 2, 0, 6.3);
        x.fill();
      }
  for (const h of d.holes) {
    x.beginPath();
    x.arc(X(h.x), Y(h.y), h.d / 2, 0, 6.3);
    x.fill();
    x.strokeStyle = "#cfe3f7";
    x.lineWidth = 0.08;
    x.stroke();
  }
  x.strokeStyle = "#dfe9f5";
  x.lineWidth = 0.1;
  for (const s of silkLines(d)) {
    x.beginPath();
    x.moveTo(X(s[0]), Y(s[1]));
    x.lineTo(X(s[2]), Y(s[3]));
    x.stroke();
  }
  x.lineWidth = 0.16;
  x.strokeStyle = "#cfe3f7";
  x.strokeRect(X(0), Y(d.H), d.W, d.H);
  const T = (s, a, b, sz, al, c) => {
    x.font = sz + 'px "JetBrains Mono",monospace';
    x.textAlign = al || "left";
    x.fillStyle = c || "#cfe3f7";
    x.fillText(s, a, b);
  };
  x.strokeStyle = "#6d8bab";
  x.lineWidth = 0.08;
  const dimH = (y) => {
    x.beginPath();
    x.moveTo(X(0), y);
    x.lineTo(X(d.W), y);
    x.moveTo(X(0), Y(0));
    x.lineTo(X(0), y - 0.6);
    x.moveTo(X(d.W), Y(0));
    x.lineTo(X(d.W), y - 0.6);
    x.stroke();
    T(d.W.toFixed(2) + " mm", X(d.W / 2), y - 0.5, 1.3, "center");
  };
  dimH(oy + d.H + 3);
  x.beginPath();
  x.moveTo(X(-3), Y(0));
  x.lineTo(X(-3), Y(d.H));
  x.moveTo(X(0), Y(0));
  x.lineTo(X(-3.6), Y(0));
  x.moveTo(X(0), Y(d.H));
  x.lineTo(X(-3.6), Y(d.H));
  x.stroke();
  T(d.H.toFixed(2), X(-3.4), Y(d.H / 2), 1.3, "right");
  const sizes = {};
  const addS = (k, pl) => {
    const q = k.toFixed(3) + (pl ? " plated" : " free");
    sizes[q] = (sizes[q] || 0) + 1;
  };
  for (const v of d.vias) addS(v.d, 1);
  for (const p of d.parts) for (const q of p.pads) if (q.th) addS(q.drill, 1);
  for (const h of d.holes) addS(h.d, 0);
  T(d.title, X(0), 2.2, 1.8, "left");
  T(
    d.rules.name + " class. Unbuilt, needs a fabricator check.",
    X(0),
    4.4,
    1.05,
    "left",
    "#ffc27a"
  );
  const c2 = tall ? X(0) : X(d.W + 2);
  let u = tall ? oy + d.H + 9.5 : oy + 0.6;
  T("Stack", c2, u, 1.3);
  u += 1.9;
  d.stack.cu.forEach((t, i) => {
    x.fillStyle = col[i];
    x.fillRect(c2, u - 0.9, 1.2, 0.9);
    T(
      "L" +
        (i + 1) +
        " " +
        (t * 1e3).toFixed(1) +
        " um" +
        ((d.planes || []).some((p) => p.l === i) ? " plane" : ""),
      c2 + 1.7,
      u,
      1.1
    );
    u += 1.5;
    if (i < d.layers - 1) {
      T(d.stack.mat + " " + d.stack.diel[i].toFixed(3) + " mm", c2 + 1.7, u, 1, "left", "#6d8bab");
      u += 1.5;
    }
  });
  T("er " + d.stack.er + "   total " + lz.total.toFixed(3) + " mm", c2, u, 1, "left", "#6d8bab");
  const c3 = tall ? X(d.W * 0.55) : c2,
    u0 = tall ? oy + d.H + 9.5 : u + 2.6;
  u = u0;
  T("Drill", c3, u, 1.3);
  u += 1.8;
  for (const k of Object.keys(sizes).sort()) {
    T(sizes[k] + " x " + k, c3, u, 1.05);
    u += 1.4;
  }
  x.textAlign = "left";
  const lg = oy + d.H + 6.2;
  let lx = X(0);
  d.stack.cu.forEach((_, i) => {
    x.fillStyle = col[i];
    x.fillRect(lx, lg - 0.9, 1.2, 0.9);
    T("L" + (i + 1), lx + 1.6, lg, 1.1);
    lx += 6;
  });
}