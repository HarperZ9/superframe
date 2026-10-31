// ======================================================================= Diagrams
// Visual approach taken by transformation from the saved telescope chart and instrument panels: filled beam envelopes, solid mirror backing, labelled surfaces, analysis panels. The figures are drawn from this page's own rays.
function panel(x, X, Y, W_, H_, title) {
  x.fillStyle = "#0a0c12";
  x.fillRect(X, Y, W_, H_);
  x.strokeStyle = "#262b36";
  x.strokeRect(X + 0.5, Y + 0.5, W_ - 1, H_ - 1);
  x.fillStyle = "#c9c8c2";
  x.font = "600 12px 'Hanken Grotesk',sans-serif";
  x.fillText(title, X + 8, Y + 15);
}
function plot(x, X, Y, W_, H_, xs, ys, col, xl, yl, xm, ym) {
  const m = [34, 16, 14, 26];
  const px = X + m[0],
    py = Y + m[3],
    pw = W_ - m[0] - m[1],
    ph = H_ - m[2] - m[3] - 10;
  x.strokeStyle = "#262b36";
  x.strokeRect(px, py, pw, ph);
  const xa = xm ? xm[0] : Math.min(...xs),
    xb = xm ? xm[1] : Math.max(...xs),
    ya = ym ? ym[0] : Math.min(...ys),
    yb = ym ? ym[1] : Math.max(...ys);
  x.strokeStyle = col;
  x.lineWidth = 1.6;
  x.beginPath();
  xs.forEach((v, i) => {
    const a = px + ((v - xa) / (xb - xa || 1)) * pw,
      b = py + ph - ((ys[i] - ya) / (yb - ya || 1)) * ph;
    i ? x.lineTo(a, b) : x.moveTo(a, b);
  });
  x.stroke();
  x.lineWidth = 1;
  x.fillStyle = "#9a9ca3";
  x.font = "10px 'JetBrains Mono',monospace";
  if (xl) x.fillText(xl, px, py + ph + 11);
  if (yl) x.fillText(yl, X + 4, py + 8);
  return { ya, yb, xa, xb };
}
function drawDiagram() {
  const c = $("over"),
    rr = $("view").getBoundingClientRect();
  const w = (c.width = Math.round(rr.width * Math.min(2, devicePixelRatio || 1))),
    h = (c.height = Math.round(rr.height * Math.min(2, devicePixelRatio || 1)));
  let x = c.getContext("2d");
  x.fillStyle = "#05060a";
  x.fillRect(0, 0, w, h);
  if (S.kind == "world") {
    drawWorldSide();
    return;
  }
  const k = w / rr.width;
  x.setTransform(k, 0, 0, k, 0, 0);
  const W0 = rr.width,
    H0 = rr.height - 72;
  x.translate(0, 72);
  if (S.kind == "lens") {
    const g = lensProbe(S);
    drawLensDiagram(x, W0, H0, g);
    return;
  }
  const cols = W0 > H0 * 1.1 ? 3 : 2,
    rowsN = cols == 3 ? 2 : 3,
    cw = W0 / cols,
    ch = H0 / rowsN;
  const P = (i) => [(i % cols) * cw + 2, Math.floor(i / cols) * ch + 2, cw - 4, ch - 4];
  // 1 section with envelopes and labels
  const n = TR.s.length,
    g0 = trainFan(0);
  {
    const [X, Y, W_, H_] = P(0);
    panel(x, X, Y, W_ * (cols == 3 ? 1 : 1), H_, "Cross-section: " + TR.p.name);
    sectionInto(x, X, Y + 18, W_, H_ - 20, g0, false);
  }
  {
    const [X, Y, W_, H_] = P(1);
    panel(x, X, Y, W_, H_, "Exploded: same surfaces, pulled apart");
    sectionInto(x, X, Y + 18, W_, H_ - 20, g0, true);
  }
  // 2 ray fan: transverse error against pupil
  {
    const [X, Y, W_, H_] = P(2);
    panel(x, X, Y, W_, H_, "Ray fan: miss at image against pupil height");
    const xs = [],
      ys = [];
    let c0 = null;
    for (let k = 0; k < 25; k++) {
      const q = g0(k, n);
      if (q[3] < 0.5) continue;
      const ty = TR.s[n - 1];
      const v = Math.cos(ty.tilt) * (q[1] - ty.y) + Math.sin(ty.tilt) * (q[2] - ty.z);
      xs.push((k - 12) / 12);
      ys.push(v);
    }
    const m = Math.max(1e-7, ...ys.map(Math.abs));
    if (xs.length)
      plot(
        x,
        X,
        Y,
        W_,
        H_,
        xs,
        ys,
        "#ffd678",
        "pupil height",
        "±" + m.toExponential(1),
        [-1, 1],
        [-m, m]
      );
  }
  // 3 MTF: geometric, from the spot's Fourier transform along y.
  const fd = TR.obj !== undefined ? TR.objField || 0.1 : ((TR.fieldDeg || 0.1) * Math.PI) / 180;
  const spots = [0, 0.7, 1].map((f) => spotStats(trainSpot(f * fd, 64), 64));
  {
    const [X, Y, W_, H_] = P(3);
    panel(x, X, Y, W_, H_, "Geometric MTF from the spot, with the diffraction limit");
    const fn = Math.abs((last.train && last.train.fnum) || 10),
      lam = 0.55e-6 / (TR.unitM || 1),
      fc = 1 / (lam * Math.max(fn, 0.3));
    const fs = [];
    for (let i = 0; i <= 40; i++) fs.push((i / 40) * fc);
    const lim = fs.map((v) => {
      const u = Math.min(1, v / fc);
      return (2 / Math.PI) * (Math.acos(u) - u * Math.sqrt(1 - u * u));
    });
    plot(
      x,
      X,
      Y,
      W_,
      H_,
      fs,
      lim,
      "#555a68",
      "cycles per unit to " + fc.toExponential(1),
      "1",
      [0, fc],
      [0, 1]
    );
    ["#8fd3ff", "#ffd678", "#ff9d6e"].forEach((col, si) => {
      const s = spots[si];
      if (!s.n) return;
      const m = fs.map((f) => {
        let a = 0,
          b = 0;
        for (const p of s.pts) {
          const t = 2 * Math.PI * f * (p[1] - s.my);
          a += Math.cos(t);
          b += Math.sin(t);
        }
        const lm = lim[fs.indexOf(f)];
        return (Math.hypot(a, b) / s.n) * lm;
      });
      plot(x, X, Y, W_, H_, fs, m, col, null, null, [0, fc], [0, 1]);
    });
  }
  // 4 spot matrix: field against colour
  {
    const [X, Y, W_, H_] = P(4);
    panel(x, X, Y, W_, H_, "Colour study: spots by field and wavelength");
    const lams = [
        [0.656, "#ff6a5a"],
        [0.588, "#ffd678"],
        [0.486, "#6aa9ff"],
      ],
      fields = [0, 0.7, 1],
      cs = Math.min((W_ - 20) / 3, (H_ - 30) / 3);
    let lo = [];
    for (let fi = 0; fi < 3; fi++)
      for (let li = 0; li < 3; li++) {
        const prevLam = S.lam;
        const sp = spotAt(fields[fi] * fd, lams[li][0]);
        const cx0 = X + 10 + cs * fi + cs / 2,
          cy0 = Y + 24 + cs * li + cs / 2;
        x.strokeStyle = "#1b1f28";
        x.strokeRect(cx0 - cs / 2, cy0 - cs / 2, cs, cs);
        lo.push(sp);
        sp._c = [cx0, cy0, lams[li][1]];
      }
    const mxr = Math.max(
      ...lo.map((l) => (l.n ? l.max + Math.hypot(l.mx - lo[0].mx, 0) * 0 : 0)),
      1e-9
    );
    for (const l of lo) {
      if (!l.n) continue;
      x.fillStyle = l._c[2];
      for (const p of l.pts) {
        x.fillRect(
          l._c[0] + ((p[0] - l.mx) / mxr) * cs * 0.45,
          l._c[1] - ((p[1] - l.my) / mxr) * cs * 0.45,
          1,
          1
        );
      }
    }
    x.fillStyle = "#9a9ca3";
    x.font = "10px 'JetBrains Mono',monospace";
    x.fillText("frame ±" + mxr.toExponential(1) + "; field grows to the right", X + 10, Y + H_ - 5);
  }
  // 5 field curvature: best focus shift across field, measured
  {
    const [X, Y, W_, H_] = P(5);
    panel(x, X, Y, W_, H_, "Field curvature: best focus shift against field");
    const xs = [],
      ys = [];
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      const r = focusShift(f * fd);
      if (r != null) {
        xs.push(f);
        ys.push(r);
      }
    }
    const m = Math.max(1e-6, ...ys.map(Math.abs));
    if (xs.length > 1)
      plot(
        x,
        X,
        Y,
        W_,
        H_,
        xs,
        ys,
        "#7fd6a4",
        "field fraction",
        "±" + m.toExponential(1),
        [0, 1],
        [-m, m]
      );
  }
}
