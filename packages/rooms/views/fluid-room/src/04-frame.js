// Frame loop, controls and readouts. Thin: all the physics is above or in the solver.
const Q = new URLSearchParams(location.search);
const State = { key: Q.get("case") || "marble", view: 0, running: true, N: +(Q.get("n") || 256), g: null, frames: 0, steps: 2, nu: 0, dtScale: 1, dir: 1 };
const VIEWS = [["Vorticity", 0], ["Speed", 1], ["Q", 2], ["Dye", 3]], VIEWS3 = [["|w|", "w"], ["Q", "q"], ["Helicity", "h"]];
function grid(N) {
  if (!State.g || State.g.N !== N) State.g = new Gpu2(N, Math.min(2048, Math.max(1024, N * 2)));
  return State.g;
}
function start() {
  const c = CASES[State.key];
  State.c = c;
  State.t = 0;
  State.dir = 1;
  State.nu = c.nu;
  $("note").textContent = c.note;
  drawViewButtons(c);
  syncSliders(c);
  $("rev").disabled = !!c.three;
  if (c.three) { State.view3 = VIEWS3[c.view][1]; Vol.start(c); Vol.worker.postMessage({ field: State.view3 }); return; }
  Vol.stop();
  const g = grid(State.N);
  g.nu = c.nu;
  g.drive = 0; g.drag = 0;
  g.setStatics(null, null);
  g.dt = (c.dt * 2.2) / g.N;
  State.steps = g.N >= 512 ? 3 : 2;
  c.start(g, c);
  State.view = c.view;
  drawViewButtons(c);
}
function stirAt(x, y, amp) {
  const g = State.g;
  pass(PROG.stir, g.W3, { W: g.W }, { uN: g.N, uAt: [x * TAU, y * TAU], uAmp: amp, uR: 0.18 });
  [g.W, g.W3] = [g.W3, g.W];
}
function drawViewButtons(c) {
  const b = $("vw");
  b.textContent = "";
  for (const [label, v] of c.three ? VIEWS3 : VIEWS) {
    const e = document.createElement("button");
    e.textContent = label;
    const on = c.three ? State.view3 === v : State.view === v;
    e.setAttribute("aria-pressed", String(on));
    e.onclick = () => { if (c.three) { State.view3 = v; Vol.worker.postMessage({ field: v }); } else State.view = v; drawViewButtons(c); };
    b.append(e);
  }
}
function syncSliders(c) {
  const s = $("sl");
  s.textContent = "";
  const row = (label, min, max, v, fmt, on) => {
    const d = document.createElement("div"); d.className = "row";
    const l = document.createElement("label"); l.textContent = label;
    const i = document.createElement("input"); Object.assign(i, { type: "range", min, max, step: (max - min) / 200, value: v });
    i.setAttribute("aria-label", label);
    const o = document.createElement("output"); o.textContent = fmt(v);
    i.oninput = () => { o.textContent = fmt(+i.value); on(+i.value); };
    d.append(l, i, o); s.append(d);
  };
  row("Viscosity", -5, -0.8, Math.log10(c.nu), (v) => (10 ** v).toExponential(1), (v) => { State.nu = 10 ** v; if (c.three) Vol.worker.postMessage({ nu: State.nu }); else State.g.nu = State.nu; });
  if (!c.three) row("Grid", 7, 10, Math.log2(State.N), (v) => String(2 ** Math.round(v)), (v) => { const n = 2 ** Math.round(v); if (n !== State.N) { State.N = n; start(); } });
}
function readout() {
  const c = State.c;
  let rows, spec;
  if (c.three) {
    const m = Vol.last;
    if (!m) return;
    spec = m.spec;
    rows = [["Time", m.t.toFixed(2)], ["Energy", m.E.toFixed(5)], ["Enstrophy", m.Z.toFixed(4)], ["Helicity, volume", (m.H * TAU ** 3).toFixed(3)], ["Divergence", m.div.toExponential(1)], ["Grid", m.n + " cubed"]];
    if (c.three === "linked") rows.push(["2 Lk Gamma^2", (2 * 9).toFixed(2)]);
    showGate(c, { dim: 3, N: m.n, nu: State.nu, dt: 1.6 / m.n, umax: 0, spectrum: spec });
  } else {
    const g = State.g, m = g.measures();
    if (!Number.isFinite(m.E)) { State.running = false; fail("The step went unstable, so the numbers stopped meaning anything. Restart the case."); }
    // Keep the advective limit: the step shrinks if a stir or a thin layer speeds the flow up.
    const P = g.read(g.P);
    let umax = 0;
    for (let i = 0; i < P.length; i += 4) umax = Math.max(umax, Math.hypot(P[i], P[i + 1]));
    g.dt = Math.min((c.dt * 2.2) / g.N, (0.6 * TAU) / g.N / Math.max(umax, 1e-3));
    spec = m.spec;
    rows = [["Time", State.t.toFixed(2)], ["Energy", m.E.toFixed(5)], ["Enstrophy", m.Z.toFixed(4)], ["Step", g.dt.toFixed(4)], ["Grid", g.N + " squared"]];
    if (c.exact) rows.push(["Energy over exact", (m.E / c.exact(State.t, g.nu)).toFixed(5)]);
    let peak = 0;
    for (let k = 4; k < spec.length; k++) if (k < g.N / 3 && spec[k] > 0) peak = k;
    rows.push(["Top resolved shell", String(peak)]);
    State.m = m;
    showGate(c, { N: g.N, nu: g.nu, dt: g.dt, umax, spectrum: spec, wall: g.hasWall ? { eta: g.eta } : null });
  }
  const d = $("read");
  d.textContent = "";
  for (const [a, b] of rows) { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = a; dd.textContent = b; d.append(dt, dd); }
  drawSpectrum(spec);
}
/** The label the field must not appear without: inside its regime or not, from this run's own numbers. */
function showGate(c, input) {
  const r = regimeGate({ ...input, model: (c.limits || []).map((k) => MODEL_LIMITS[k]) });
  const g = $("gate"), u = $("limits");
  g.textContent = r.valid ? "Numerics inside their valid regime" : "Outside its valid regime: do not read these numbers as flow";
  g.className = r.valid ? "in" : "out";
  u.textContent = "";
  for (const [list, cls] of [[r.outside, "out"], [r.model, ""]]) for (const x of list) { const li = document.createElement("li"); li.textContent = x.text; li.className = cls; u.append(li); }
  State.gate = r;
}
function drawSpectrum(E) {
  const C = $("spec"), x = C.getContext("2d"), W = C.width, H = C.height;
  x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
  const top = E.findIndex((v, k) => k > 0 && v <= 0) > 0 ? E.length : E.length, K = Math.log10(Math.max(4, Math.min(E.length - 1, top)));
  let max = 0;
  for (let k = 1; k < E.length; k++) if (E[k] > max) max = E[k];
  const Y = (v) => H * (1 - (Math.log10(v / max) + 8) / 8.3), X = (k) => (W * Math.log10(k)) / K;
  x.strokeStyle = "#444"; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(X(1), Y(max)); x.lineTo(X(10 ** K), Y(max * (10 ** K) ** (-5 / 3))); x.stroke(); x.setLineDash([]);
  x.strokeStyle = "#ffc978"; x.lineWidth = 2; x.beginPath();
  let on = false;
  for (let k = 1; k < E.length; k++) if (E[k] > 0) { const py = Math.min(H, Y(E[k])); if (on) x.lineTo(X(k), py); else x.moveTo(X(k), py); on = true; }
  x.stroke();
}
function drawNow() {
  const c = State.c, g = State.g;
  if (c.three) return Vol.draw(State.view3 !== "w");
  pass(PROG.viewp, g.A, { W: g.W }, { uN: g.N });
  g.fft2(g.A, g.V, 1);
  pass(PROG.show, null, { A: g.V, P: g.P, D: g.D[0], S: g.S }, { uView: State.view, uRes: [canvas.width, canvas.height], uGain: c.gain });
}
/** Advance by n steps now and draw, whatever the frame rate. For checks and stills; returns milliseconds per step. */
window.fluidAdvance = function fluidAdvance(n) {
  const g = State.g, t0 = performance.now();
  for (let i = 0; i < n; i++) { g.step(); State.t += g.dt * State.dir; }
  gl.finish();
  g.read(g.W);
  const ms = (performance.now() - t0) / n;
  drawNow();
  readout();
  return ms;
};
function frame() {
  const c = State.c;
  if (c.three) { Vol.draw(State.view3 !== "w"); if (State.frames++ % 10 === 0) readout(); requestAnimationFrame(frame); return; }
  const g = State.g;
  if (State.running) for (let i = 0; i < State.steps; i++) { g.step(); State.t += g.dt * State.dir; }
  drawNow();
  if (State.frames++ % 20 === 0) readout();
  requestAnimationFrame(frame);
}
/** Time reversal: omega to -omega and the fixed flow flipped. The viscous and wall terms do not reverse, which is the point. */
function reverseTime() {
  const g = State.g, a = g.read(g.W);
  for (let i = 0; i < a.length; i++) a[i] = -a[i];
  g.upload(g.W, a);
  State.dir = -State.dir;
  if (g.hasS) {
    const s = g.read(g.S), t = g.read(g.Tg);
    for (let i = 0; i < s.length; i += 4) { s[i] = -s[i]; s[i + 1] = -s[i + 1]; s[i + 3] = -s[i + 3]; t[i] = -t[i]; t[i + 1] = -t[i + 1]; }
    g.upload(g.S, s); g.upload(g.Tg, t);
  }
}
function boot() {
  const sel = $("case");
  for (const [k, c] of Object.entries(CASES)) { const o = document.createElement("option"); o.value = k; o.textContent = c.label; sel.append(o); }
  sel.value = State.key;
  sel.onchange = () => { State.key = sel.value; start(); };
  $("run").onclick = () => { State.running = !State.running; $("run").setAttribute("aria-pressed", String(State.running)); $("run").textContent = State.running ? "Running" : "Paused"; if (State.c.three) Vol.worker.postMessage({ run: State.running }); };
  $("rev").onclick = reverseTime;
  $("reset").onclick = start;
  let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = [e.offsetX, e.offsetY]; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointerup", () => { down = null; });
  canvas.addEventListener("pointermove", (e) => {
    if (!down) return;
    const r = canvas.getBoundingClientRect();
    if (State.c.three) { Vol.yaw += (e.offsetX - down[0]) * 0.01; Vol.pitch += (e.offsetY - down[1]) * 0.01; }
    else stirAt(e.offsetX / r.width, 1 - e.offsetY / r.height, (e.offsetX - down[0]) * 0.8);
    down = [e.offsetX, e.offsetY];
  });
  canvas.tabIndex = 0;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { State.running = false; $("run").setAttribute("aria-pressed", "false"); $("run").textContent = "Paused"; }
  const res = +(Q.get("res") || 0);
  if (res) { canvas.width = res; canvas.height = res; }
  start();
  requestAnimationFrame(frame);
}
/** Browser checks against the CPU reference. Returns numbers; a person or a test harness reads them. */
window.fluidChecks = async function fluidChecks() {
  const out = {}, N = 64, g = new Gpu2(N, 64);
  // FFT round trip through the GPU, against the CPU forward transform.
  const f = (x, y) => Math.exp(Math.sin(x) + Math.cos(2 * y)) - 1.5 * Math.sin(x + y) + 0.3 * Math.cos(5 * x - 3 * y);
  const cpu = new Spectral2(N, N, { nu: 0.005, scheme: "ssp3" });
  cpu.setField(0, f);
  g.nu = 0.005; g.dt = 0.01;
  g.setStatics(null, null);
  g.setVorticity(f);
  const worst = (A, re, im) => { let d = 0, m = 0; for (let i = 0; i < N * N; i++) { d = Math.max(d, Math.hypot(A[4 * i] - re[i], A[4 * i + 1] - im[i])); m = Math.max(m, Math.hypot(re[i], im[i])); } return d / m; };
  out.start_rel = worst(g.read(g.W), cpu.fields[0].re, cpu.fields[0].im);
  for (let i = 0; i < 100; i++) { g.step(); cpu.step(0.01); }
  out.after_100_rel = worst(g.read(g.W), cpu.fields[0].re, cpu.fields[0].im);
  out.energy_gpu = g.measures().E; out.energy_cpu = cpu.energy();
  // Same, with the bowl's terms on: wall penalty and drain.
  const B = bowl({ N, nu: 0.02, a: 1.2, R: 0.7, Rw: 2.6, V: 1, eta: 0.02, dyes: 0, scheme: "ssp3" });
  const fx = centredDiv(B.flow, N);
  g.setStatics({ ux: B.flow.ux, uy: B.flow.uy, div: fx }, B.wall);
  g.nu = 0.02; g.dt = 0.005;
  g.setVorticity((x, y) => 0.3 * Math.sin(x + 2 * y));
  B.setField(0, (x, y) => 0.3 * Math.sin(x + 2 * y));
  for (let i = 0; i < 100; i++) { g.step(); B.step(0.005); }
  out.bowl_after_100_rel = worst(g.read(g.W), B.fields[0].re, B.fields[0].im);
  // Planted: the wrong viscosity must show.
  const bad = new Spectral2(N, N, { nu: 0.05, scheme: "ssp3" });
  bad.setField(0, f);
  for (let i = 0; i < 100; i++) bad.step(0.01);
  g.setStatics(null, null); g.nu = 0.005; g.dt = 0.01; g.setVorticity(f);
  for (let i = 0; i < 100; i++) g.step();
  out.planted_viscosity_rel = worst(g.read(g.W), bad.fields[0].re, bad.fields[0].im);
  return out;
};
if (gl) { try { boot(); } catch (e) { fail(String(e)); console.error(e); } }
