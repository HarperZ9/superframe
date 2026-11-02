// ======================================================================= Electrical overlays
function fillNets() {
  const d = S.d,
    n = $("nsel");
  n.textContent = "";
  const opts = d.nets.filter((q) => q.pins.length >= 2);
  for (const q of opts) {
    const o = document.createElement("option");
    o.value = q.id;
    o.textContent = q.name + (q.kind === "power" ? " (power)" : "");
    n.appendChild(o);
  }
  const hasDc = d.dc
      .map((c) => d.nets.find((q) => q.name === c.net))
      .find((q) => q && d.tracks.some((t) => t.net === q.id)),
    sig = opts
      .filter((q) => q.kind === "signal")
      .sort((a, b) => netLen(d, b.id) - netLen(d, a.id))[0];
  S.net = ((S.over === "J" || S.over === "V") && hasDc ? hasDc : sig || opts[0]).id;
  n.value = S.net;
}
function netLen(d, id) {
  let L = 0;
  for (const t of d.tracks) if (t.net === id) L += Math.hypot(t.x2 - t.x1, t.y2 - t.y1);
  return L;
}
function endPins(d, net) {
  const dc = d.dc.find((c) => c.net === net.name);
  if (dc) return { from: dc.from, to: dc.to, I: dc.I };
  const P = net.pins.map(([r, q]) => r + "." + q);
  let from = P[0],
    to = P[1],
    b = -1;
  for (const k of P) {
    const a = d.padMap[P[0]],
      q = d.padMap[k],
      e = Math.hypot(a.x - q.x, a.y - q.y);
    if (e > b) {
      b = e;
      to = k;
    }
  }
  const hdrIdx = P.findIndex((k) => /^J/.test(k));
  if (hdrIdx >= 0 && P[hdrIdx] !== to) {
    from = P[hdrIdx];
  } else if (hdrIdx >= 0) {
    from = P[0];
  }
  return { from, to, I: 0.1 };
}
function paintOver(w, h, fill) {
  const px = new Uint8Array(w * h * 4);
  fill(px);
  uploadData("O", w, h, px);
}
function colorPx(px, a, v, al) {
  const i = Math.round(clamp(v, 0, 1) * 255) * 3;
  px[a] = CMAP[i];
  px[a + 1] = CMAP[i + 1];
  px[a + 2] = CMAP[i + 2];
  px[a + 3] = al;
}
function drawLegend(lo, hi, txt, log) {
  const c = $("legend"),
    x = c.getContext("2d");
  c.hidden = false;
  x.fillStyle = "#05060a";
  x.fillRect(0, 0, 300, 34);
  for (let i = 0; i < 280; i++) {
    const k = Math.round((i / 279) * 255) * 3;
    x.fillStyle = "rgb(" + CMAP[k] + "," + CMAP[k + 1] + "," + CMAP[k + 2] + ")";
    x.fillRect(10 + i, 3, 1, 12);
  }
  x.fillStyle = "#e8e6df";
  x.font = "11px monospace";
  x.textAlign = "left";
  x.fillText(lo, 10, 29);
  x.textAlign = "right";
  x.fillText(hi, 290, 29);
  x.textAlign = "center";
  x.fillText(txt, 150, 29);
}
function updateOverlay() {
  const d = S.d;
  if (!d) return;
  const m = S.over,
    note = $("modeNote"),
    ctl = $("ctl");
  $("legend").hidden = true;
  $("scope").hidden = m !== "signal";
  $("nsel").hidden = !(m === "J" || m === "V" || m === "signal" || m === "E");
  S.playing = false;
  S.mread = null;
  note.textContent = "";
  const net = d.nets.find((q) => q.id === +S.net) || d.nets[0];
  if (m === "J" || m === "V") dcView(d, net, m, note);
  else if (m === "signal") sigView(d, net, note);
  else if (m === "E") planField(d, net, note);
  else if (m === "T") heatView(d, note);
  renderCtl();
  resetAcc();
  renderRead();
}
function dcView(d, net, m, note) {
  const ep = endPins(d, net),
    I = S.Iset && S.IsetNet === net.id ? S.Iset : ep.I;
  const t0 = performance.now();
  const s = dcSolve(d, net.id, I, ep.from, ep.to, 0.05);
  if (!s) {
    note.textContent = "This net has no copper path between its pins.";
    return;
  }
  const r0 = 0.05,
    w = Math.ceil(d.W / r0),
    h = Math.ceil(d.H / r0),
    lg = (v) =>
      m === "J"
        ? clamp(1 + Math.log10(Math.max(v, 1e-12) / s.Jmax) / 2.5, 0, 1)
        : v / (s.Vmax || 1);
  paintOver(w, h, (px) => {
    const best = new Float32Array(w * h).fill(-1);
    for (let c = 0; c < s.n; c++) {
      const q = s.cells[c],
        r = s.layerRes[q.l],
        k = Math.round(r / r0),
        val = m === "J" ? s.J[c] : s.V[c];
      for (let y = 0; y < k; y++)
        for (let x = 0; x < k; x++) {
          const X = q.i * k + x,
            Y = q.j * k + y;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const a = Y * w + X;
          if (val > best[a]) {
            best[a] = val;
            colorPx(px, a * 4, lg(val), 255);
          }
        }
    }
  });
  if (m === "J") drawLegend("-50 dB", fmt(s.Jmax, "A/mm2"), "log scale");
  else drawLegend("0", fmt(s.Vmax, "V"), "above " + ep.to);
  S.mread = [
    ["Net", net.name + ", " + ep.from + " to " + ep.to],
    ["Current", fmt(I, "A")],
    ["Resistance", fmt(s.R, "Ohm")],
    ["Voltage drop", fmt(s.Vdrop, "V")],
    ["Peak density", fmt(s.Jmax, "A/mm2")],
    ["Power in copper", fmt(s.P, "W")],
    [
      "Solve",
      s.n + " cells, " + s.it + " iterations, " + (performance.now() - t0).toFixed(0) + " ms",
    ],
  ];
  note.textContent =
    "Sheet conduction at 50 um per cell on tracks and 200 um on planes, with vias as lumped barrels. Copper at 20 C; no temperature rise is fed back.";
}
function planField(d, net, note) {
  const res = Math.max(0.15, Math.max(d.W, d.H) / 260),
    nx = Math.ceil(d.W / res),
    ny = Math.ceil(d.H / res),
    n = nx * ny,
    fx = new Int8Array(n),
    h = d.layers === 4 ? d.stack.diel[0] : d.stack.diel[0];
  const lay = d.layers === 4 ? [0, 3] : [0, 1];
  for (const l of lay)
    for (const p of prims(d, l)) {
      if (p.net !== net.id) continue;
      rasterPrim(p, res, (i, j) => {
        if (i >= 0 && j >= 0 && i < nx && j < ny) fx[j * nx + i] = 1;
      });
    }
  const ea = [],
    eb = [],
    eg = [],
    g = 1 / (res * res),
    diag = new Float64Array(n).fill(1 / (h * h)),
    rhs = new Float64Array(n);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * nx + i;
      if (fx[a]) {
        diag[a] = 1;
        rhs[a] = 1;
        continue;
      }
      if (i < nx - 1) {
        const b = a + 1;
        if (fx[b]) {
          diag[a] += g;
          rhs[a] += g;
        } else {
          ea.push(a);
          eb.push(b);
          eg.push(g);
        }
      }
      if (j < ny - 1) {
        const b = a + nx;
        if (fx[b]) {
          diag[a] += g;
          rhs[a] += g;
        } else {
          ea.push(a);
          eb.push(b);
          eg.push(g);
        }
      }
      if (i > 0 && fx[a - 1]) {
        diag[a] += g;
        rhs[a] += g;
      }
      if (j > 0 && fx[a - nx]) {
        diag[a] += g;
        rhs[a] += g;
      }
    }
  const s = pcg(
      n,
      Int32Array.from(ea),
      Int32Array.from(eb),
      Float64Array.from(eg),
      diag,
      rhs,
      1e-6,
      400
    ),
    V = s.x;
  paintOver(nx, ny, (px) => {
    for (let a = 0; a < n; a++) {
      const v = V[a];
      colorPx(px, a * 4, Math.sqrt(clamp(v, 0, 1)), v > 0.004 ? 255 : 0);
    }
  });
  drawLegend("0", fmt(1 / (h * 1e-3), "V/m"), "at 1 V, square root scale");
  S.mread = [
    ["Net", net.name],
    ["Spacing to plane", fmt(h * 1e-3, "m")],
    ["Field under trace at 1 V", fmt(1 / (h * 1e-3), "V/m")],
  ];
  note.textContent =
    "Plan view: a screened estimate of the field between the net and the next layer, decaying over one dielectric height. The Field cut tab holds the solved Laplace field at a real cut.";
}