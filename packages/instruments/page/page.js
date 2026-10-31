// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Instrument Pipeline page. D is written in by build_page.py; FIG comes from figs.js. */
const D = /*DATA*/null;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]));
const NAMES = ["Law", "Twin", "Front end", "Board", "Firmware", "Calibration", "Round trip", "Field", "Receipt", "Make"];
const CTL = {
  "room-weyl": { a: ["Room volume", 20, 150, 1, 55, v => `${v} m3`], b: ["Reverb time", 0.3, 1.2, 0.01, 0.7, v => `${(+v).toFixed(2)} s`] },
  jnt: { a: ["Resistor", 0, 100, 1, 50, v => `${rk(v).toFixed(rk(v) < 10 ? 1 : 0)} kOhm`], b: ["Averaging time", 0, 100, 1, 50, v => tmin(ts(v))] },
  polariscope: { a: ["Load on the disc", 0, 600, 5, 300, v => `${v} N`], b: ["Sheet sensitivity", 3, 20, 0.5, 7, v => `${(+v).toFixed(1)} N/mm per fringe`] },
};
const rk = i => 10 ** (2 * i / 100), ts = i => 10 ** (3.556 * i / 100);
const tmin = s => s < 120 ? `${Math.round(s)} s` : s < 7200 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;
let inst = "room-weyl", step = 0, mode = "day";
const saved = {};

function store(k, v) { try { localStorage.setItem("pipeline." + k, v); } catch (e) { /* storage blocked: the page still works */ } }
function recall(k) { try { return localStorage.getItem("pipeline." + k); } catch (e) { return null; } }

function setControls() {
  const c = CTL[inst];
  [["a", "fa", "la", "va"], ["b", "fb", "lb", "vb"]].forEach(([k, id, lid, vid]) => {
    const [label, lo, hi, st, val, fmt] = c[k], f = $(id);
    f.min = lo; f.max = hi; f.step = st; f.value = saved[inst + k] ?? val;
    $(lid).textContent = label; $(vid).textContent = fmt(f.value);
    f.setAttribute("aria-valuetext", fmt(f.value));
    f.dispatchEvent(new Event("input", { bubbles: true }));
  });
  $("modes").hidden = inst !== "polariscope";
}

function draw() {
  const c = $("fig"), g = c.getContext("2d"), W = c.width, H = c.height, a = +$("fa").value, b = +$("fb").value;
  g.clearRect(0, 0, W, H);
  let line = "";
  if (inst === "room-weyl") line = FIG.room(g, W, H, a, b);
  else if (inst === "jnt") line = FIG.jnt(g, W, H, rk(a), ts(b));
  else line = FIG.polar(g, W, H, a, b, mode);
  $("read").textContent = line;
}

function steps() {
  const box = $("steps"), doc = D.inst[inst];
  box.innerHTML = "";
  doc.stages.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = `${i + 1} ${NAMES[i]}`; b.dataset.v = s.gate.verdict;
    b.setAttribute("aria-label", `Stage ${i + 1}, ${NAMES[i]}, status ${s.status}, gate ${s.gate.verdict}`);
    if (i === step) b.setAttribute("aria-current", "step");
    b.onclick = () => { step = i; store("step", i); render(); };
    box.appendChild(b);
  });
}

function card() {
  const s = D.inst[inst].stages[step], g = s.gate;
  const meas = g.measured !== undefined ? ` Measured: ${esc(g.measured)}.` : "";
  $("card").innerHTML = `<h3>Stage ${step + 1}: ${NAMES[step]} <span class="k-meta">(${esc(s.status)})</span></h3>
  <dl><dt>In</dt><dd>${s.inputs.map(esc).join("; ")}</dd>
  <dt>Out</dt><dd>${s.outputs.map(esc).join("; ")}</dd>
  <dt>Gate</dt><dd>${esc(g.condition)}. <span class="verdict" data-verdict="${esc(g.verdict)}">${esc(g.verdict)}</span>.${meas}</dd>
  <dt>Tools</dt><dd>${s.tools.map(t => esc(t.name)).join("; ")}</dd>
  ${s.notes ? `<dt>Notes</dt><dd>${esc(s.notes)}</dd>` : ""}
  <dt>Limit</dt><dd>${esc(s.does_not_prove)}</dd></dl>`;
  $("depth").textContent = `${D.inst[inst].name}, stage ${step + 1} of 10`;
}

