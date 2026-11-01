// Controls and the frame loop. ?still=1 renders the finished run at 3840 by 2160 for a saved plate.
const dv = document.getElementById("dv"), read = document.getElementById("read"), noteEl = document.getElementById("note"), driveEl = document.getElementById("drive");
driveEl.value = st.drive;
for (const name of Object.keys(DISTS)) {
  const b = document.createElement("button");
  b.textContent = name; b.setAttribute("aria-pressed", String(name === st.dist));
  b.onclick = () => { st.dist = name; for (const o of document.querySelectorAll("#dist button")) o.setAttribute("aria-pressed", String(o === b)); reset(); };
  document.getElementById("dist").append(b);
}
driveEl.oninput = () => { st.drive = Number(driveEl.value); reset(); };
for (const b of document.querySelectorAll("#tabs button")) b.onclick = () => { st.tab = b.dataset.t; for (const o of document.querySelectorAll("#tabs button")) o.setAttribute("aria-pressed", String(o === b)); paint(); };
function readouts() {
  const n = st.tr.mass.length;
  const a = Float64Array.from(st.tr.mass), b = Float64Array.from(st.tr.rlc), c = Float64Array.from(st.tr.pipe);
  const items = [["omega0 (each)", KEYS.map((k) => omega0(S3[k]).toFixed(2)).join(" ")], ["zeta (each)", KEYS.map((k) => zeta(S3[k]).toFixed(2)).join(" ")], ["pipe peak Re", st.peak.toFixed(0)], ["RLC to mass, NRMSE", n > 2 ? nrmse(b, a).toExponential(1) : "n/a"], ["pipe to mass, NRMSE", n > 2 ? nrmse(c, a).toExponential(1) : "n/a"], ["maps in registry", String(REG.maps.length)]];
  read.replaceChildren(...items.flatMap(([k, v]) => { const dt_ = document.createElement("dt"), dd = document.createElement("dd"); dt_.textContent = k; dd.textContent = v; return [dt_, dd]; }));
}
function paint() {
  const [w, h] = fit();
  if (st.tab === "reg") drawRegistry(w, h); else drawThree(w, h);
  dv.textContent = `${driveVal(st.drive).toFixed(2)} x effort scale`;
  noteEl.textContent = st.tab === "reg" ? "Status comes from a rule on each map's held-out test. Shared mechanism is a separate field." : "Raise the drive: at Re about 2300 the pipe leaves the shared line.";
  readouts();
}
if (STILL) {
  advance(Math.round(SPAN / dt));
  document.getElementById("panel").hidden = true;
  document.getElementById("app").style.gridTemplateColumns = "1fr";
  document.fonts.ready.then(() => { paint(); document.title = "ready"; });
} else {
  const frame = () => { if (st.tab === "three") advance(Math.round(1 / 60 / dt) * 2); if (st.t >= SPAN && st.tab === "three") reset(); paint(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}
