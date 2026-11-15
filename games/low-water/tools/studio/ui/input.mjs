// Pen and mouse on the canvas, through Pointer Events (pressure from a pen; for a mouse, a slow hand
// presses harder than a fast one). By tool: the brushes lay strokes on the active layer; liquify reshapes
// every layer live; the lasso draws a selection for the transform panel; the eyedropper (or Alt with any
// brush) picks a colour. A middle drag or Space-drag pans. The overlay shows the brush at its size and
// the current pressure, and the lasso with its transformed outline.
//   attachInput(view, app)
import { beginStroke, strokeTo, endStroke } from "../core/stroke.mjs";
import { composite, grow, layerById, sampleAt } from "../core/doc.mjs";
import { beginLiquify, liquifyTo, endLiquify } from "../core/liquify.mjs";
import { clamp } from "../core/brush.mjs";

const union = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
export const BRUSH_TOOLS = ["brush", "knife", "smudge", "eraser"];

function pressureOf(st, e) {
  if (e.pointerType === "pen") return e.pressure || 0.5;
  if (e.pointerType === "touch") return e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 0.55;
  const t = e.timeStamp, v = st.last ? Math.hypot(e.clientX - st.last.x, e.clientY - st.last.y) / Math.max(1, t - st.last.t) : 0;
  st.last = { x: e.clientX, y: e.clientY, t }; return Math.max(0.25, Math.min(0.85, 0.8 - v * 0.25));   // a mouse: slower is firmer
}
// the overlay: the brush's footprint at this pressure, and the lasso (with its transformed outline)
export function drawOverlay(view, app, e = null, p = 0.6) {
  const o = view.overlay, g = o.getContext("2d"); g.clearRect(0, 0, o.width, o.height); g.lineWidth = 1; g.strokeStyle = "rgba(228, 226, 222, 0.85)";
  const poly = app.lasso?.poly; if (poly?.length > 1) { g.beginPath(); poly.forEach(([x, y], k) => { const [px, py] = view.toClient(x, y); k ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]); }
  if (app.lasso?.preview) { g.beginPath(); app.lasso.preview.forEach(([x, y], k) => { const [px, py] = view.toClient(x, y); k ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.stroke(); }
  if (!e) return; const b = o.getBoundingClientRect(), B = app.brush, tool = app.tool;
  const r = tool === "liquify" ? app.liquify.radius : BRUSH_TOOLS.includes(tool) ? B.size * (0.15 + 0.85 * Math.pow(clamp(p), B.sizeCurve)) : 0;
  if (r) { g.beginPath(); g.arc(e.clientX - b.left, e.clientY - b.top, Math.max(1.5, r * view.view.zoom), 0, Math.PI * 2); g.stroke(); }
}

export function attachInput(view, app) {
  const cv = view.canvas, st = { S: null, Q: null, last: null, pan: null, p: 0.6 }, doc = () => app.sitting?.doc;
  const capture = (e) => { try { cv.setPointerCapture(e.pointerId); } catch (err) { console.warn(`studio: no pointer capture (${err.message})`); } };
  function startPaint(e, x, y) {
    if (app.tool === "pick" || e.altKey) { app.setColour(sampleAt(doc(), x, y, [0, 0, 0])); return; }
    if (app.tool === "lasso") { app.lasso = { poly: [[x, y]] }; capture(e); st.lassoing = true; return; }
    if (app.tool === "liquify") { st.Q = beginLiquify(doc(), app.liquify, app.sitting.history); capture(e); liquifyTo(st.Q, x, y, pressureOf(st, e)); return; }
    const L = layerById(doc(), doc().active);
    try { st.S = beginStroke(doc(), L, { ...app.brush, tool: app.tool }, { history: app.sitting.history, author: "human", seed: (app.seed = (app.seed + 1) >>> 0) }); }
    catch (err) { app.status(err.message, "drift"); return; }
    capture(e); st.last = null; strokeTo(st.S, x, y, pressureOf(st, e));
  }
  cv.addEventListener("pointerdown", (e) => {
    if (e.button === 1 || app.keys.has(" ")) { st.pan = [e.clientX - view.view.pan[0], e.clientY - view.view.pan[1]]; capture(e); return; }
    if (e.button !== 0 || !doc() || view.mode !== "paint") return;
    const [x, y] = view.toCanvas(e); startPaint(e, x, y);
  });
  cv.addEventListener("pointermove", (e) => {
    if (st.pan) { view.view.pan = [e.clientX - st.pan[0], e.clientY - st.pan[1]]; view.place(); drawOverlay(view, app); return; }
    const evs = e.getCoalescedEvents?.() || [], list = evs.length ? evs : [e]; let rect = null;
    for (const ev of list) {
      const [x, y] = view.toCanvas(ev), p = (st.p = pressureOf(st, ev));
      if (st.S) rect = union(rect, strokeTo(st.S, x, y, p)); else if (st.Q) rect = union(rect, liquifyTo(st.Q, x, y, p)); else if (st.lassoing) app.lasso.poly.push([+x.toFixed(1), +y.toFixed(1)]);
    }
    if (rect) { const gr = grow(doc(), rect, 2); composite(doc(), gr); view.draw(gr); }
    drawOverlay(view, app, e, st.p); app.pointer(e);
  });
  const up = () => {
    if (st.pan) { st.pan = null; return; }
    if (st.S) { endStroke(st.S); st.S = null; } else if (st.Q) { endLiquify(st.Q); st.Q = null; } else if (st.lassoing) { st.lassoing = false; app.lassoDone(); return; } else return;
    view.draw(); app.changed();
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("pointerleave", () => drawOverlay(view, app));
}
