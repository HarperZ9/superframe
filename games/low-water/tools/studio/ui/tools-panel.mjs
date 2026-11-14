// The tools panel: the tool (the four brushes, liquify, lasso, eyedropper), brush presets (the starting
// set and the sitter's own, saved with the sitter), the brush's settings, the liquify settings, and the
// transform panel once a lasso is closed.
import { el, slider, button, select } from "./dom.mjs";
import { BRUSH } from "../core/brush.mjs";

export const TOOL_KEYS = { b: "brush", k: "knife", s: "smudge", e: "eraser", l: "liquify", a: "lasso", i: "pick" };
const TOOLS = ["brush", "knife", "smudge", "eraser", "liquify", "lasso", "pick"];

function brushSettings(app) {
  const b = app.brush;
  return [slider("Size", b.size, 1, 80, 1, (v) => (b.size = v)), slider("Flow", b.flow, 0.05, 1, 0.05, (v) => (b.flow = v)),
    slider("Load", b.load, 0.1, 1, 0.05, (v) => (b.load = v)), slider("Pickup", b.pickup, 0, 1, 0.05, (v) => (b.pickup = v)),
    slider("Impasto", b.impasto, 0, 2, 0.05, (v) => (b.impasto = v)), slider("Bristles", b.bristles, 1, 48, 1, (v) => (b.bristles = v)),
    slider("Spread", b.spread ?? 0.8, 0.4, 3, 0.1, (v) => (b.spread = v)), slider("Light", b.light ?? 0, 0, 1, 0.05, (v) => (b.light = v)),
    el("label", { class: "toggle" }, el("input", { type: "checkbox", checked: !!b.wetUnder, onchange: (e) => (b.wetUnder = e.target.checked) }), "Wet into the layers below")];
}
// on a form layer the brush lays a plane: which way it faces, from the face's own forward
function planeRow(app) {
  const d = app.sitting?.doc, L = d?.layers.find((l) => l.id === d.active); if (L?.kind !== "form") return [];
  const p = (app.brush.plane ||= { yaw: 0, pitch: 0 });
  return [el("p", { class: "hint" }, "Form layer: the brush lays a plane. Turn it toward the face's side (yaw) or up and down (pitch)."),
    slider("Plane yaw", p.yaw, -90, 90, 5, (v) => (p.yaw = v)), slider("Plane pitch", p.pitch, -80, 80, 5, (v) => (p.pitch = v))];
}
function presetRow(app, act) {
  const names = Object.keys(app.presets || {}); let name = "";
  return [select("Preset", ["", ...names], app.presetName || "", (v) => { if (!v) return; app.presetName = v; Object.assign(app.brush, { ...BRUSH, colour: app.brush.colour, ...app.presets[v] }); app.tool = app.presets[v].tool || "brush"; app.render(); }),
    el("label", { class: "row" }, el("span", {}, "Save as"), el("input", { type: "text", placeholder: "preset name", oninput: (e) => (name = e.target.value) }), button("Save", () => act.savePreset(app, name)))];
}
function transformPanel(app, ops) {
  const t = app.lasso?.t; if (!t) return null;
  const set = (k) => (v) => { t[k] = v; ops.previewTransform(); };
  return el("div", {}, el("h2", {}, "Transform the selection"),
    slider("Move x", t.dx, -200, 200, 1, set("dx")), slider("Move y", t.dy, -200, 200, 1, set("dy")), slider("Scale", t.scale, 0.5, 1.6, 0.01, set("scale")),
    slider("Rotate", t.rot, -45, 45, 0.5, set("rot")), slider("Feather", t.feather, 0, 40, 1, set("feather")),
    el("div", { class: "buttons" }, button("Apply", () => ops.applyTransform()), button("Cancel", () => ops.cancelLasso())));
}
export function toolsPanel(app, act, ops) {
  const q = app.liquify;
  return el("section", {}, el("h2", {}, "Tools"),
    el("div", { class: "tools" }, TOOLS.map((t) => button(t, () => { app.tool = t; app.render(); }, `key ${Object.keys(TOOL_KEYS).find((k) => TOOL_KEYS[k] === t)}`, app.tool === t))),
    ...(app.tool === "liquify" ? [select("Liquify", ["push", "pull", "pinch", "bloat"], q.mode, (v) => (q.mode = v)), slider("Radius", q.radius, 4, 480, 1, (v) => (q.radius = v)), slider("Strength", q.strength, 0.05, 1.5, 0.05, (v) => (q.strength = v)),
      el("label", { class: "toggle" }, el("input", { type: "checkbox", checked: !!q.reach, onchange: (e) => (q.reach = e.target.checked) }), "Reach: move a whole mass (skull, jaw)"),
      el("p", { class: "hint" }, "Liquify moves every layer, the underpainting too.")] : []),
    ...(app.tool === "lasso" ? [el("p", { class: "hint" }, "Draw round the part to move; then move, scale or rotate it below."), transformPanel(app, ops)] : []),
    ...(["brush", "knife", "smudge", "eraser"].includes(app.tool) ? [...planeRow(app), ...presetRow(app, act), ...brushSettings(app)] : []),
    el("div", { class: "buttons" }, button("Reset brush", () => { Object.assign(app.brush, { ...BRUSH, colour: app.brush.colour }); app.render(); })));
}