function stageTable() {
  $("tstage").querySelector("tbody").innerHTML = D.inst[inst].stages.map((s, i) =>
    `<tr><td>${i + 1} ${NAMES[i]}</td><td>${esc(s.status)}</td><td>${esc(s.gate.condition)}</td>
     <td data-verdict="${esc(s.gate.verdict)}">${esc(s.gate.verdict)}${s.gate.measured !== undefined ? ` (${esc(s.gate.measured)})` : ""}</td>
     <td>${s.tools.map(t => esc(t.name) + (t.ours ? " (ours)" : ` (${esc(t.licence)})`)).join("; ")}</td><td>${esc(s.does_not_prove)}</td></tr>`).join("");
}

function render() {
  document.querySelectorAll("[data-inst]").forEach(b => b.setAttribute("aria-pressed", b.dataset.inst === inst ? "true" : "false"));
  steps(); card(); stageTable(); draw();
}

function staticTables() {
  const st = D.study, f = x => typeof x === "number" ? (Math.abs(x) < 10 ? x.toFixed(3) : x.toFixed(1)) : esc(x);
  $("studyline").textContent = st.line;
  $("tverd").querySelector("tbody").innerHTML = st.verdicts.map(v =>
    `<tr><td>${esc(v.name)}</td><td>${esc(v.rule)}</td><td data-verdict="${v.r1 === "PASS" ? "pass" : "fail"}">${esc(v.r1)} (${f(v.l1)})</td>
     <td data-verdict="${v.r2 === "PASS" ? "pass" : "fail"}">${esc(v.r2)} (${f(v.l2)})</td></tr>`).join("");
  $("terr").querySelector("tbody").innerHTML = st.cells.map(c =>
    `<tr><td>${esc(c.speaker)}</td><td>${f(c.S1)}</td><td>${f(c.S2)}</td><td>${f(c.S3)}</td><td>${f(c.S4)}</td><td>${f(c.prior)}</td><td>${f(c.ok)}</td></tr>`).join("");
  $("trt").querySelector("tbody").innerHTML = D.rt.map(r =>
    `<tr><td>${esc(r.path)}</td><td>${esc(r.error)}</td><td>${esc(r.bits)}</td><td>${esc(r.lost)}</td></tr>`).join("");
  $("rcpt").textContent = D.receipt;
  $("tchk").querySelector("tbody").innerHTML = D.checks.map(c =>
    `<tr><td>${esc(c.id)}</td><td>${esc(c.certifies)}</td><td>${esc(c.fails_by)}</td><td>${esc(c.in_our_stack)}</td></tr>`).join("");
}

document.querySelectorAll("[data-inst]").forEach(b => b.onclick = () => {
  inst = b.dataset.inst; step = 0; store("inst", inst); setControls(); render();
});
document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => {
  mode = b.dataset.mode;
  document.querySelectorAll("[data-mode]").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  draw();
});
["fa", "fb"].forEach((id, k) => $(id).addEventListener("input", () => {
  const f = $(id), fmt = CTL[inst][k ? "b" : "a"][5];
  saved[inst + (k ? "b" : "a")] = f.value; $(k ? "vb" : "va").textContent = fmt(f.value); f.setAttribute("aria-valuetext", fmt(f.value)); draw();
}));
$("prev").onclick = () => { step = (step + 9) % 10; render(); };
$("next").onclick = () => { step = (step + 1) % 10; render(); };

const ri = recall("inst"), rs = recall("step");
if (ri && D.inst[ri]) inst = ri;
if (rs !== null && +rs >= 0 && +rs < 10) step = +rs;
setControls(); staticTables(); render();
if (window.Kit && Kit.on) Kit.on(draw);
