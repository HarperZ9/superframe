function jouleSources(d) {
  if (S.joule) return S.joule;
  const src = [];
  for (const c of d.dc) {
    const net = d.nets.find((q) => q.name === c.net);
    if (!net) continue;
    const s = dcSolve(d, net.id, c.I, c.from, c.to, 0.1);
    if (!s) continue;
    let tot = 0;
    const per = new Float64Array(s.n);
    for (let k = 0; k < s.n; k++) {
      per[k] = s.J[k] * s.J[k];
      tot += per[k];
    }
    if (tot <= 0) continue;
    for (let k = 0; k < s.n; k += 1) {
      const q = s.cells[k],
        r = s.layerRes[q.l],
        P = (s.P * per[k]) / tot;
      if (P > 1e-7) src.push([q.i * r, q.j * r, (q.i + 0.9) * r, (q.j + 0.9) * r, P]);
    }
  }
  S.joule = src;
  return src;
}
function heatView(d, note) {
  const s = thermalSolve(d, { h: S.hconv || 10, sources: jouleSources(d) });
  let tmin = 1e9;
  for (let a = 0; a < s.nx * s.ny; a++) if (s.T[a] < tmin) tmin = s.T[a];
  paintOver(s.nx, s.ny, (px) => {
    for (let a = 0; a < s.nx * s.ny; a++)
      colorPx(px, a * 4, s.max > tmin ? (s.T[a] - tmin) / (s.max - tmin) : 0, 245);
  });
  drawLegend("+" + tmin.toFixed(2) + " K", "+" + s.max.toFixed(2) + " K", "rise above ambient");
  S.mread = [
    ["Power on the board", fmt(s.Q, "W")],
    ["Peak rise", s.max.toFixed(3) + " K"],
    ["Mean rise", s.mean.toFixed(3) + " K"],
    ["Heat lost / power in", s.Q > 0 ? (s.balance / s.Q).toFixed(4) : "n/a"],
    ["Face coefficient h", (S.hconv || 10) + " W/m2K"],
    ["Solve", s.nx * s.ny + " cells, " + s.it + " iterations"],
  ];
  note.textContent =
    s.Q > 0
      ? "Fin equation on the board: in-plane spreading through FR4 and copper, h on both faces. Part powers come from the netlist, copper power from the DC solve. h is a typical still-air value, assumed. No part-to-board thermal resistance, so these are board temperatures."
      : "This netlist declares no dissipated power.";
}
function sigView(d, net, note) {
  const ep = endPins(d, net);
  if (!d.tracks.some((t) => t.net === net.id)) {
    note.textContent = "This net is a plane here, so it has no trace to drive. Choose another net.";
    return;
  }
  const tl = buildNetLine(d, net.id, ep.from, ep.to, {
    Rs: S.Rs,
    RL: S.RL >= 1000 ? 0 : S.RL,
    tr: S.tr * 1e-12,
    CL: 0,
    Cpin: 1e-12,
  });
  S.tl = tl;
  S.hist = [];
  freeVAO(S.rib);
  S.rib = makeVAO(ribbonMesh(d, tl));
  let flight = 0;
  const zs = {};
  for (const q of tl.seg) {
    flight += (q.len * 1e-3) / q.v;
    const k = q.z.toFixed(1);
    zs[k] = (zs[k] || 0) + q.len;
  }
  const zl = Object.keys(zs),
    tot = Math.max(4 * flight, 1.6e-9 + S.tr * 1e-12 * 2);
  S.tTot = tot;
  const main = zl.sort((a, b) => zs[b] - zs[a])[0],
    Zm = +main,
    GL = S.RL >= 1000 ? 1 : (S.RL - Zm) / (S.RL + Zm),
    GS = (S.Rs - Zm) / (S.Rs + Zm);
  S.mread = [
    ["Net", net.name + ", " + ep.from + " to " + ep.to],
    ["Z0 by width", zl.map((k) => k + " ohm, " + zs[k].toFixed(1) + " mm").join("; ")],
    ["Flight time", fmt(flight, "s")],
    ["Gamma at load", GL.toFixed(3)],
    ["Gamma at driver", GS.toFixed(3)],
    ["Vias on this net", String(d.vias.filter((v) => v.net === net.id).length)],
  ];
  note.textContent =
    "Telegrapher lines on the routed tree, with Z0 and velocity from the field solver, series copper resistance, 1 pF at other pins. Vias are treated as a joined node with no added inductance; dielectric loss and skin effect are left out. Copper is shown on one plane, so bottom-side tracks appear on the top.";
  S.sigV = new Uint8Array(tl.N * 4);
  S.playing = !RM;
  if (RM) seekSignal(0.5);
  else colorSignal();
  drawScope();
}
function colorSignal() {
  const tl = S.tl;
  if (!tl) return;
  for (let i = 0; i < tl.N; i++) {
    const c = DIV(0.5 + tl.V[i] * 0.75);
    S.sigV[i * 4] = c[0];
    S.sigV[i * 4 + 1] = c[1];
    S.sigV[i * 4 + 2] = c[2];
    S.sigV[i * 4 + 3] = 255;
  }
  uploadData("O", tl.N, 1, S.sigV);
  S.samples = 0;
}
function stepSignal(frac) {
  const tl = S.tl,
    target = frac * S.tTot;
  let n = 0;
  while (tl.t < target && n < 20000) {
    tl.step();
    n++;
    if (n % 6 === 0) S.hist.push([tl.t, tl.V[tl.srcN], tl.V[tl.load]]);
  }
}
function seekSignal(f) {
  const d = S.d,
    net = d.nets.find((q) => q.id === +S.net);
  if (!S.tl) return;
  if (S.tl.t > f * S.tTot) {
    const ep = endPins(d, net);
    S.tl = buildNetLine(d, net.id, ep.from, ep.to, {
      Rs: S.Rs,
      RL: S.RL >= 1000 ? 0 : S.RL,
      tr: S.tr * 1e-12,
      CL: 0,
      Cpin: 1e-12,
    });
    S.hist = [];
  }
  stepSignal(f);
  colorSignal();
  drawScope();
}
function drawScope() {
  const c = $("scope"),
    x = c.getContext("2d"),
    W = 300,
    H = 150;
  x.fillStyle = "#05060a";
  x.fillRect(0, 0, W, H);
  const X = (t) => 8 + (t / S.tTot) * (W - 16),
    Y = (v) => H - 16 - (v / 1.05) * (H - 28);
  x.strokeStyle = "#262b36";
  x.lineWidth = 1;
  for (const v of [0, 0.5, 1]) {
    x.beginPath();
    x.moveTo(8, Y(v));
    x.lineTo(W - 8, Y(v));
    x.stroke();
  }
  const pl = (k, col) => {
    x.strokeStyle = col;
    x.lineWidth = 1.5;
    x.beginPath();
    S.hist.forEach((h, i) => {
      const a = X(h[0]),
        b = Y(h[k]);
      i ? x.lineTo(a, b) : x.moveTo(a, b);
    });
    x.stroke();
  };
  pl(1, "#8fd3ff");
  pl(2, "#ffc27a");
  x.font = "11px monospace";
  x.fillStyle = "#8fd3ff";
  x.fillText("driver", 12, 14);
  x.fillStyle = "#ffc27a";
  x.fillText("load", 60, 14);
  x.fillStyle = "#9a9ca3";
  x.textAlign = "right";
  x.fillText(fmt(S.tTot, "s"), W - 8, H - 3);
  x.fillText("1 V step", W - 8, 14);
  x.textAlign = "left";
}
function renderCtl() {
  const c = $("ctl");
  c.textContent = "";
  const m = S.over,
    d = S.d,
    net = d.nets.find((q) => q.id === +S.net);
  if (m === "J" || m === "V") {
    const ep = endPins(d, net);
    const v = Math.log10(S.Iset && S.IsetNet === net.id ? S.Iset : ep.I);
    slider(
      c,
      "iS",
      "Current",
      -3,
      1,
      0.05,
      v,
      (x) => {
        S.Iset = Math.pow(10, x);
        S.IsetNet = net.id;
        updateOverlayDebounced();
      },
      (x) => fmt(Math.pow(10, x), "A")
    );
  } else if (m === "signal") {
    slider(
      c,
      "rs",
      "Driver R",
      5,
      200,
      5,
      S.Rs,
      (x) => {
        S.Rs = x;
        updateOverlayDebounced();
      },
      (x) => x + " ohm"
    );
    slider(
      c,
      "rl",
      "Load R",
      5,
      1000,
      5,
      S.RL,
      (x) => {
        S.RL = x;
        updateOverlayDebounced();
      },
      (x) => (x >= 1000 ? "open" : x + " ohm")
    );
    slider(
      c,
      "tr",
      "Rise",
      10,
      500,
      10,
      S.tr,
      (x) => {
        S.tr = x;
        updateOverlayDebounced();
      },
      (x) => x + " ps"
    );
    const b = document.createElement("div");
    b.className = "btns";
    b.innerHTML = '<button id="replay">Play again</button>';
    c.appendChild(b);
    b.firstChild.onclick = () => {
      updateOverlay();
      if (RM) S.playing = true;
    };
    slider(
      c,
      "tsc",
      "Time",
      0,
      1,
      0.005,
      RM ? 0.5 : 0,
      (x) => {
        S.playing = false;
        seekSignal(x);
      },
      (x) => (S.tTot ? fmt(x * S.tTot, "s") : "")
    );
  } else if (m === "T") {
    slider(
      c,
      "hc",
      "h on faces",
      4,
      50,
      1,
      S.hconv || 10,
      (x) => {
        S.hconv = x;
        updateOverlayDebounced();
      },
      (x) => x + " W/m2K"
    );
  }
}