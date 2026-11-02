// One disturbance through three carriers. The bottom trace overlays the shared dimensionless store; raise the drive and
// the pipe peels away at the turbulent transition while the other two stay on one line.
const REG = JSON.parse(document.getElementById("regdata").textContent);
const cv = document.getElementById("cv"), g = cv.getContext("2d");
const P = new URLSearchParams(location.search);
const STILL = P.has("still");
const COL = { mass: "#ffc978", rlc: "#8fc7ff", pipe: "#7fd6a0" };
const DISTS = {
  chirp: (t) => Math.sin(2 * Math.PI * (0.1 * t + 0.05 * t * t)) * (t < 12 ? 1 : 0),
  step: (t) => (t > 0.5 ? 1 : 0),
  pulse: (t) => Math.exp(-(((t - 1) / 0.15) ** 2)),
};
const S3 = threeSystems();
const KEYS = Object.keys(S3);
const st = { dist: P.get("dist") || "chirp", drive: Number(P.get("drive") ?? 0.25), t: 0, y: {}, tr: {}, tab: P.get("tab") || "three", peak: 0 };
const driveVal = (x) => 10 ** (x * 2.6 - 1); // 0.1 to 40 on the slider
const dt = 0.002, SPAN = 16;
function reset() { st.t = 0; st.peak = 0; for (const k of KEYS) { st.y[k] = [0, 0]; st.tr[k] = []; } }
reset();
function advance(steps) {
  const u = DISTS[st.dist], d = driveVal(st.drive);
  for (let i = 0; i < steps; i++) {
    if (st.t >= SPAN) return;
    for (const k of KEYS) st.y[k] = rk4(S3[k], st.y[k], u(st.t) * S3[k].e0 * d, u(st.t + dt) * S3[k].e0 * d, dt);
    st.peak = Math.max(st.peak, pipeRe(st.y.pipe[1]));
    st.t += dt;
    if (Math.round(st.t / dt) % 10 === 0) for (const k of KEYS) st.tr[k].push(shared(S3[k], st.y[k]) / d);
  }
}
function fit() {
  const r = STILL ? 1 : devicePixelRatio || 1, w = STILL ? 3840 : cv.clientWidth * r, h = STILL ? 2160 : cv.clientHeight * r;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return [w, h];
}
function txt(s, x, y, px, c = "#e8e6df", f = "Hanken Grotesk, system-ui, sans-serif", a = "left") { g.font = `${px}px ${f}`; g.fillStyle = c; g.textAlign = a; g.fillText(s, x, y); }
const MONO = "JetBrains Mono, Consolas, monospace";
function springPath(x0, x1, y, n, amp) { g.beginPath(); g.moveTo(x0, y); for (let i = 1; i < n; i++) g.lineTo(x0 + ((x1 - x0) * i) / n, y + (i % 2 ? amp : -amp)); g.lineTo(x1, y); g.stroke(); }
function drawMass(x, y, w, h, v, u) {
  const base = x + w * 0.05, cx = x + w * 0.55 + Math.max(-1, Math.min(1, v)) * w * 0.25, by = y + h * 0.5, s = h * 0.34;
  g.strokeStyle = "#555b66"; g.lineWidth = h * 0.012; g.beginPath(); g.moveTo(base, y + h * 0.2); g.lineTo(base, y + h * 0.8); g.moveTo(x, y + h * 0.78); g.lineTo(x + w, y + h * 0.78); g.stroke();
  g.strokeStyle = COL.mass; springPath(base, cx - s / 2, by, 12, h * 0.05);
  g.fillStyle = COL.mass; g.fillRect(cx - s / 2, by - s / 2, s, s);
  const ar = u * w * 0.15; g.strokeStyle = "#fff"; g.beginPath(); g.moveTo(cx + s / 2, by); g.lineTo(cx + s / 2 + ar, by); g.stroke();
}
function drawLoop(x, y, w, h, v, f) {
  const l = x + w * 0.1, r = x + w * 0.9, t = y + h * 0.18, b = y + h * 0.78;
  g.strokeStyle = "#555b66"; g.lineWidth = h * 0.012; g.strokeRect(l, t, r - l, b - t);
  const px = l + (r - l) * 0.5, pw = (r - l) * 0.2;
  g.fillStyle = "#000"; g.fillRect(px - pw / 2, b - h * 0.05, pw, h * 0.1);
  g.fillStyle = COL.rlc; const q = Math.max(-1, Math.min(1, v));
  g.fillRect(px - pw / 2, b - h * 0.05, pw, h * 0.012 + Math.abs(q) * h * 0.012); g.fillRect(px - pw / 2, b + h * 0.05 - h * 0.012 - Math.abs(q) * h * 0.012, pw, h * 0.012 + Math.abs(q) * h * 0.012);
  // charge carriers on the wire, spaced evenly, moved by the store
  const per = 2 * (r - l + b - t), n = 22;
  g.fillStyle = COL.rlc;
  for (let i = 0; i < n; i++) {
    let d = (((i / n) * per + v * per * 0.12) % per + per) % per;
    let px2, py2;
    if (d < r - l) { px2 = l + d; py2 = t; } else if ((d -= r - l) < b - t) { px2 = r; py2 = t + d; } else if ((d -= b - t) < r - l) { px2 = r - d; py2 = b; } else { d -= r - l; px2 = l; py2 = b - d; }
    g.beginPath(); g.arc(px2, py2, h * 0.012, 0, 7); g.fill();
  }
}
function drawTank(x, y, w, h, v, re) {
  const tl = x + w * 0.62, tw = w * 0.26, tb = y + h * 0.8, tt = y + h * 0.1, py = tb - h * 0.04;
  const lvl = 0.5 + Math.max(-1, Math.min(1, v)) * 0.42;
  g.fillStyle = re > 2300 ? "#b7efc9" : COL.pipe; g.fillRect(tl, tb - (tb - tt) * lvl, tw, (tb - tt) * lvl); g.fillRect(x + w * 0.05, py - h * 0.02, tl - x - w * 0.05, h * 0.04);
  g.strokeStyle = "#555b66"; g.lineWidth = h * 0.012; g.beginPath(); g.moveTo(tl, tt); g.lineTo(tl, py - h * 0.03); g.moveTo(tl, py + h * 0.03); g.lineTo(tl, tb); g.lineTo(tl + tw, tb); g.lineTo(tl + tw, tt); g.moveTo(x + w * 0.05, py - h * 0.03); g.lineTo(tl, py - h * 0.03); g.moveTo(x + w * 0.05, py + h * 0.03); g.lineTo(tl, py + h * 0.03); g.stroke();
}
function drawThree(w, h) {
  g.fillStyle = "#0a0c10"; g.fillRect(0, 0, w, h);
  const m = w * 0.03, top = h * 0.46, cw = (w - 2 * m) / 3, u = DISTS[st.dist](st.t), px = h * 0.024;
  const names = { mass: "Mass on a spring", rlc: "RLC loop", pipe: "Pipe into a tank" };
  KEYS.forEach((k, i) => {
    const x = m + i * cw, v = shared(S3[k], st.y[k]) / driveVal(st.drive);
    txt(names[k], x + cw * 0.02, h * 0.05, px, COL[k]);
    txt(`${S3[k].effort}  ${S3[k].flow}  ${S3[k].store}`, x + cw * 0.02, h * 0.05 + px * 1.2, px * 0.56, "#a3a5ac");
    const ph = top - h * 0.08, py = h * 0.08;
    if (k === "mass") drawMass(x + cw * 0.04, py, cw * 0.9, ph, v, u);
    if (k === "rlc") drawLoop(x + cw * 0.04, py, cw * 0.9, ph, v, st.y.rlc[1]);
    if (k === "pipe") drawTank(x + cw * 0.04, py, cw * 0.9, ph, v, pipeRe(st.y.pipe[1]));
  });
  const x0 = m, x1 = w - m, y0 = top + h * 0.05, y1 = h * 0.94, ym = (y0 + y1) / 2;
  g.strokeStyle = "#262b35"; g.lineWidth = Math.max(1, h / 1400); g.beginPath(); g.moveTo(x0, ym); g.lineTo(x1, ym); g.stroke();
  let vmax = 0.5;
  for (const k of KEYS) for (const v of st.tr[k]) vmax = Math.max(vmax, Math.abs(v));
  const widths = { mass: h * 0.012, rlc: h * 0.006, pipe: h * 0.0025 };
  for (const k of KEYS) {
    g.strokeStyle = COL[k]; g.lineWidth = widths[k]; g.beginPath();
    st.tr[k].forEach((v, i) => { const X = x0 + ((i * 10 * dt) / SPAN) * (x1 - x0), Y = ym - (v / vmax) * (y1 - y0) * 0.48; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.stroke();
  }
  txt("Stored quantity over C times effort scale, one line where the map holds. Time in seconds, 0 to 16.", x0, top + h * 0.03, px * 0.66, "#a3a5ac");
}
