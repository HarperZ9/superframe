// The Studio, in the browser: state, the panels, the canvas, keys. Boot loads the cast and sits the
// first sitter (or a saved source, ?load=ned@e2; or a plate, ?plate=content/...png).
import { BRUSH } from "../core/brush.mjs";
import { addLayer, removeLayer, moveLayer, composite, layerById } from "../core/doc.mjs";
import { structural, undo, redo, pushOp } from "../core/history.mjs";
import { showMood } from "../core/variants.mjs";
import { setBlend } from "../core/blend.mjs";
import { transform } from "../core/liquify.mjs";
import * as act from "./actions.mjs";
import { createView, MODES } from "./view.mjs";
import { attachInput, drawOverlay } from "./input.mjs";
import { el, button } from "./dom.mjs";
import { sitterPanel, palettePanel } from "./panels.mjs";
import { toolsPanel, TOOL_KEYS } from "./tools-panel.mjs";
import { layersPanel } from "./layers-panel.mjs";
import { blendPanel } from "./blend-panel.mjs";

const $ = (s) => document.querySelector(s);
const app = { cast: null, sitting: null, tool: "brush", brush: { ...BRUSH, colour: [...BRUSH.colour] }, liquify: { mode: "push", radius: 40, strength: 0.8 }, presets: {}, lasso: null, seed: 1, keys: new Set(), valueCheck: false, showFlags: true };
app.status = (msg, state = "ok") => { const s = $("#status"); s.textContent = msg; s.dataset.state = state; if (state === "drift") console.warn(`studio: ${msg}`); };
app.setColour = (c) => { app.brush.colour = c.map((v) => +v.toFixed(4)); renderPanels(); };
app.pointer = (e) => { $("#pressure").textContent = `${e.pointerType} ${e.pointerType === "pen" ? `pressure ${e.pressure.toFixed(2)}` : ""}`; };
app.changed = () => renderLayers();
app.render = () => { renderPanels(); view.draw(); drawOverlay(view, app); };
app.lassoDone = () => { if ((app.lasso?.poly.length || 0) < 3) { app.lasso = null; return; } app.lasso.t = { dx: 0, dy: 0, scale: 1, rot: 0, feather: 6 }; renderPanels(); drawOverlay(view, app); };

const H = () => app.sitting.history, D = () => app.sitting.doc;
const ops = {
  toggle(L) { structural(H(), "visible", () => { L.visible = !L.visible; }); redraw(); },
  opacity(L, v) { structural(H(), "opacity", () => { L.opacity = v; }); redraw(); },
  add(kind) {   // a new mask shows all of its layer (paint with the eraser to hide, the brush to show again)
    const cur = layerById(D(), D().active), fill = kind === "mask" ? new Float32Array(D().w * D().h * 4).fill(1) : null;
    structural(H(), `add ${kind}`, () => { const L = addLayer(D(), { kind, author: "human", fill, target: kind === "mask" ? cur?.id : null, name: kind === "mask" && cur ? `${cur.name} mask` : null }); if (fill) L.rule = { kind: "all", soft: 0 }; }); redraw();
  },
  move(by) { structural(H(), "move", () => moveLayer(D(), D().active, by)); redraw(); },
  remove() { const L = layerById(D(), D().active); if (!L || L.locked) { app.status("the underpainting and the mood overrides stay; hide them instead", "drift"); return; } structural(H(), "delete", () => removeLayer(D(), L.id)); redraw(); },
  showMood(m) { showMood(D(), m === "neutral" ? null : m); redraw(); },
  setGroup(L, name) { if (!L) return; const was = L.group; pushOp(H(), null, () => { L.group = was; }, () => { L.group = name.trim() || null; }); L.group = name.trim() || null; redraw(); },
  group(name, change) { const g = D().groups[name], was = { ...g }; Object.assign(g, change); pushOp(H(), null, () => Object.assign(g, was), () => Object.assign(g, change)); redraw(); },
  glazeMode(L, v) { const was = L.blend; L.blend = v === "glaze" ? null : v; pushOp(H(), null, () => { L.blend = was; }, () => { L.blend = v === "glaze" ? null : v; }); redraw(); },
  blend(region, v) { setBlend(D(), region, v, { history: H() }); view.draw(); },
  previewTransform() { const { poly, t } = app.lasso, c = poly.reduce((a, [x, y]) => [a[0] + x / poly.length, a[1] + y / poly.length], [0, 0]), r = (t.rot * Math.PI) / 180;
    app.lasso.preview = poly.map(([x, y]) => { const px = (x - c[0]) * t.scale, py = (y - c[1]) * t.scale; return [c[0] + t.dx + px * Math.cos(r) - py * Math.sin(r), c[1] + t.dy + px * Math.sin(r) + py * Math.cos(r)]; }); drawOverlay(view, app); },
  applyTransform() { const { poly, t } = app.lasso; transform(D(), { op: "transform", poly, ...t, layers: D().layers.map((l) => l.name), size: [D().w, D().h] }, H()); app.lasso = null; redraw(); renderPanels(); },
  cancelLasso() { app.lasso = null; renderPanels(); drawOverlay(view, app); },
};
function redraw() { composite(D()); view.draw(); renderLayers(); }
function renderLayers() { $("#layers").replaceChildren(layersPanel(app, ops)); }
function renderPanels() {
  $("#left").replaceChildren(toolsPanel(app, wrap, ops), palettePanel(app));
  $("#right").replaceChildren(app.cast ? sitterPanel(app, wrap) : el("p", {}, "loading the cast"), blendPanel(app, ops) || "", el("div", { id: "layers" }), exportPanel());
  renderLayers();
}
function exportPanel() {
  const plate = app.sitting?.plate;
  return el("section", {}, el("h2", {}, plate ? "Plate" : "Source and export"),
    el("div", { class: "buttons" }, plate ? button("Write plate", () => wrap.exportPlate(app)) : [button("Save source", () => wrap.save(app)), button("Export portraits", () => wrap.exportSet(app)), button("Scripted paint-over", () => wrap.scriptPaint(app), "Lay the targeted scripted paint-over (author: script) under your paint layer")],
      button("Replay strokes", () => wrap.replayAll(app), "Clear the painted layers and lay every recorded stroke again on the current underpainting")),
    el("label", { class: "row" }, el("span", {}, "Open plate"), el("input", { type: "text", placeholder: "content/....png", onchange: (e) => wrap.openPlate(app, e.target.value) })));
}
// every action redraws after, and reports its error instead of losing it
const wrap = Object.fromEntries(Object.entries(act).map(([k, f]) => [k, async (...a) => {
  try { await f(...a); } catch (e) { console.error(`studio: ${k}:`, e); app.status(`${k}: ${e.message}`, "drift"); }
  if (app.sitting) { composite(app.sitting.doc); app.sitting._edges = null; } app.render();
}]));

