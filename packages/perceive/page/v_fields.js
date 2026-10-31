// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive page: field bridges. Electric potential of charges you drag; the magnetic field of wires with a
   compass you drag; heat spreading over a metal sheet. World units are metres; the view spans 4 m across. */
(function () {
  "use strict";
  const PV = window.PV, P = PV.P, $ = PV.$;
  const W = 2, ASP = 0.6, HH = W * ASP;
  const toW = (x, y) => [(x * 2 - 1) * W, (1 - y * 2) * HH];
  const toS = (X, Y, w, h) => [((X / W + 1) / 2) * w, ((1 - Y / HH) / 2) * h];
  const lstar = (rgb) => { const l = rgb.map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); const Y = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
  const fader = (sel, v) => PV.Kit_set(sel, Math.round(v * 100));

  /* Electricity */
  const E = { q: [], probe: [0.3, 0.3], drag: -1, mode: "probe", harm: 0.2, dots: [], seed: P.rng(3) };
  const nC = 1e-9, VREF = 60;
  const EPRE = { dipole: [[-0.8, 0, 1], [0.8, 0, -1]], alike: [[-0.8, 0, 1], [0.8, 0, 1]], three: [[-1, -0.5, 1], [1, -0.5, 1], [0, 0.7, -2]], plates: [-1.2, -0.6, 0, 0.6, 1.2].flatMap((x) => [[x, 0.6, 1], [x, -0.6, -1]]) };
  const vt = (v) => Math.sign(v) * Math.log10(1 + Math.abs(v)) / Math.log10(1 + VREF);
  const setE = (name) => { E.q = EPRE[name].map(([x, y, q]) => ({ x, y, q: q * nC })); E.dots = []; };
  function spawn() { const pos = E.q.filter((c) => c.q > 0); const c = pos.length ? pos[Math.floor(E.seed() * pos.length)] : { x: 0, y: 0 }; const a = E.seed() * 6.283; return { x: c.x + 0.08 * Math.cos(a), y: c.y + 0.08 * Math.sin(a), age: 0 }; }
  PV.def({
    id: "elec", bridge: "electricity", label: "Electric potential around the charges as a colour map with contour lines: warm is positive, cool is negative; a crosshair marks the probe.",
    init() {
      setE("dipole");
      $("#e-pre").addEventListener("change", (e) => { setE(e.target.value); PV.update(); });
      $("#e-snd").addEventListener("change", (e) => { E.mode = e.target.value; PV.update(); });
      $("#e-harm").addEventListener("input", (e) => { E.harm = e.target.value / 100; PV.update(); });
      const pr = () => { E.probe = [(+$("#e-px").value / 100 + 1) / 2, (1 - +$("#e-py").value / 100) / 2]; PV.update(); };
      $("#e-px").addEventListener("input", pr); $("#e-py").addEventListener("input", pr);
    },
    draw(el) {
      const { ctx, w, h } = PV.canvas(el, ASP), c = 4, nx = Math.ceil(w / c), ny = Math.ceil(h / c), L = new Int8Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const [X, Y] = toW((i + 0.5) / nx, (j + 0.5) / ny), t = vt(P.potential(E.q, X, Y));
        ctx.fillStyle = PV.rgb(PV.diverge(t)); ctx.fillRect(i * c, j * c, c, c); L[j * nx + i] = Math.round(t * 8);
      }
      ctx.fillStyle = PV.tok.ink; ctx.globalAlpha = 0.55;
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = L[j * nx + i]; if (a !== L[j * nx + i + 1] || a !== L[(j + 1) * nx + i]) ctx.fillRect(i * c + 1, j * c + 1, 2, 2); }
      ctx.globalAlpha = 1;
      if (PV.still()) { // E as arrows when nothing moves
        ctx.strokeStyle = PV.tok.ink; ctx.lineWidth = 1;
        for (let y = 20; y < h; y += 36) for (let x = 20; x < w; x += 36) { const [X, Y] = toW(x / w, y / h), [ex, ey] = P.efield(E.q, X, Y), m = Math.hypot(ex, ey) || 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (10 * ex) / m, y - (10 * ey) / m); ctx.stroke(); ctx.fillRect(x + (10 * ex) / m - 1.5, y - (10 * ey) / m - 1.5, 3, 3); }
      } else { ctx.fillStyle = PV.tok.ink; for (const d of E.dots) { const [sx, sy] = toS(d.x, d.y, w, h); ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3); } }
      for (const q of E.q) { const [sx, sy] = toS(q.x, q.y, w, h); ctx.fillStyle = PV.tok.ink; ctx.beginPath(); ctx.arc(sx, sy, 11, 0, 7); ctx.fill(); PV.text(ctx, q.q > 0 ? "+" : "−", sx, sy + 1, { align: "center", base: "middle", size: 16, weight: 700, color: PV.tok.wall }); }
      const [px, py] = [E.probe[0] * w, E.probe[1] * h];
      ctx.strokeStyle = PV.tok.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - 12, py); ctx.lineTo(px + 12, py); ctx.moveTo(px, py - 12); ctx.lineTo(px, py + 12); ctx.stroke();
    },
    tick(dt) {
      while (E.dots.length < 140) E.dots.push(spawn());
      for (let k = 0; k < E.dots.length; k++) {
        const d = E.dots[k], [ex, ey] = P.efield(E.q, d.x, d.y), m = Math.hypot(ex, ey) || 1, sp = 0.15 + 0.1 * Math.log10(1 + m);
        d.x += (dt * sp * ex) / m; d.y += (dt * sp * ey) / m; d.age += dt;
        if (Math.abs(d.x) > W || Math.abs(d.y) > HH || d.age > 12 || E.q.some((c) => c.q < 0 && Math.hypot(c.x - d.x, c.y - d.y) < 0.06)) E.dots[k] = spawn();
      }
      return true;
    },
    pointer(kind, x, y) {
      const [X, Y] = toW(x, y);
      if (kind === "down") E.drag = E.q.findIndex((c) => Math.hypot(c.x - X, c.y - Y) < 0.15);
      if (kind === "up") { E.drag = -1; return false; }
      if (E.drag >= 0) { E.q[E.drag].x = X; E.q[E.drag].y = Y; } else { E.probe = [x, y]; fader("#e-px", x * 2 - 1); fader("#e-py", 1 - y * 2); }
      return true;
    },
    describe() {
      const [X, Y] = toW(...E.probe), v = P.potential(E.q, X, Y), [ex, ey] = P.efield(E.q, X, Y);
      return `${E.q.length} charges of 1 or 2 nC. The probe at (${X.toFixed(2)} m, ${Y.toFixed(2)} m) reads ${v.toFixed(2)} V; the field there is ${PV.si(Math.hypot(ex, ey), "V/m")}, pointing ${Math.round(Math.atan2(ey, ex) * 180 / Math.PI)} degrees from the right. Warm ground is positive potential, cool is negative, dotted lines join equal potential` + (PV.still() ? "; arrows show where a free positive charge would be pushed." : "; moving dots show where free positive charges would drift.");
    },
    loss: () => ({ map: "V as a diverging colour on a signed log scale (plus or minus 60 V at full colour), with contour lines every eighth of the scale; E as drifting dots or arrows; the probe's V as pitch, 150 Hz at -60 V to 1.5 kHz at +60 V (mel); or a mains waveform played at its own frequency.",
      bits: "The picture keeps 17 contour bands (-8 to 8) of the log scale: about 4.1 bits per point. The probe's value is exact in the text. The mains waveform is played as is: 0 bits lost inside hearing.",
      inverse: "Invertible at the probe: pitch maps back to V through the mel scale, inside plus or minus 60 V." }),
    sound(textOnly) {
      if (E.mode !== "probe") {
        const f = +E.mode, txt = `a ${f} Hz mains waveform, played as it is (no shift: ${f} Hz is already audible), with ${(E.harm * 100).toFixed(0)}% third and fifth harmonics, the distortion a mains supply picks up from loads.`;
        if (textOnly) return { text: txt };
        const rate = 24000, b = new Float32Array(rate);
        for (let i = 0; i < rate; i++) { const t = i / rate; b[i] = 0.5 * (Math.sin(2 * Math.PI * f * t) + E.harm * (Math.sin(6 * Math.PI * f * t) / 3 + Math.sin(10 * Math.PI * f * t) / 5)); }
        return { buffer: [b], rate, text: txt };
      }
      const [X, Y] = toW(...E.probe), v = Math.max(-VREF, Math.min(VREF, P.potential(E.q, X, Y))), f = P.bridge(P.window(-VREF, VREF, "linear"), P.window(150, 1500, "mel")).map(v);
      return { partials: [{ f, g: 1, pan: X / W }, { f: f * 2, g: 0.25, pan: X / W }], text: `one tone at ${f.toFixed(0)} Hz for the probe's ${v.toFixed(1)} V; drag the probe uphill and it rises.` };
    },
    haptic() { const [X, Y] = toW(...E.probe); return [Math.abs(vt(P.potential(E.q, X, Y)))]; },
  });

  /* Magnetism */
  const Mg = { wires: [], probe: [0.62, 0.35], drag: -1 };
  const MPRE = { one: [[0, 0, 10]], same: [[-0.6, 0, 10], [0.6, 0, 10]], loop: [[-0.6, 0, 10], [0.6, 0, -10]], quad: [[-0.6, -0.5, 10], [0.6, -0.5, -10], [0.6, 0.5, 10], [-0.6, 0.5, -10]] };
  const setM = (n) => { Mg.wires = MPRE[n].map(([x, y, I]) => ({ x, y, I })); };
  const bt = (b) => Math.max(0, Math.min(1, (Math.log10(b * 1e6) + 1) / 4)); // 0.1 uT to 1 mT
  PV.def({
    id: "mag", bridge: "magnetism", label: "Magnetic field lines around wires seen end on; lines crowd where the field is strong; a compass needle at the probe points along the field.",
    init() {
      setM("one");
      $("#m-pre").addEventListener("change", (e) => { setM(e.target.value); PV.update(); });
      const pr = () => { Mg.probe = [(+$("#m-px").value / 100 + 1) / 2, (1 - +$("#m-py").value / 100) / 2]; PV.update(); };
      $("#m-px").addEventListener("input", pr); $("#m-py").addEventListener("input", pr);
    },
    draw(el) {
      const { ctx, w, h } = PV.canvas(el, ASP), field = (x, y) => P.wireB(Mg.wires, x, y), r = P.rng(11);
      ctx.strokeStyle = PV.tok.ink; ctx.lineWidth = 1.2;
      for (let k = 0; k < 900; k++) {
        const X = (r() * 2 - 1) * W, Y = (r() * 2 - 1) * HH, b = Math.hypot(...field(X, Y));
        if (r() > bt(b) ** 2 * 0.5) continue; // seed density follows field strength
        ctx.globalAlpha = 0.25 + 0.6 * bt(b);
        for (const dir of [1, -1]) {
          const pts = P.streamline((x, y) => field(x, y).map((v) => v * dir), X, Y, 0.02, 60, [-W, W, -HH, HH]);
          ctx.beginPath(); pts.forEach(([x, y], i) => { const [sx, sy] = toS(x, y, w, h); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      for (const q of Mg.wires) {
        const [sx, sy] = toS(q.x, q.y, w, h); ctx.fillStyle = PV.tok.wall; ctx.strokeStyle = PV.tok.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, 11, 0, 7); ctx.fill(); ctx.stroke();
        if (q.I > 0) { ctx.fillStyle = PV.tok.ink; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 7); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(sx - 6, sy - 6); ctx.lineTo(sx + 6, sy + 6); ctx.moveTo(sx + 6, sy - 6); ctx.lineTo(sx - 6, sy + 6); ctx.stroke(); }
      }
      const [X, Y] = toW(...Mg.probe), [bx, by] = field(X, Y), m = Math.hypot(bx, by) || 1, px = Mg.probe[0] * w, py = Mg.probe[1] * h, L = 26;
      ctx.fillStyle = PV.tok.mat; ctx.strokeStyle = PV.tok.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, L + 4, 0, 7); ctx.fill(); ctx.stroke();
      const ux = bx / m, uy = -by / m;
      ctx.lineWidth = 5; ctx.strokeStyle = PV.tok.red; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + ux * L, py + uy * L); ctx.stroke();
      ctx.strokeStyle = PV.tok.ink; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - ux * L, py - uy * L); ctx.stroke();
    },
    pointer(kind, x, y) {
      const [X, Y] = toW(x, y);
      if (kind === "down") Mg.drag = Mg.wires.findIndex((c) => Math.hypot(c.x - X, c.y - Y) < 0.15);
      if (kind === "up") { Mg.drag = -1; return false; }
      if (Mg.drag >= 0) { Mg.wires[Mg.drag].x = X; Mg.wires[Mg.drag].y = Y; } else { Mg.probe = [x, y]; fader("#m-px", x * 2 - 1); fader("#m-py", 1 - y * 2); }
      return true;
    },
    describe() {
      const [X, Y] = toW(...Mg.probe), [bx, by] = P.wireB(Mg.wires, X, Y), b = Math.hypot(bx, by);
      return `${Mg.wires.length} wire${Mg.wires.length > 1 ? "s" : ""} carrying 10 A, seen end on (a dot is current toward you, a cross away). The compass at (${X.toFixed(2)} m, ${Y.toFixed(2)} m) feels ${(b * 1e6).toFixed(2)} µT, pointing ${Math.round(Math.atan2(by, bx) * 180 / Math.PI)} degrees from the right. Earth's own field is about 25 to 65 µT. Field lines crowd where the field is strong.`;
    },
    loss: () => ({ map: "direction as streamlines; |B| as how many lines start nearby and how dark they are (log scale, 0.1 µT to 1 mT); a compass at the probe; |B| there as pitch, 120 Hz to 1.6 kHz (log), panned left or right by the field's sideways part.",
      bits: "Direction is kept everywhere a line passes; |B| in the picture is a density, readable to a factor of about two. The compass value is exact in the text. Out-of-plane field is zero here by symmetry, so nothing is dropped there.",
      inverse: "Invertible at the compass: pitch maps back to |B| on the log scale, inside 0.1 µT to 1 mT." }),
    sound() {
      const [X, Y] = toW(...Mg.probe), [bx, by] = P.wireB(Mg.wires, X, Y), b = Math.hypot(bx, by), f = P.bridge(P.window(1e-7, 1e-3, "log"), P.window(120, 1600, "log")).map(Math.max(1e-7, Math.min(1e-3, b)));
      return { partials: [{ f, g: 1, pan: bx / (b || 1) }], text: `one tone at ${f.toFixed(0)} Hz for ${(b * 1e6).toFixed(1)} µT; nearer a wire it rises.` };
    },
    haptic() { const [X, Y] = toW(...Mg.probe); return [bt(Math.hypot(...P.wireB(Mg.wires, X, Y)))]; },
  });

  /* Heat: an aluminium sheet 80 cm by 48 cm, 1 cm cells, D = 9.7e-5 m^2/s, r = 0.24 (dt = 0.247 s per step). */
  const GW = 80, GH = 48, RR = 0.24, DT = (RR * 1e-4) / 9.7e-5;
  const H = { T: null, fix: null, steps: 0, mode: "hot", probe: [0.5, 0.5] };
  const HPRE = { spot: [[0.3, 0.5, 100]], pair: [[0.3, 0.5, 100], [0.7, 0.5, 0]], line: [[0.15, 0.3, 100], [0.15, 0.5, 100], [0.15, 0.7, 100]] };
  function setH(name) {
    H.T = new Float64Array(GW * GH).fill(20); H.fix = new Uint8Array(GW * GH); H.steps = 0;
    for (const [x, y, T] of HPRE[name]) put(x, y, T);
  }
  function put(x, y, T) { const cx = Math.round(x * (GW - 1)), cy = Math.round(y * (GH - 1)); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = cx + i, Y = cy + j; if (X >= 0 && X < GW && Y >= 0 && Y < GH) { H.T[Y * GW + X] = T; H.fix[Y * GW + X] = 1; } } }
  const probeT = () => H.T[Math.round(H.probe[1] * (GH - 1)) * GW + Math.round(H.probe[0] * (GW - 1))];
  const run = (n) => { for (let k = 0; k < n; k++) H.T = P.heatStep2D(H.T, GW, GH, RR, H.fix); H.steps += n; };
  PV.def({
    id: "heat", bridge: "heat", label: "Temperature over a metal sheet on a dark-blue-to-yellow ramp, with a legend; heat spreads from the hot spots as time runs.",
    init() {
      setH("spot");
      $("#h-pre").addEventListener("change", (e) => { setH(e.target.value); PV.update(); });
      $("#h-mode").addEventListener("change", (e) => { H.mode = e.target.value; });
      $("#h-step").addEventListener("click", () => { run(40); PV.update(); });
    },
    draw(el) {
      const { ctx, w, h } = PV.canvas(el, ASP), gh = h - 40, cw = w / GW, ch = gh / GH;
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { ctx.fillStyle = PV.rgb(PV.seq(H.T[j * GW + i] / 100)); ctx.fillRect(i * cw, j * ch, cw + 0.6, ch + 0.6); }
      const px = H.probe[0] * w, py = H.probe[1] * gh;
      ctx.strokeStyle = PV.tok.ink; ctx.lineWidth = 2; ctx.strokeRect(px - 6, py - 6, 12, 12);
      for (let x = 0; x < w * 0.5; x++) { ctx.fillStyle = PV.rgb(PV.seq(x / (w * 0.5))); ctx.fillRect(x, gh + 10, 1.5, 10); }
      PV.text(ctx, "0 °C", 0, gh + 34, { size: 11, color: PV.tok.soft }); PV.text(ctx, "100 °C", w * 0.5, gh + 34, { size: 11, color: PV.tok.soft, align: "right" });
      PV.text(ctx, "perceptual ramp: brightness rises evenly; the hues are a choice", w - 2, gh + 20, { size: 11, color: PV.tok.soft, align: "right" });
    },
    tick() { run(6); return true; },
    pointer(kind, x, y) {
      if (kind === "up") return false;
      const gy = y * (PV.$("#cv").clientHeight / (PV.$("#cv").clientHeight - 40));
      if (gy > 1) return false;
      if (H.mode === "probe") H.probe = [x, gy]; else put(x, gy, H.mode === "hot" ? 100 : 0);
      return true;
    },
    describe() {
      const mean = H.T.reduce((s, v) => s + v, 0) / H.T.length;
      return `An aluminium sheet 80 by 48 cm with held hot (100 °C) or cold (0 °C) spots, starting at 20 °C. After ${(H.steps * DT).toFixed(0)} s of model time the probe reads ${probeT().toFixed(1)} °C and the sheet averages ${mean.toFixed(1)} °C.` + (PV.still() ? " Time is paused while motion is off: press Let time pass." : " Heat spreads as you watch.");
    },
    loss() {
      const xs = Array.from(H.T, (v) => Math.round(v * 10));
      const l = P.lossBits(xs, (c) => Math.round(lstar(PV.seq(c / 1000))));
      return { map: "T from 0 to 100 °C as a sequential ramp (dark blue to yellow, lightness rising evenly); time as motion; the probe's T as pitch, 200 Hz to 1.6 kHz (log).",
        bits: `Across the sheet at 0.1 °C steps the field holds ${l.bitsSource.toFixed(2)} bits per cell; the ramp at one step of CIE lightness keeps ${l.bitsKept.toFixed(2)}, losing ${l.bitsLost.toFixed(2)}. The probe's value is exact in the text.`,
        inverse: `Invertible to one lightness step: each shade maps back to a band of about ${(100 / (lstar(PV.seq(1)) - lstar(PV.seq(0)))).toFixed(1)} °C.` };
    },
    sound() { const t = Math.max(0, Math.min(100, probeT())), f = P.bridge(P.window(0, 100, "linear"), P.window(200, 1600, "log")).map(t); return { partials: [{ f, g: 1, pan: H.probe[0] * 2 - 1 }], text: `one tone at ${f.toFixed(0)} Hz for the probe's ${t.toFixed(1)} °C; it climbs as heat arrives.` }; },
    haptic() { return [probeT() / 100]; },
  });
})();
