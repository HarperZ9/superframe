// The graph viewer: every node of an act, laid out in columns by distance from the start, with
// the validator's findings on each node and a small player to try a path from any node.
//   /engine/tools/graph.html?src=/slice/lamp_quay_2300.lwd
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame as createGame } from "../full.mjs";
import { lint } from "./lint.mjs";

const $ = (id) => document.getElementById(id), NS = "http://www.w3.org/2000/svg";
const W = 190, H = 34, GX = 70, GY = 14;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (parent) parent.appendChild(e); return e; };

async function load() {
  const src = (new URLSearchParams(location.search).get("src") || "/slice/lamp_quay_2300.lwd").split(",");
  const sources = [], errors = [];
  for (const s of src) { const r = await loadAct(s, async (p) => { const res = await fetch(p); if (!res.ok) throw new Error(`${res.status}`); return res.text(); }); sources.push(...r.sources); errors.push(...r.errors); }
  const C = loadContent(sources); C.errors.unshift(...errors);
  return { C, report: lint(C) };
}

// Columns by breadth-first distance from the roots; nodes nobody reaches go in a last column.
function layout(report) {
  const nodes = report.graph.nodes, depth = {}, queue = report.graph.roots.filter((r) => nodes[r]).map((r) => [r, 0]);
  while (queue.length) { const [id, d] = queue.shift(); if (id in depth) continue; depth[id] = d; for (const e of nodes[id].edges) if (nodes[e.to] && !(e.to in depth)) queue.push([e.to, d + 1]); }
  const maxD = Math.max(0, ...Object.values(depth)), cols = [];
  for (const id of Object.keys(nodes)) { const d = id in depth ? depth[id] : maxD + 1; (cols[d] ||= []).push(id); }
  const pos = {};
  cols.forEach((ids, x) => (ids || []).sort().forEach((id, y) => { pos[id] = { x: 20 + x * (W + GX), y: 20 + y * (H + GY) }; }));
  return pos;
}

function draw(C, report, pos) {
  const g = $("g"), issuesBy = {};
  for (const i of report.issues) if (i.node) (issuesBy[i.node] ||= []).push(i);
  const edges = el("g", {}, g), boxes = el("g", {}, g), nodeEls = {};
  for (const [id, n] of Object.entries(report.graph.nodes)) for (const e of n.edges) {
    const a = pos[id], b = pos[e.to]; if (!a || !b) continue;
    const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
    el("path", { class: "e", d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, "data-from": id, "data-to": e.to }, edges);
  }
  for (const [id, n] of Object.entries(report.graph.nodes)) {
    const p = pos[id], iss = issuesBy[id] || [], grp = el("g", { class: `n${n.hub ? " hub" : ""}`, transform: `translate(${p.x},${p.y})`, tabindex: 0, "data-id": id }, boxes);
    el("rect", { width: W, height: H, rx: 3 }, grp);
    const t = el("text", { x: 8, y: 14 }, grp); t.textContent = id.length > 26 ? id.slice(0, 25) + "…" : id;
    const sub = el("text", { x: 8, y: 27, fill: "#5a4c4a" }, grp);
    const err = iss.filter((i) => i.level === "error").length, warn = iss.length - err;
    sub.textContent = [n.hub ? "hub" : "", err ? `${err} error` : "", warn ? `${warn} warn` : "", n.event ? "event" : ""].filter(Boolean).join(" · ");
    if (err) el("rect", { x: W - 14, y: 4, width: 10, height: 10, fill: "#9a3b1f" }, grp);
    else if (warn) el("circle", { cx: W - 9, cy: 9, r: 4.5, fill: "none", stroke: "#5a4c4a", "stroke-width": 1.5 }, grp);
    grp.addEventListener("click", (ev) => { ev.stopPropagation(); select(C, report, id, nodeEls, issuesBy); });
    grp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") select(C, report, id, nodeEls, issuesBy); });
    nodeEls[id] = grp;
  }
  return { nodeEls, issuesBy };
}

function describe(s) {
  switch (s.kind) {
    case "nar": return esc(s.value);
    case "line": case "inst": return `<i>${esc(s.who)}</i> ${esc(s.text)}`;
    case "voice": return `<i>${esc(s.skill)}</i> ${esc(s.text)} ${s.dc != null ? `(dc ${s.dc})` : ""}${s.below != null ? `(below ${s.below})` : ""}`;
    case "opt": case "claim": case "check": return `${esc(s.label)} → <a data-go="${esc(s.target)}">${esc(s.target)}</a>${s.fail ? ` / <a data-go="${esc(s.fail)}">${esc(s.fail)}</a>` : ""}${s.cond ? ` ? ${esc(s.cond.src)}` : ""}${s.attrs.skill ? ` [${esc(s.attrs.skill)} ${esc(s.attrs.dc)}${s.attrs.red ? " ink" : ""}]` : ""}`;
    case "go": case "call": case "else": return `<a data-go="${esc(s.value)}">${esc(s.value)}</a>`;
    case "alt": case "passive": return `<a data-go="${esc(s.target)}">${esc(s.target)}</a> ? ${esc((s.cond && s.cond.src) || s.skill)}`;
    case "do": case "set": case "clear": return esc(s.effects ? s.effects.src : s.value);
    case "if": return `${esc(s.cond.src)} => ${esc(s.effects.src)}`;
    case "when": return esc(s.cond.src);
    case "cmd": return esc(s.args.join(" "));
    default: return esc(s.value ?? "");
  }
}

