// The 3D CPU reference for the view. Steps a small cube and sends one scalar per frame, plus readouts.
let sim = null, running = true, field = "w", dt = 0.04;
const send = () => {
  if (!sim) return;
  let v;
  if (field === "q") v = sim.qField();
  else if (field === "h") v = sim.helicityField();
  else { const w = sim.vorticity(); v = w[0].map((_, i) => Math.hypot(w[0][i], w[1][i], w[2][i])); }
  const f = Float32Array.from(v);
  postMessage({ t: sim.t, n: sim.n, E: sim.energy(), Z: sim.enstrophy(), H: sim.helicity(), div: sim.maxDivergence(), spec: Array.from(sim.spectrum()), field: f }, [f.buffer]);
};
const loop = () => {
  if (sim && running) { sim.step(dt); send(); }
  setTimeout(loop, running ? 0 : 60);
};
onmessage = (e) => {
  const m = e.data;
  if (m.start) {
    if (m.start === "tg") { sim = new Spectral3(m.n, { nu: m.nu }); sim.setVelocity(taylorGreen3); dt = 1.6 / m.n; }
    else { sim = tubes(hopf(m.start), m.n, { a: 0.3, G: 3, nu: m.nu }); dt = 1.2 / m.n; }
    send();
  }
  if (m.nu !== undefined && sim) sim.nu = m.nu;
  if (m.field) { field = m.field; send(); }
  if (m.run !== undefined) running = m.run;
};
loop();