const view = createView($("#stage"), app); attachInput(view, app);
const turn = (deg) => { view.view.rot = (view.view.rot + deg + 360) % 360; view.place(); drawOverlay(view, app); };
const mirror = () => { view.view.flip = !view.view.flip; view.place(); drawOverlay(view, app); };
$("#modes").replaceChildren(...Object.entries(MODES).map(([k, label]) => el("button", { class: k === "paint" ? "on" : null, onclick: (e) => { view.setMode(k); for (const b of $("#modes").querySelectorAll(".mode")) b.classList.toggle("on", b === e.target); } }, label)),
  el("label", { class: "toggle" }, el("input", { type: "checkbox", onchange: (e) => { app.valueCheck = e.target.checked; view.draw(); } }), "Greyscale"),
  el("label", { class: "toggle" }, el("input", { type: "checkbox", checked: true, onchange: (e) => { app.showFlags = e.target.checked; view.draw(); } }), "Repaint flags"),
  button("Undo", () => { undo(H()); redraw(); }), button("Redo", () => { redo(H()); redraw(); }),
  button("Rotate", () => turn(15), "Rotate the view 15 degrees (r; Shift+r back). The painting does not change."), button("Mirror", mirror, "Mirror the view (x). The painting does not change."),
  button("Fit", () => { view.view.rot = 0; view.view.flip = false; view.fit(); drawOverlay(view, app); }, "Fit and reset the view (0)"));
for (const b of [...$("#modes").children].slice(0, Object.keys(MODES).length)) b.classList.add("mode");
addEventListener("keydown", (e) => {
  app.keys.add(e.key); if (e.target.tagName === "INPUT" && e.target.type === "text") return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); (e.shiftKey ? redo : undo)(H()); redraw(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(H()); redraw(); return; }
  if (e.ctrlKey || e.metaKey) return;
  if (e.key === "g") { app.valueCheck = !app.valueCheck; view.draw(); }
  if (e.key.toLowerCase() === "r") turn(e.shiftKey ? -15 : 15); if (e.key === "x") mirror(); if (e.key === "0") { view.view.rot = 0; view.view.flip = false; view.fit(); }
  if (TOOL_KEYS[e.key]) { app.tool = TOOL_KEYS[e.key]; renderPanels(); }
  if (e.key === "[" || e.key === "]") { const f = e.key === "]" ? 1.2 : 1 / 1.2; if (app.tool === "liquify") app.liquify.radius = Math.max(4, Math.round(app.liquify.radius * f)); else app.brush.size = Math.max(1, Math.round(app.brush.size * f)); renderPanels(); }
});
addEventListener("keyup", (e) => app.keys.delete(e.key));

async function boot() {
  renderPanels(); app.status("loading the cast", "busy");
  const q = new URLSearchParams(location.search);
  try { app.cast = await act.loadCast(q.get("game") || "quota"); document.title = `Studio: ${app.cast.title}`; } catch (e) { app.status(`could not load the cast: ${e.message}`, "drift"); throw e; }
  if (q.get("plate")) await wrap.openPlate(app, q.get("plate"));
  else if (q.get("load")) await wrap.load(app, q.get("load"));
  else await wrap.sitNew(app, { who: q.get("who") || Object.keys(app.cast.members)[0], w: +(q.get("w") || 768), h: +(q.get("h") || 960) });
  view.fit(); globalThis.__studio = { app, view, act: wrap, ops };   // for scripted checks in the browser
}
boot();