function select(C, report, id, nodeEls, issuesBy) {
  for (const e of Object.values(nodeEls)) e.classList.remove("sel");
  nodeEls[id] && nodeEls[id].classList.add("sel");
  document.querySelectorAll(".e").forEach((p) => p.classList.toggle("hot", p.dataset.from === id || p.dataset.to === id));
  const n = C.book.nodes[id], into = Object.entries(report.graph.nodes).filter(([, x]) => x.edges.some((e) => e.to === id)).map(([k]) => k);
  $("side").innerHTML = `<h2>${esc(id)}</h2><div class="mono">${esc(n.file)}:${n.line}</div>
    ${(issuesBy[id] || []).map((i) => `<div class="issue ${i.level}">${esc(i.msg)}</div>`).join("")}
    ${n.steps.map((s) => `<div class="step"><b>${esc(s.kind)}</b>${describe(s)}</div>`).join("")}
    <div class="mono" style="margin-top:8px">from: ${into.map((k) => `<a data-go="${esc(k)}">${esc(k)}</a>`).join(", ") || "none"}</div>
    <div class="player"><button id="play">Play from here</button><div id="out"></div></div>`;
  $("side").querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", () => { focus(a.dataset.go); select(C, report, a.dataset.go, nodeEls, issuesBy); }));
  $("play").addEventListener("click", () => play(C, id));
}

function play(C, id) {
  const G = createGame({ content: C }), t = G.talk(id), out = $("out");
  const render = () => {
    const b = t.beat;
    out.innerHTML = b.lines.map((l) => `<div class="step">${l.who ? `<b>${esc(l.who)}</b>` : ""}${esc(l.text)}</div>`).join("") +
      (b.options || []).map((o, i) => `<button class="opt" data-i="${i}" ${o.locked ? "disabled" : ""}>${i + 1}. ${esc(o.label)}${o.check ? ` (${esc(o.check.skillName)} ${o.check.total} vs ${o.check.dc})` : ""}</button>`).join("") +
      (b.end ? `<div class="mono">END ${esc(b.end)}</div>` : b.exit ? `<div class="mono">EXIT ${esc(b.exit)}</div>` : b.run ? `<div class="mono">TIDE RUN ${esc(b.run)} (not played here)</div>` : b.deadEnd ? `<div class="mono">DEAD END ${esc(b.deadEnd)}</div>` : "");
    out.querySelectorAll(".opt").forEach((btn) => btn.addEventListener("click", () => { t.choose(+btn.dataset.i); render(); }));
  };
  try { render(); } catch (e) { out.textContent = `Error: ${e.message}`; console.error(e); }
}

// pan and zoom
let view = { x: 0, y: 0, k: 1 }, posAll = {};
const apply = () => $("g").setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.k})`);
function focus(id) { const p = posAll[id]; if (!p) return; const r = $("view").getBoundingClientRect(); view.x = r.width / 2 - (p.x + W / 2) * view.k; view.y = r.height / 2 - (p.y + H / 2) * view.k; apply(); }
function panZoom() {
  const v = $("view"); let drag = null;
  v.addEventListener("pointerdown", (e) => { drag = { x: e.clientX - view.x, y: e.clientY - view.y }; v.classList.add("drag"); });
  addEventListener("pointerup", () => { drag = null; v.classList.remove("drag"); });
  addEventListener("pointermove", (e) => { if (drag) { view.x = e.clientX - drag.x; view.y = e.clientY - drag.y; apply(); } });
  v.addEventListener("wheel", (e) => { e.preventDefault(); const r = v.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k = Math.min(3, Math.max(0.15, view.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); view.x = mx - ((mx - view.x) * k) / view.k; view.y = my - ((my - view.y) * k) / view.k; view.k = k; apply(); }, { passive: false });
}

try {
  const { C, report } = await load();
  posAll = layout(report);
  const { nodeEls, issuesBy } = draw(C, report, posAll);
  $("stats").textContent = `${report.nodes} nodes · ${report.reachable} reachable · ${report.errors} errors · ${report.warnings} warnings`;
  panZoom(); apply();
  $("q").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    for (const [id, g] of Object.entries(nodeEls)) { const n = C.book.nodes[id], hit = !q || id.includes(q) || n.steps.some((s) => String(s.text || s.value || s.label || "").toLowerCase().includes(q)); g.classList.toggle("dim", !hit); }
  });
  $("q").addEventListener("keydown", (e) => { if (e.key === "Enter") { const hit = Object.keys(nodeEls).find((id) => !nodeEls[id].classList.contains("dim")); if (hit) { focus(hit); select(C, report, hit, nodeEls, issuesBy); } } });
  const first = report.graph.roots.find((r) => nodeEls[r]); if (first) { focus(first); select(C, report, first, nodeEls, issuesBy); }
} catch (e) { $("stats").textContent = `Could not load: ${e.message}`; console.error(e); }
